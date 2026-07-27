#!/usr/bin/env node
// Render a StoryBlox story, print its resolved instance tree and warnings, and screenshot the
// browser preview. Part of the roblox-frame-identification skill.
//
// Exit codes: 0 ok · 1 render error (or --strict with warnings) · 2 server reported Zune missing ·
//             4 bad args, or config/rojo missing or invalid · 5 server never became ready
//
// StoryBlox v0.1.1+ ships a standalone binary with Zune bundled, so Zune on PATH and an installed
// node_modules are no longer prerequisites — preflight only warns, and the server's own startup
// failure is what decides.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const EXIT = { OK: 0, RENDER: 1, ZUNE: 2, CONFIG: 4, SERVER: 5 };

const HELP = `
preview.mjs — render a StoryBlox story, dump its tree, screenshot the preview

  node preview.mjs --story <path/to/X.story.luau> [options]

Options
  --story <path>       Story file to render. Required.
  --config <path>      ui-claps.config.ts. Default: walk up from --story.
  --url <origin>       Use an already-running server (skips spawn + preflight).
  --storyblox <path>   Standalone storyblox binary to launch (bundles Zune).
  --props '<json>'     Props for /api/render. Default: {}
                       NOTE: affects render.json only, never the screenshot.
  --out <dir>          Artifact directory. Default: .storyblox-verify
  --viewport <WxH>     Browser viewport. Default: 1280x720
  --capture <what>     root | stage | page | all | none. Default: all
  --boxes              Also write boxes.json: each node's exact DOM bounding box.
  --strict             Exit non-zero if the render produced any warning.
  --keep-alive         Leave a server we started running.
  --json               Print the raw render response instead of the summary.
  -h, --help           This text.
`.trim();

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const out = {
    props: "{}",
    outDir: ".storyblox-verify",
    viewport: "1280x720",
    capture: "all",
    strict: false,
    keepAlive: false,
    json: false,
    boxes: false,
    help: false,
  };
  const takesValue = new Set([
    "--story", "--config", "--url", "--props", "--out", "--viewport", "--capture", "--storyblox",
  ]);
  const key = {
    "--story": "story", "--config": "config", "--url": "url", "--props": "props",
    "--out": "outDir", "--viewport": "viewport", "--capture": "capture", "--storyblox": "storyblox",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--strict") out.strict = true;
    else if (a === "--keep-alive") out.keepAlive = true;
    else if (a === "--json") out.json = true;
    else if (a === "--boxes") out.boxes = true;
    else if (takesValue.has(a)) {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${a} requires a value.`);
      out[key[a]] = v;
      i += 1;
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function die(code, ...lines) {
  for (const l of lines) console.error(l);
  process.exit(code);
}

// ---------------------------------------------------------------- config

function findConfig(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, "ui-claps.config.ts");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// The config is TypeScript, so rather than importing it we read the one field we need.
// `port` is the only value that changes where we connect; the server does the real parsing.
//
// Comments are stripped first: `String.match` returns the FIRST hit, so a commented-out
// `// port: 3000` sitting above the real one would otherwise win. The line-comment pattern
// deliberately does not fire on `://`, so a URL in the config is not mistaken for a comment.
function readPort(configPath) {
  try {
    const src = readFileSync(configPath, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const m = src.match(/(^|[{,\s])port\s*:\s*(\d+)/);
    return m ? Number(m[2]) : 4500;
  } catch {
    return 4500;
  }
}

// ---------------------------------------------------------------- preflight

// Locate the standalone StoryBlox binary (v0.1.1+), which bundles Zune and needs no node_modules.
function findStorybloxBinary(explicit) {
  if (explicit) return existsSync(explicit) ? explicit : null;
  const found = spawnSync("sh", ["-c", "command -v storyblox"], { encoding: "utf8" });
  const path = found.status === 0 ? found.stdout.trim() : "";
  return path || null;
}

// Advisory only. The standalone binary bundles Zune and ships without node_modules, so neither
// check is a hard requirement any more — the authoritative answer is whether the server boots,
// and ensureServer() maps that failure to the right exit code.
function preflight(configPath, binary, log) {
  if (binary) return;

  const zune = spawnSync("zune", ["--version"], { encoding: "utf8" });
  if (zune.error || zune.status !== 0) {
    log('note: "zune" is not on PATH. The npm/source install needs it (https://zune.sh/);');
    log("      the standalone storyblox binary bundles it — pass --storyblox <path> to use one.");
  }

  const projectRoot = dirname(configPath);
  if (!existsSync(join(projectRoot, "node_modules"))) {
    log(`note: no node_modules in ${projectRoot}. Run \`pnpm install\`, or use the standalone binary.`);
  }
}

// ---------------------------------------------------------------- server

async function fetchProject(origin, timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${origin}/api/project`, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function ensureServer(origin, configPath, binary, log) {
  const existing = await fetchProject(origin);
  if (existing) {
    log(`server ${origin} (reused)`);
    return { manifest: existing, child: null };
  }
  if (!configPath) {
    die(EXIT.SERVER, `No server at ${origin} and no config to start one from.`);
  }

  // Prefer the standalone binary (bundles Zune, no node_modules needed); fall back to npx.
  const [cmd, args] = binary
    ? [binary, ["dev", "--config", configPath]]
    : ["npx", ["storyblox", "dev", "--config", configPath]];

  log(`starting server via ${binary ? binary : "npx storyblox"} for ${configPath} …`);
  const child = spawn(cmd, args, {
    cwd: dirname(configPath),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.stdout.on("data", () => {});

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    const manifest = await fetchProject(origin);
    if (manifest) {
      log(`server ${origin} (started)`);
      return { manifest, child };
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  try { child.kill(); } catch {}
  if (/Zune/i.test(stderr)) die(EXIT.ZUNE, stderr.trim());
  if (/config was not found|must set (root|rojoProject)|Rojo/i.test(stderr)) {
    die(EXIT.CONFIG, stderr.trim());
  }
  // storyblox is not published to npm, so the npx fallback 404s unless it is linked locally.
  if (!binary && /404|not in this registry|E404/i.test(stderr)) {
    die(
      EXIT.SERVER,
      "`npx storyblox` failed: the package is not on the public npm registry.",
      "",
      "Use the standalone binary instead — it bundles Zune and needs nothing else:",
      "  curl -sSL -o storyblox \\",
      "    https://github.com/CapedBojji/storyblox/releases/download/v0.1.1/storyblox-linux-x64",
      "  chmod +x storyblox",
      "  node preview.mjs --story <story> --storyblox ./storyblox",
      "",
      "Or start a server yourself and pass --url <origin>.",
    );
  }
  die(EXIT.SERVER, `Server at ${origin} never became ready.`, stderr.trim());
}

// ---------------------------------------------------------------- tree formatting

function fmtUDim(u) {
  const s = Number(u?.scale ?? 0);
  const o = Number(u?.offset ?? 0);
  return `${s}s${o < 0 ? "-" : "+"}${Math.abs(o)}`;
}

function fmtValue(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v !== "object") return typeof v === "string" ? JSON.stringify(v) : String(v);
  if (Array.isArray(v)) return `[${v.map(fmtValue).join(", ")}]`;
  switch (v.$type) {
    case "UDim2": return `(${fmtUDim(v.x)}, ${fmtUDim(v.y)})`;
    case "UDim": return `(${v.scale}, ${v.offset})`;
    case "Vector2": return `${v.x},${v.y}`;
    case "Color3": {
      const c = (n) => Math.round(Number(n ?? 0) * 255);
      return `rgb(${c(v.r)},${c(v.g)},${c(v.b)})`;
    }
    case "EnumItem": return `${v.enumType}.${v.name}`;
    case "Font": return `Font(${typeof v.family === "object" ? v.family?.name : v.family})`;
    case "ColorSequence": return `ColorSequence(${v.keypoints?.length ?? 0} stops)`;
    case "NumberSequence": return `NumberSequence(${v.keypoints?.length ?? 0} stops)`;
    default: return JSON.stringify(v);
  }
}

// Properties worth showing inline, in the order a frame spec lists them.
const HEADLINE = [
  "Size", "Position", "AnchorPoint", "BackgroundColor3", "BackgroundTransparency",
  "Text", "TextSize", "TextXAlignment", "Image", "ZIndex", "ClipsDescendants",
  "CornerRadius", "Thickness", "FillDirection", "Padding", "CellSize", "CellPadding",
  "MinSize", "MaxSize", "AspectRatio", "FlexMode", "ScrollBarThickness", "Visible",
];

function renderTree(node, prefix = "", isLast = true, isRoot = true) {
  const lines = [];
  // The server may carry the instance name in `name`, or leave it in props as `Name` (which is
  // what the adapter produces). Prefer whichever is present — the frame spec is name-driven, so a
  // tree without names is far less useful to diff against it.
  const name = node.name ?? (typeof node.props?.Name === "string" ? node.props.Name : undefined);
  const label = name && name !== node.className ? `${name} (${node.className})` : node.className;

  const props = HEADLINE
    .filter((k) => node.props && node.props[k] !== undefined)
    .map((k) => `${k}=${fmtValue(node.props[k])}`)
    .join("  ");

  const branch = isRoot ? "" : `${prefix}${isLast ? "└─ " : "├─ "}`;
  lines.push(`${branch}${label}${props ? "  " + props : ""}`);

  const childPrefix = isRoot ? "" : `${prefix}${isLast ? "   " : "│  "}`;
  const children = node.children ?? [];
  children.forEach((c, i) => {
    lines.push(...renderTree(c, childPrefix, i === children.length - 1, false));
  });
  return lines;
}

// ---------------------------------------------------------------- screenshots

// Playwright may live in the user's project rather than next to this script, so resolve from the
// project first (cwd / the config dir) and only then fall back to this script's own tree.
async function loadPlaywright(fromDirs) {
  for (const dir of fromDirs) {
    const req = createRequire(join(dir, "noop.js"));
    for (const name of ["playwright-core", "playwright"]) {
      try {
        return await import(pathToFileURL(req.resolve(name)).href);
      } catch { /* try the next candidate */ }
    }
  }
  for (const name of ["playwright-core", "playwright"]) {
    try { return await import(name); } catch { /* not here either */ }
  }
  return null;
}

function chromiumOverride() {
  const explicit = process.env.STORYBLOX_CHROMIUM;
  return explicit && existsSync(explicit) ? { executablePath: explicit } : {};
}

// Some environments preinstall browsers under PLAYWRIGHT_BROWSERS_PATH at a build number that does
// not match the installed Playwright package. Find a real binary rather than failing on the mismatch.
function findInstalledChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return null;
  const suffixes = [
    join("chrome-linux", "chrome"),
    join("chrome-linux", "headless_shell"),
    join("chrome-headless-shell-linux64", "chrome-headless-shell"),
    join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
  ];
  let dirs;
  try {
    dirs = readdirSync(root).filter((d) => d.startsWith("chromium"));
  } catch {
    return null;
  }
  // Prefer full chromium over the headless shell; newest build number first.
  dirs.sort((a, b) => {
    const shell = (n) => (n.includes("headless_shell") ? 1 : 0);
    if (shell(a) !== shell(b)) return shell(a) - shell(b);
    const num = (n) => Number(n.split("-").at(-1)) || 0;
    return num(b) - num(a);
  });
  for (const dir of dirs) {
    for (const suffix of suffixes) {
      const candidate = join(root, dir, suffix);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// The renderer paths children by their index in the RAW children array, so modifier instances
// (UICorner, UIListLayout, …) consume an index even though they render no DOM node. Walk the tree
// the same way or every path after a modifier is off by one.
function pathIndex(node, path = "0", acc = {}) {
  if (!node) return acc;
  acc[path] = { name: node.props?.Name ?? node.name ?? null, className: node.className };
  (node.children ?? []).forEach((c, i) => pathIndex(c, `${path}.${i}`, acc));
  return acc;
}

async function screenshot({ origin, storyId, outDir, viewport, capture, projectDir, wantBoxes, tree, log }) {
  const pw = await loadPlaywright([process.cwd(), projectDir].filter(Boolean));
  if (!pw) {
    log("playwright not installed — skipping screenshots (tree and warnings above are still valid)");
    log("  to enable: npm i -D playwright-core");
    return [];
  }
  // playwright-core is CJS, so an ESM import puts its exports under `.default`.
  const chromium = pw.chromium ?? pw.default?.chromium;
  if (!chromium) {
    log("playwright loaded but exposes no chromium export — skipping screenshots");
    return [];
  }

  const [w, h] = viewport.split("x").map(Number);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...chromiumOverride() });
  } catch (err) {
    // A project pinning a different Playwright version than the installed browsers is common;
    // retry against whatever Chromium is actually on disk before giving up.
    const fallback = findInstalledChromium();
    if (fallback) {
      try {
        browser = await chromium.launch({ headless: true, executablePath: fallback });
        log(`launched Chromium via fallback ${fallback}`);
      } catch (err2) {
        log(`could not launch Chromium — skipping screenshots (${err2.message.split("\n")[0]})`);
        return [];
      }
    } else {
      log(`could not launch Chromium — skipping screenshots (${err.message.split("\n")[0]})`);
      return [];
    }
  }

  const written = [];
  try {
    const page = await browser.newPage({ viewport: { width: w || 1280, height: h || 720 } });
    await page.goto(`${origin}/?story=${storyId}`, { waitUntil: "networkidle", timeout: 20_000 });

    const want = (k) => capture === "all" || capture === k;

    if (want("root")) {
      const root = page.locator('[data-ui-claps-path="0"]').first();
      try {
        await root.waitFor({ state: "visible", timeout: 10_000 });
        const p = join(outDir, "frame.png");
        await root.screenshot({ path: p });
        written.push(p);
      } catch {
        log('could not find [data-ui-claps-path="0"] — is the story rendering?');
      }
    }
    if (want("stage")) {
      const p = join(outDir, "stage.png");
      const band = page.locator(".preview-band").first();
      if (await band.count().then((n) => n > 0).catch(() => false)) {
        await band.screenshot({ path: p });
        written.push(p);
      } else {
        // Different preview markup: fall back to the root element plus a margin.
        const box = await page.locator('[data-ui-claps-path="0"]').first().boundingBox().catch(() => null);
        if (box) {
          await page.screenshot({
            path: p,
            clip: {
              x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24),
              width: box.width + 48, height: box.height + 48,
            },
          });
          written.push(p);
        }
      }
    }
    if (want("page")) {
      const p = join(outDir, "page.png");
      await page.screenshot({ path: p, fullPage: true });
      written.push(p);
    }

    // Exact geometry straight from the DOM. This is the whole point: measuring the render from
    // pixels means colour predicates, antialiasing and capture artefacts. boundingBox() has none
    // of those problems, and the renderer tags every node with data-ui-claps-path.
    if (wantBoxes) {
      const raw = await page.$$eval("[data-ui-claps-path]", (nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          const cs = getComputedStyle(n);
          return { path: n.getAttribute("data-ui-claps-path"),
                   x: r.x, y: r.y, width: r.width, height: r.height,
                   // Computed font size lets a checker tell "the box is right but the text inside
                   // it is too small to fill it" — invisible to box geometry alone.
                   fontSize: parseFloat(cs.fontSize) || null };
        }));
      const byPath = pathIndex(tree);
      const root = raw.find((n) => n.path === "0");
      const nodes = raw.map((n) => ({
        ...n,
        name: byPath[n.path]?.name ?? null,
        className: byPath[n.path]?.className ?? null,
        // Panel-relative: what every comparison actually cares about.
        relX: root ? Math.round((n.x - root.x) * 100) / 100 : null,
        relY: root ? Math.round((n.y - root.y) * 100) / 100 : null,
      }));
      const p = join(outDir, "boxes.json");
      writeFileSync(p, JSON.stringify({
        root: root ? { width: root.width, height: root.height } : null,
        nodes,
      }, null, 2));
      written.push(p);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return written;
}

// ---------------------------------------------------------------- main

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    die(EXIT.CONFIG, err.message, "", HELP);
  }
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }
  if (!args.story) die(EXIT.CONFIG, "--story is required.", "", HELP);

  const log = (m) => console.error(`  ${m}`);

  const storyPath = isAbsolute(args.story) ? args.story : resolve(process.cwd(), args.story);
  if (!existsSync(storyPath)) die(EXIT.CONFIG, `Story file not found: ${storyPath}`);
  const storyReal = realpathSync(storyPath);

  let configPath = null;
  let binary = null;
  let origin = args.url;

  if (!origin) {
    configPath = args.config
      ? resolve(process.cwd(), args.config)
      : findConfig(dirname(storyReal));
    if (!configPath || !existsSync(configPath)) {
      die(
        EXIT.CONFIG,
        "No ui-claps.config.ts found by walking up from the story file.",
        "Pass --config <path>, or --url <origin> to use a running server.",
        "See references/storyblox-setup.md for a minimal scaffold.",
      );
    }
    binary = findStorybloxBinary(args.storyblox);
    if (args.storyblox && !binary) die(EXIT.CONFIG, `--storyblox path not found: ${args.storyblox}`);
    preflight(configPath, binary, log);
    origin = `http://localhost:${readPort(configPath)}`;
  }

  const { manifest, child } = await ensureServer(origin, configPath, binary, log);

  for (const w of manifest.warnings ?? []) console.error(`  manifest warning: ${w}`);

  const story =
    manifest.stories.find((s) => {
      try { return realpathSync(s.filePath) === storyReal; } catch { return s.filePath === storyReal; }
    }) ??
    manifest.stories.find((s) => s.id === createHash("sha1").update(storyReal).digest("hex").slice(0, 12));

  if (!story) {
    if (child && !args.keepAlive) child.kill();
    die(
      EXIT.CONFIG,
      `Story not found in the manifest: ${storyReal}`,
      "The file must sit under storyRoot (defaults to root) and match a story pattern.",
      "",
      "Discovered stories:",
      ...manifest.stories.map((s) => `  ${s.id}  ${s.relativePath}`),
    );
  }
  log(`story ${story.id}  ${story.relativePath}`);

  let props;
  try {
    props = JSON.parse(args.props);
  } catch (err) {
    if (child && !args.keepAlive) child.kill();
    die(EXIT.CONFIG, `--props is not valid JSON: ${err.message}`);
  }

  const res = await fetch(`${origin}/api/render`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storyId: story.id, props }),
  });
  const render = await res.json();

  const outDir = isAbsolute(args.outDir) ? args.outDir : resolve(process.cwd(), args.outDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "render.json"), JSON.stringify(render, null, 2));

  if (args.json) {
    console.log(JSON.stringify(render, null, 2));
  } else {
    log(render.ok ? "render ok" : "render FAILED");
    console.log("");
    if (render.tree) console.log(renderTree(render.tree).join("\n"));

    const warnings = render.warnings ?? [];
    if (warnings.length) {
      console.log(`\nwarnings (${warnings.length}):`);
      for (const w of warnings) console.log(`  · ${w}`);
    }
    const output = render.output ?? [];
    if (output.length) {
      console.log("\noutput:");
      for (const o of output) console.log(`  [${o.level}] ${o.message}`);
    }
    if (render.error) {
      console.log(`\nerror: ${render.error.message}`);
      if (render.error.stack) console.log(render.error.stack);
    }
  }

  let shots = [];
  if (render.ok && (args.capture !== "none" || args.boxes)) {
    shots = await screenshot({
      origin, storyId: story.id, outDir, viewport: args.viewport, capture: args.capture,
      projectDir: configPath ? dirname(configPath) : null, wantBoxes: args.boxes,
      tree: render.tree, log,
    });
  }

  console.log("");
  for (const p of [...shots, join(outDir, "render.json")]) console.log(`→ ${p}`);

  if (child && !args.keepAlive) {
    child.kill();
  } else if (child) {
    log(`server left running (pid ${child.pid})`);
  }

  if (!render.ok) process.exit(EXIT.RENDER);
  if (args.strict && (render.warnings ?? []).length) process.exit(EXIT.RENDER);
  process.exit(EXIT.OK);
}

main().catch((err) => {
  console.error(err.stack ?? String(err));
  process.exit(EXIT.RENDER);
});
