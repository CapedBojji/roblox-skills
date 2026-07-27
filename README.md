# roblox-skills

Claude skills for Roblox UI development.

These exist because agents trained on web UI carry the wrong mental model into Roblox. They reach for
document flow, breakpoints, and media queries. Roblox UI floats — every element is absolutely
positioned by default — and sizes in `UDim2` scale/offset pairs, which makes most web-style
responsiveness unnecessary rather than merely different.

## Skills

### `roblox-ui-fundamentals`

The mental model, written to displace CSS instincts rather than sit alongside them.

- everything floats; absolute positioning is the default, not an escape hatch
- `UDim2 = {scale, offset}` per axis — scale is a fraction of the **parent**, offset is pixels, and
  they add
- scale sizing **is** the responsiveness: the desktop layout is the mobile layout, shrunk
- `AnchorPoint`, and why centering with negative offsets is a trap
- where scale-only genuinely isn't enough — text, stroke and radius, extreme aspect ratios, touch
  targets, safe areas
- when `UIListLayout` / `UIFlexItem` / `UISizeConstraint` **are** the right call
- a full CSS-to-Roblox translation table, and an anti-pattern catalogue

### `roblox-element-placement`

Element by element: what each icon, label, badge and button is *for*, which frame **owns** it, and
where it sits relative to that frame.

Exists to stop two specific errors that web instincts produce:

- **Assuming an element is inside the frame it belongs to.** Nothing clips by default in Roblox, so
  chrome routinely *straddles* an edge — a close button whose centre sits on the top-right corner, a
  header badge hanging off the left edge. Placing these inside is a different design, not a rounding
  error.
- **Assuming containment decides ownership.** A button hanging entirely outside a panel still belongs
  to it; a tooltip drawn on top of it belongs to neither.

`scripts/place.mjs` makes this deterministic — give it two bounding boxes and it returns the signed
edge deltas, the placement class, and the exact `Size`/`AnchorPoint`/`Position` to reproduce it:

```sh
node skills/roblox-element-placement/scripts/place.mjs \
  --frame 95,84,961,570 --element 923,78,972,125 --name Close
# CLASS: STRADDLE — 6px past the top edge, 11px past the right edge
# AnchorPoint = Vector2.new(0.5, 0.5)
# Position    = UDim2.new(1, -13, 0, 18)
```

### `roblox-frame-identification`

The first workflow skill: take a reference, isolate one frame, rebuild it, verify it.

1. **Identify** the panel that is the subject — from a screenshot, an existing instance tree
   (`.rbxmx` / `.rbxlx` / a Studio paste), or a plain-text description.
2. **Isolate** it. Include the chrome bound to the frame — header bar, title, icon, close button,
   the content frame *container*. Exclude what's *inside* the content frame. The rule: *the frame is
   what survives when the data is empty; the content is what varies with the data.*
3. **Spec** it as a reviewable markdown frame spec, with an explicit Excluded table.
4. **Replicate** it as a [StoryBlox](https://github.com/CapedBojji/storyblox) `.story.luau`.
5. **Verify** against the live preview — resolved instance tree, renderer warnings, and a screenshot.

## Install

Copy the skills into your Claude skills directory:

```sh
cp -r skills/* ~/.claude/skills/
```

Or per-project, into `.claude/skills/`. `roblox-frame-identification` references
`roblox-ui-fundamentals` by relative path, so install them side by side.

## The verify loop

`roblox-frame-identification` bundles `scripts/preview.mjs`, which collapses the verification loop
into one command:

```sh
node skills/roblox-frame-identification/scripts/preview.mjs \
  --story src/UI/ShopPanel.story.luau --out .storyblox-verify
```

It resolves the config, starts or reuses the dev server, resolves the story id, renders it, prints
the instance tree and any renderer warnings, and screenshots the preview. It exits non-zero on a
render error so a failure cannot pass silently. `--help` documents every flag.

Requirements: a StoryBlox project, and a way to run StoryBlox. The simplest is the **standalone
binary** (v0.1.1+), which bundles the [Zune](https://zune.sh/) Luau runtime — no Node, no
`node_modules`, nothing else to install:

```sh
curl -sSL -o storyblox \
  https://github.com/CapedBojji/storyblox/releases/download/v0.1.1/storyblox-linux-x64
chmod +x storyblox
node skills/roblox-frame-identification/scripts/preview.mjs \
  --story src/UI/ShopPanel.story.luau --storyblox ./storyblox
```

From a source checkout, Zune must be on `PATH` — the dev server refuses to boot without it.
(StoryBlox is not on the public npm registry, so `npx storyblox` will not resolve.)

`playwright-core` is optional. Without it the script still renders the story and prints the instance
tree and renderer warnings; only the screenshots are skipped.
