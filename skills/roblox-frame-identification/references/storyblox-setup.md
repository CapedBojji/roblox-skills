# StoryBlox setup, API and troubleshooting

[StoryBlox](https://github.com/CapedBojji/storyblox) discovers `.story.luau` modules, evaluates them
with the [Zune](https://zune.sh/) Luau runtime, and renders the returned Roblox instance tree to
DOM/CSS in a browser.

## Install

**Use the standalone binary (v0.1.1+).** It bundles Zune, so there is nothing else to install — no
Node, no `node_modules`, no Zune on `PATH`. It extracts its own Zune to a temp directory at startup
and points `zuneCommand` at it.

```bash
# linux-x64; swap for your platform
curl -sSL -o storyblox \
  https://github.com/CapedBojji/storyblox/releases/download/v0.1.1/storyblox-linux-x64
chmod +x storyblox
./storyblox dev --config ui-claps.config.ts
```

Assets are published per platform: `storyblox-linux-x64`, `storyblox-linux-arm64`,
`storyblox-darwin-x64`, `storyblox-darwin-arm64`, `storyblox-windows-x64.exe`,
`storyblox-windows-arm64.exe`, plus `storyblox.vsix` for the VS Code extension. Verify the download
against the `digest` on the release asset.

**From a source checkout** (the package is not on the public npm registry, so `npx storyblox`
404s unless you have it linked locally), Zune *is* a separate prerequisite:

```bash
node -v                 # 22+
zune --version          # required on this path only
test -d node_modules    # pnpm install
ls ui-claps.config.ts
```

On that path `startDevServer` checks for Zune and throws before binding a port, so there is no
render path at all without it. Install from <https://zune.sh/>, or `mise use zune@0.5.7`, or set
`zuneCommand` in the config to an absolute path.

One gotcha with the binary: a config that imports `defineConfig` from a *source-relative* path
(`"./src/node/index.js"`, as the StoryBlox repo's own `ui-claps.config.ts` does) fails inside the
bundle. Either import from `"storyblox"` or skip the helper entirely — a plain object export works:

```ts
export default { root: "src", rojoProject: "default.project.json", port: 4500, open: false };
```

## The config

```ts
import { defineConfig } from "storyblox";

export default defineConfig({
  root: "src",                          // REQUIRED — source project root
  rojoProject: "default.project.json",  // REQUIRED — read on every render
  storyRoot: "out",                     // optional; defaults to `root`
  storyPatterns: ["**/*.story.luau"],   // optional
  storybookPatterns: ["**/*.storybook.luau"],
  aliases: { "@app": "src" },           // optional; maps require paths
  zuneCommand: "zune",                  // optional
  port: 4500,                           // optional
  open: false,                          // set false for headless work
});
```

Defaults: `storyRoot` = `root`, `zuneCommand` = `"zune"`, `port` = `4500`, `open` = **`true`**
(it will pop a browser window — set it to `false` when scripting).

Story patterns default to `**/*.story.lua`, `**/*.story.luau`, `**/*.stories.lua`,
`**/*.stories.luau`. All paths resolve relative to the config file's directory.

For a `roblox-ts` project, compile to Luau first and point `storyRoot` at the output directory.

## Minimal scaffold, for a project with no StoryBlox

Four files:

**`ui-claps.config.ts`** — a plain object, so it works under the standalone binary too:
```ts
export default {
  root: "src",
  rojoProject: "default.project.json",
  port: 4500,
  open: false,
};
```

**`default.project.json`** — required, and parsed on every render, so it must be valid:
```json
{
  "name": "FrameStories",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "$path": "src"
    }
  }
}
```

**`src/UI/UI.storybook.luau`** — optional, but without it stories land under "Unknown Stories":
```lua
return { name = "UI" }
```

**`src/UI/<Name>.story.luau`** — the frame itself.

Then `./storyblox dev --config ui-claps.config.ts` with the standalone binary, or from a source
checkout: `npx tsx src/node/cli.ts dev --config <abs path>`.

This exact four-file scaffold is verified working against the v0.1.1 linux-x64 binary with no Zune
on `PATH`.

## The story format

```lua
local UI = require("@ui-claps/adapter")

return {
  name = "Shop Panel",
  controls = {
    title = UI.control.string("SHOP"),
    accent = UI.control.color(Color3.fromRGB(56, 189, 248)),
  },
  render = function(props)
    return UI.create("Frame", {
      Name = "ShopPanel",
      Size = UDim2.fromScale(0.458, 0.667),
      BackgroundColor3 = Color3.fromRGB(24, 28, 38),
      BorderSizePixel = 0,
    }, {
      UI.create("UICorner", { CornerRadius = UDim.new(0, 12) }),
    })
  end,
}
```

The adapter is optional — `render` may build with `Instance.new` and return the root instance — but
`UI.create` mirrors the spec's tree block and is the only way to declare controls.

`UDim2`, `UDim`, `Color3`, `Vector2`, `Enum` and `Font` are injected as globals in the worker. No
require needed.

### Controls

| Constructor | Signature |
|---|---|
| `UI.control.string` | `(default, options?)` |
| `UI.control.boolean` | `(default, options?)` |
| `UI.control.number` | `(default, options?)` |
| `UI.control.slider` | `(default, min, max, step, options?)` |
| `UI.control.color` | `(default, options?)` |
| `UI.control.select` | `(default, { options = { {label=, value=}, … } })` |
| `UI.control.radio` | `(default, options?)` |
| `UI.control.check` | `(default, options?)` |
| `UI.control.multiselect` | `(default, options?)` |
| `UI.control.object` | `(default, options?)` |
| `UI.control.udim` | `(default, options?)` |
| `UI.control.udim2` | `(default, options?)` — accepts `{ offsetStep = 4 }` |

`options` takes `{ label = "…" }` for the control's display name.

**Control defaults must reproduce the reference exactly** — the verification screenshot renders with
defaults, since the preview URL carries `?story=<id>` but no props.

## HTTP API

The dev server exposes three endpoints on the configured port.

### `GET /api/project`

The manifest: `zuneCommand`, `stories[]`, `storybooks[]`, `warnings[]`. Each story carries
`id`, `name`, `filePath` (absolute), `relativePath`, `group`, `controls`.

`warnings[]` carries per-story manifest evaluation failures — check it when a story appears with the
wrong name or no controls.

### `POST /api/render`

```bash
curl -s -X POST localhost:4500/api/render \
  -H 'content-type: application/json' \
  -d '{"storyId":"3f9a1c2b7e04","props":{}}'
```

Returns:

```ts
{
  ok: boolean,
  tree?: { className, name?, props, children[] },   // RobloxVNode
  warnings: string[],                               // unsupported classes/props
  output?: [{ level: "print" | "warn", message }],  // print/warn from the story
  error?: { message, stack? },
}
```

### `GET /api/events`

Server-sent events for hot reload. Not needed for verification.

## The automation API (v0.1.1+)

The binary also starts a second server aimed squarely at agents. Discover it rather than assuming
the port:

```bash
curl -s localhost:4500/api/automation-info      # -> {"baseUrl":"http://127.0.0.1:4701"}
```

Its tree is **richer than `/api/render`'s**: every node carries a stable `id`, a populated `name`,
`visible`, `enabled`, `text`, and an `actions` list of what that node accepts (`click`, `hover`,
`drag`, `scroll`, `focus`, `blur`, `activate`, `pointer-*`, `key`).

| Endpoint | Method | Body / result |
|---|---|---|
| `/api/automation/sessions` | GET | `{ sessions: [...] }` — live sessions with tree, controls, revision |
| `/api/automation/sessions` | POST | `{ storyId }` → a session `{ sessionId, tree, controls, revision, warnings, output }` |
| `/api/automation/sessions/:id` | GET | current session state |
| `/api/automation/sessions/:id/query` | POST | `{ name: "Buy" }` → `{ matches: [...] }`. Needs at least one filter |
| `/api/automation/sessions/:id/actions` | POST | `{ action: { type, target: { nodeId } } }` → the updated session, `revision` bumped |
| `/api/automation/sessions/:id/events` | GET | SSE stream |

```bash
B=$(curl -s localhost:4500/api/automation-info | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).baseUrl')
SID=$(curl -s -X POST -H 'content-type: application/json' -d '{"storyId":"<id>"}' \
      $B/api/automation/sessions | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).sessionId')

curl -s -X POST -H 'content-type: application/json' -d '{"name":"Buy"}' $B/api/automation/sessions/$SID/query
curl -s -X POST -H 'content-type: application/json' \
     -d '{"action":{"type":"click","target":{"nodeId":"node-15"}}}' $B/api/automation/sessions/$SID/actions
```

Note the shapes — the action must be **nested under `action`**, and the target is an **object with
`nodeId`**, not a bare string. A bare string returns an internal error rather than a helpful message.

For frame identification, `/api/render` is enough: the frame is static chrome and you want the
resolved tree plus warnings. Reach for the automation API when you need to verify a state the
default render cannot show — a hover style, a selected tab, a scrolled position, a focused
`TextBox`.

### Story ids

`id = sha1(absoluteFilePath).slice(0, 12)`. Not derivable from the filename — always resolve it from
`/api/project` rather than computing it by hand.

## The manual loop, when `preview.mjs` cannot run

```bash
pnpm run dev &        # or: npx storyblox dev --config ui-claps.config.ts

# list stories with their ids
curl -s localhost:4500/api/project \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const p=JSON.parse(s);
      for (const st of p.stories) console.log(st.id, st.relativePath);
      for (const w of p.warnings) console.error("manifest warning:", w);
    })'

# render one
curl -s -X POST localhost:4500/api/render \
  -H 'content-type: application/json' \
  -d '{"storyId":"<id>","props":{}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const r=JSON.parse(s);
      console.log("ok:", r.ok);
      if (r.error) console.error(r.error.message);
      for (const w of r.warnings ?? []) console.error("warning:", w);
      console.log(JSON.stringify(r.tree, null, 2));
    })'

# screenshot: open http://localhost:4500/?story=<id> and capture [data-ui-claps-path="0"]
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `UI Claps requires Zune to execute Luau stories` | Zune not on PATH | Install from <https://zune.sh/>, or `mise use zune@0.5.7`, or set `zuneCommand` to an absolute path. There is no render path without it |
| `Cannot find module 'express'` | deps not installed | `pnpm install`, or use the standalone binary |
| `npm error 404 'storyblox@*' is not in this registry` | `npx storyblox` fallback; not published to npm | use the standalone binary, or `--url` against a server you started |
| `ENOENT: … open '/package.json'` from the binary | config imports `defineConfig` from a source-relative path | import from `"storyblox"`, or export a plain object |
| `UI Claps config was not found at …` | wrong cwd, or no config | pass `--config <abs path>`, or scaffold above |
| `ui-claps.config.ts must set root to a source directory.` | missing `root` | it is required |
| `ui-claps.config.ts must set rojoProject to a Rojo project file.` | missing `rojoProject` | it is required, and read on every render |
| `EADDRINUSE :4500` | a server is already running | reuse it — `preview.mjs` does automatically — or change `port` |
| A browser window pops open | `open` defaults to `true` | set `open: false` |
| Story missing from `/api/project` | pattern or root mismatch | the file must sit under `storyRoot` (defaults to `root`) and match a story pattern |
| Story listed but wrong name / no controls | manifest evaluation failed | read `project.warnings[]` — it carries the Luau error per story |
| Grouped under "Unknown Stories" | no `*.storybook.luau` in the directory | add `return { name = "UI" }` |
| `render.ok === false` | Luau error inside `render()` | `error.message` and `error.stack` are in the response |
| Icons render as grey text | `rbxassetid://` is not fetchable | expected — only `http(s)://` images load. Substitute a solid `Frame` to check layout |

## `preview.mjs` flags

```
node preview.mjs --story <path/to/X.story.luau>
                 [--config <ui-claps.config.ts>]  # default: walk up from --story
                 [--url <http://host:port>]       # target an already-running server
                 [--storyblox <path>]             # standalone binary to launch (bundles Zune)
                 [--props '<json>']               # default: {}
                 [--out <dir>]                    # default: .storyblox-verify
                 [--viewport <WxH>]               # default: 1280x720
                 [--capture root|stage|page|all]  # default: all
                 [--strict]                       # non-zero exit if any warning
                 [--keep-alive]                   # leave a server we started running
                 [--json]                         # raw JSON instead of the summary
```

Exit codes: `0` ok · `1` render error, or `--strict` with warnings · `2` the server reported Zune
missing · `4` bad arguments, or config/Rojo project missing or invalid · `5` server never became
ready.

Zune and `node_modules` are no longer preflight failures — the script warns and lets the server's own
startup decide, since the standalone binary needs neither. `--storyblox <path>` (or a `storyblox` on
`PATH`) makes it launch the binary instead of `npx storyblox`.

**`--props` affects `render.json` only, not the screenshot** — the preview URL has no props channel.
That is why control defaults must match the reference.
