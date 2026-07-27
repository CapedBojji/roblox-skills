---
name: roblox-frame-identification
description: Take a reference — a screenshot of a Roblox UI, an existing instance tree (.rbxmx, .rbxlx, or a Studio selection paste), or a plain-text description — identify the single frame or panel that is the subject, isolate it from its content, rebuild it as a StoryBlox .story.luau, and verify it against the live browser preview. Use this whenever someone says "recreate this UI", "rebuild this panel", "match this screenshot", "clone this shop/inventory/settings/quest menu", "identify the frame in this image", "turn this into a story", "convert this rbxmx", or attaches an image, .rbxmx, .rbxlx, or Studio-copied instance tree of Roblox GUI. Also use for any StoryBlox work at all — writing or fixing .story.luau files, running the storyblox dev server, reading /api/render output, or chasing renderer warnings. Read the roblox-ui-fundamentals skill first; every UDim2 this produces depends on it.
---

# Identify, isolate, replicate, verify

Read `../roblox-ui-fundamentals/SKILL.md` first. If it is unavailable, this is the minimum:

> Everything floats — absolute positioning is the default, not an escape hatch. `Position` and `Size`
> are `UDim2 = {scale, offset}` per axis; scale is a fraction of the **parent**, offset is pixels,
> and they add. Scale sizing *is* the responsiveness — no breakpoints, ever. `AnchorPoint` decides
> which point of an element sits at `Position`; centering is `fromScale(0.5, 0.5)` +
> `AnchorPoint (0.5, 0.5)`. Reach for a layout only when the child count comes from data — and once a
> parent has a layout, its children's `Position` is ignored.

## The pipeline

| Phase | Input | Output | Do not move on until |
|---|---|---|---|
| 1. Identify | screenshot / instance tree / description | subject sentence + reference resolution | you can name the panel in one sentence |
| 2. Isolate | the subject | Included **and Excluded** tables | every ambiguous element has a verdict *and* the test that decided it |
| 3. Spec | both tables | `<Name>.frame.md` | every node row has Class, Size, Position, AnchorPoint |
| 4. Replicate | the spec | `<Name>.story.luau` | the file appears in `GET /api/project` |
| 5. Verify | the story | `frame.png` + tree + warnings | the silhouette matches, or the remaining deltas are written down |

Never skip from phase 1 to phase 4. The isolation decision is what this skill exists for, and it has
to be visible before it is encoded in Luau.

## Phase 1 — Identify

All three input types converge on the same spec; only the `Reference` section and the confidence
markers differ.

- **Screenshot** → `references/input-screenshot.md`. The critical step is establishing the *screen*
  resolution, because that is what makes the output scale-correct rather than pixel-hardcoded. Then
  measure children **relative to the panel**, not to the screen.
- **Instance tree** (`.rbxmx` / `.rbxlx` / Studio paste) → `references/input-instance-tree.md`. The
  UDim2 values already exist, so this is **pruning, not measuring**. Extract, never estimate.
- **Text description** → `references/input-description.md`. Nothing exists yet, so identification is
  *decision*. Pick an archetype, use the documented default geometry, and list every choice so the
  user can correct it in one pass.

If two panels are on screen, pick one: the one with the strongest containment (others sit inside or
in front of it), or the one the user pointed at. State the choice and list what you rejected. Never
merge two panels into one story.

## Phase 2 — Isolate

> **The frame is what survives when the data is empty. The content is what varies with the data.**
> When ambiguous: **keep the container, drop the fill.**

Three tests, in order. The first clean verdict wins.

1. **Empty-state test.** Picture this panel with zero data — an inventory with no items, a shop with
   nothing for sale. What is still on screen is **frame**. What vanished is **content**. This settles
   most elements immediately.
2. **Scroll test.** Scroll the body. What moves is **content**; what stays pinned is **frame**. A
   section header that scrolls away with its group is content; the divider under the title bar is
   frame.
3. **Count test.** If the number of these depends on data, it is **content**. If it is authored and
   fixed, it is **frame**.

The boundary is not a rectangle — it is a **cut across the tree**. You include a container and stop
descending. Write the cut explicitly:

```
ScrollingFrame "ItemList" — INCLUDED (container), children EXCLUDED (one per item)
```

**The one-placeholder rule.** For every excluded content region, build **exactly one** neutral
stand-in child: flat mid-grey, no text, correct size, named `Placeholder`. It makes the container's
`UIPadding`, `UIListLayout.Padding` and `UIGridLayout.CellSize` provable in the preview. Never build
two. Never style it to match the reference — it is not content, it is a ruler.

The cases that come up most:

| Element | Verdict | Test |
|---|---|---|
| Header bar, title text, header icon | **FRAME** | empty-state |
| Close (X) button | **FRAME** | empty-state |
| Content container (`ScrollingFrame` / body `Frame`) | **FRAME**, then cut | empty-state |
| List items, cards, inventory slots, rows | **CONTENT** | count |
| Scrollbar | **FRAME — and not an instance.** It is `ScrollBarThickness` / `ScrollBarImageColor3` / `ScrollBarImageTransparency` on the `ScrollingFrame` | it is a property |
| Footer button row | **FRAME** if a fixed set (OK/Cancel); **CONTENT** if one per item | count |
| Tab strip | strip **FRAME**; tabs **FRAME** if authored, **CONTENT** if data-driven. Selection is a control prop, not structure | count |
| Backdrop / dim overlay | **OUT OF SCOPE** — it is a sibling belonging to the `ScreenGui`, not part of the panel. Record it under `Context` | ancestor-level |
| Tooltip / popover / stacked confirm dialog | **OUT** — a separate frame; run its own pass if asked | not present in the empty state |

The full ~24-row catalogue, the two-panel procedure, and worked tree cuts for three archetypes are in
`references/boundary-rules.md`.

> **Placing the elements.** Once the boundary is settled, use the `roblox-element-placement` skill
> for each element's purpose, owning frame and position — especially anything near an edge. Chrome
> that straddles or hangs outside the frame is normal in Roblox and is the placement most easily got
> wrong; `../roblox-element-placement/scripts/place.mjs` decides it from signed edge deltas rather than by eye.

## Phase 3 — The frame spec

Write `<storyRoot>/<Name>.frame.md` next to the story it will produce. Template and a fully worked
example: `references/frame-spec-template.md`.

Three hard requirements:

1. Every node row has `Size`, `Position` **and** `AnchorPoint`. No blanks.
2. The **Excluded table is never empty.** If the frame genuinely has no data-driven content, write
   "none — this frame has no data-driven content" explicitly. An empty table means you skipped the
   step.
3. Every number carries a confidence marker: `[M]`easured, `[E]`stimated, `[X]`tracted, `[C]`hosen.

Markdown, not JSON: this is the artifact a *human* reviews and the boundary decision is prose. A JSON
IR would need a schema and a validator, and would tempt you into writing a JSON-to-Luau converter
instead of writing the story. The story file already *is* the structured representation.

## Phase 4 — Write the story

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
      -- ...
    })
  end,
}
```

Conventions:

- One frame per file, at `<storyRoot>/<PascalName>.story.luau`, spec beside it as `<PascalName>.frame.md`.
- **Use the adapter.** `UI.create(className, props, children)` maps 1:1 onto the spec's tree block, and
  `UI.control.*` is how controls are declared. Plain `Instance.new` also works but produces imperative
  code that no longer resembles the spec.
- `UDim2`, `UDim`, `Color3`, `Vector2`, `Enum` and `Font` are **injected as globals** in the worker.
  Write them directly — no require.
- **The story's root must BE the frame.** Do not wrap it in a titled demo stage the way
  `demo/src/RobloxUI/*.story.luau` does — those exist to document one class each. Two concrete
  reasons: the verify script screenshots `[data-ui-claps-path="0"]`, which is the root node; and the
  renderer gives the root `position: relative` and **ignores its `Position`** (only `Size` is
  honored). The panel's on-screen placement therefore lives in the spec's Geometry section, not in
  the story.
- **Default control values must reproduce the reference exactly.** The screenshot renders with
  defaults — the preview URL carries `?story=<id>` but no props.
- If the directory has no `*.storybook.luau`, stories are grouped as "Unknown Stories". A one-line
  `return { name = "UI" }` in a `UI.storybook.luau` fixes that.

## Phase 5 — Verify

```bash
# render + screenshot in one shot
node <skill>/scripts/preview.mjs --story src/UI/ShopPanel.story.luau --out .storyblox-verify

# with the standalone binary (v0.1.1+, bundles Zune — nothing else to install)
node <skill>/scripts/preview.mjs --story src/UI/ShopPanel.story.luau \
     --storyblox ./storyblox --out .storyblox-verify

# then read .storyblox-verify/frame.png against the reference
```

`preview.mjs` prints the resolved instance tree, the renderer warnings, and any `print`/`warn` output
from the story, and writes `frame.png`, `stage.png`, `page.png` and `render.json`. It exits non-zero
on a render error, so a failure cannot pass silently. `--help` documents every flag.

**Getting a server up:** the standalone binary from the StoryBlox releases page bundles Zune and
needs no Node or `node_modules` — download it, `chmod +x`, done. On the npm or source-checkout path
Zune *is* a hard precondition; the dev server refuses to boot without it.

Setup, the manual `curl` equivalent, the minimal four-file scaffold for a project that has no
StoryBlox yet, the automation API, and the full troubleshooting table are in
`references/storyblox-setup.md`.

**For interactive states**, the binary also exposes an automation API (discover it via
`GET /api/automation-info`) whose tree carries stable node ids and an `actions` list, and which can
click, hover, scroll and focus. Frame identification rarely needs it — the frame is static chrome —
but reach for it to verify a hover style, a selected tab, or a scrolled position.

### Compare in this order

Fix in priority order; do not jump to detail while the silhouette is wrong.

1. **Silhouette** — is the panel's bounding box and aspect right?
2. **Structure** — same regions, same places, same relative sizes?
3. **Alignment** — do edges and anchors line up? This is where `AnchorPoint` bugs surface.
4. **Color** — sample and correct the `Color3` values.
5. **Type** — sizes, weights, alignment.
6. **Detail** — radii, strokes, gradients.

**Stop after three iterations.** Then write the remaining deltas into the spec's `Assumptions`
section, marking which are renderer divergences and which are real mismatches. Do not loop.

### Renderer divergences — do not chase these

StoryBlox is a DOM approximation, not a pixel-exact emulator. These differences are expected and
trying to fix them will waste the whole session:

- **`rbxassetid://` images do not load.** Only `http://` and `https://` URLs render as real images;
  everything else renders as a grey text placeholder showing the asset string. Icon-heavy frames
  *will* look wrong and that is correct behavior. To check layout around an icon, temporarily
  substitute a solid `Frame` of the same size.
- **Fonts differ.** The preview uses a web font stack, not Roblox's. Text metrics are close but not
  exact — do not tune `TextSize` to make wrapping match.
- **`UIStroke` renders as a CSS outline** and will not follow `UICorner` radius identically.
- **`ViewportFrame` and `VideoFrame` are always placeholders.**
- **`UIGridLayout` / `UITableLayout` / `UIPageLayout` are emulated** in flexbox; wrap points and
  leftover-space distribution can differ from Studio.
- **`Rotation` combined with `ClipsDescendants`** behaves differently than Studio.
- **`SortOrder` and `Font`/`FontFace` are not in the renderer's supported-property list.** They are
  valid Roblox and belong in your real code — they just will not affect the preview and will show up
  as warnings.
- **There is no pixel-diff tooling, deliberately.** The compare step is you reading two images. A
  pixel diff against an approximating renderer would report noise as failure.

## References

- `references/boundary-rules.md` — the full verdict catalogue, two-panel disambiguation, worked tree cuts
- `references/frame-spec-template.md` — blank template plus one fully worked example
- `references/input-screenshot.md` — measurement procedure, resolution inference, color caveats
- `references/input-instance-tree.md` — XML property decoding, enum tokens, the prune list, compatibility check
- `references/input-description.md` — six archetypes with default geometry and palettes
- `references/storyblox-setup.md` — scaffold, zune install, manual loop, troubleshooting, flag reference
