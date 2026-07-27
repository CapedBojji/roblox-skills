#!/usr/bin/env node
// Diff a rendered frame's geometry against the reference measurements, numerically.
// Part of the roblox-element-placement skill.
//
// Why this exists: comparing a render to a reference by eye reliably catches wrong colours and
// reliably MISSES an 11px vertical error. Geometry gets measured; eyes are for colour and type.
//
// The render side comes from `preview.mjs --boxes`, which reads each node's exact DOM bounding box.
// No colour predicates, no antialiasing, no capture artefacts.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const HELP = `
verify-placement.mjs — diff rendered geometry against reference measurements

  node verify-placement.mjs --boxes <boxes.json> --reference <ref.json> [options]

Options
  --boxes <path>       boxes.json from \`preview.mjs --boxes\`. Required.
  --reference <path>   Reference measurements (see below). Required.
  --tolerance <px>     Max allowed delta for non-text elements. Default: 4
  --text-tolerance     Max allowed delta for text ink height. Default: 8
  --json               Emit JSON instead of the report.
  -h, --help           This text.

Reference file:
  {
    "frame": [x0, y0, x1, y1],
    "elements": { "HeaderIcon": [74,76,121,132], "Title": [135,75,400,123] },
    "text": ["Title"]
  }

Boxes in reference pixels. Names must match the instance Name in the story.

Elements listed in "text" carry an extra check. A reference measurement of text is its INK, so the
convention for replication is: **set the TextLabel's box to the measured ink box**, and position the
ink inside it with TextXAlignment / TextYAlignment. That makes the box directly comparable.

Text WIDTH is never compared: the same string at the same cap height occupies a different width in
a condensed display face than in the preview's font stack. Left edge, top edge and ink height are
real geometry; width is not. Size text boxes wide enough for the widest font you expect.

On top of the box geometry, text elements are checked for whether the glyphs actually FILL that box:
implied cap height (computed fontSize x 0.72) is compared against the reference ink height. A box in
exactly the right place whose text is half the intended size is a real defect that box geometry alone
cannot see.

Exits non-zero if any element is outside tolerance.
`.trim();

function parseArgs(argv) {
  const out = { tolerance: 4, textTolerance: 8, json: false, help: false };
  const keys = { "--boxes": "boxes", "--reference": "reference", "--tolerance": "tolerance", "--text-tolerance": "textTolerance" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--json") out.json = true;
    else if (keys[a]) {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${a} requires a value.`);
      out[keys[a]] = v;
      i += 1;
    } else throw new Error(`Unknown argument: ${a}`);
  }
  out.tolerance = Number(out.tolerance);
  out.textTolerance = Number(out.textTolerance);
  return out;
}

const r2 = (n) => Math.round(n * 10) / 10;

export function compare(boxesDoc, refDoc, tolerance = 4, textTolerance = 8) {
  const [fx0, fy0, fx1, fy1] = refDoc.frame;
  const refW = fx1 - fx0;
  const refH = fy1 - fy0;
  const renderW = boxesDoc.root?.width;
  if (!renderW) throw new Error("boxes.json has no root node — did the story render?");

  // A render at a different size is still comparable once both are panel-relative and scaled.
  const scale = renderW / refW;
  const textSet = new Set(refDoc.text ?? []);
  const byName = new Map();
  for (const n of boxesDoc.nodes) if (n.name) byName.set(n.name, n);

  const rows = [];
  for (const [name, box] of Object.entries(refDoc.elements ?? {})) {
    const [x0, y0, x1, y1] = box;
    const node = byName.get(name);
    if (!node) {
      rows.push({ name, missing: true, pass: false });
      continue;
    }
    const isText = textSet.has(name);
    const ref = {
      left: (x0 - fx0) * scale, top: (y0 - fy0) * scale,
      cx: ((x0 + x1) / 2 - fx0) * scale, cy: ((y0 + y1) / 2 - fy0) * scale,
      w: (x1 - x0) * scale, h: (y1 - y0) * scale,
    };
    const got = {
      left: node.relX, top: node.relY,
      cx: node.relX + node.width / 2, cy: node.relY + node.height / 2,
      w: node.width, h: node.height,
    };
    // Text WIDTH is font-dependent: the same string at the same cap height occupies a different
    // width in a condensed display face than in the preview's stack. Left edge, top edge and ink
    // height are real geometry; width is not, so it is not compared for text.
    const fields = isText ? ["left", "top", "h"] : ["left", "top", "w", "h"];
    const checks = fields.map((f) => {
      const delta = got[f] - ref[f];
      return { field: f, ref: r2(ref[f]), got: r2(got[f]), delta: r2(delta), pass: Math.abs(delta) <= tolerance };
    });
    // Does the text actually fill its box? Cap height is ~0.72 of font size for most faces; the
    // comparison is deliberately loose (textTolerance) because faces differ, but a title rendering
    // at 2/3 the intended size fails it decisively.
    if (isText && node.fontSize) {
      const capHeight = node.fontSize * 0.72;
      const delta = capHeight - ref.h;
      checks.push({
        field: "ink", ref: r2(ref.h), got: r2(capHeight), delta: r2(delta),
        pass: Math.abs(delta) <= textTolerance, note: `fontSize ${r2(node.fontSize)}px`,
      });
    }
    rows.push({ name, isText, checks, pass: checks.every((c) => c.pass) });
  }
  return { scale: r2(scale), refFrame: { w: refW, h: refH }, renderFrame: { w: renderW, h: boxesDoc.root.height }, rows };
}

function report(result, tolerance, textTolerance) {
  const L = [];
  L.push(`reference frame ${result.refFrame.w}x${result.refFrame.h}  ->  render ${Math.round(result.renderFrame.w)}x${Math.round(result.renderFrame.h)}  (scale ${result.scale})`);
  L.push(`tolerance ${tolerance}px, text ink height ${textTolerance}px\n`);
  const label = { left: "left", top: "top", w: "width", h: "height", ink: "ink height" };
  for (const row of result.rows) {
    if (row.missing) {
      L.push(`${row.name.padEnd(16)} MISSING from the render — no node with that Name`);
      continue;
    }
    L.push(`${row.name}${row.isText ? "   [text: box must equal the measured ink box]" : ""}`);
    for (const c of row.checks) {
      const mark = c.pass ? "ok  " : "FAIL";
      const d = `${c.delta >= 0 ? "+" : ""}${c.delta}`;
      L.push(`  ${label[c.field].padEnd(10)} ref ${String(c.ref).padStart(7)}   render ${String(c.got).padStart(7)}   Δ ${d.padStart(6)}   ${mark}${c.note ? "   " + c.note : ""}`);
    }
    L.push("");
  }
  const failed = result.rows.filter((r) => !r.pass);
  L.push(failed.length
    ? `${failed.length} element(s) outside tolerance: ${failed.map((r) => r.name).join(", ")}`
    : "all elements within tolerance");
  return L.join("\n");
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (err) { console.error(err.message, "\n\n" + HELP); process.exit(2); }
  if (args.help) { console.log(HELP); process.exit(0); }
  if (!args.boxes || !args.reference) { console.error("--boxes and --reference are required.\n\n" + HELP); process.exit(2); }

  const p = (v) => (isAbsolute(v) ? v : resolve(process.cwd(), v));
  for (const [flag, v] of [["--boxes", args.boxes], ["--reference", args.reference]]) {
    if (!existsSync(p(v))) { console.error(`${flag} not found: ${p(v)}`); process.exit(2); }
  }

  let result;
  try {
    result = compare(
      JSON.parse(readFileSync(p(args.boxes), "utf8")),
      JSON.parse(readFileSync(p(args.reference), "utf8")),
      args.tolerance, args.textTolerance,
    );
  } catch (err) { console.error(err.message); process.exit(2); }

  console.log(args.json ? JSON.stringify(result, null, 2) : report(result, args.tolerance, args.textTolerance));
  process.exit(result.rows.every((r) => r.pass) ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
