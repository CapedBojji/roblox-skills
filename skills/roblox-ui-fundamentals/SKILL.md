---
name: roblox-ui-fundamentals
description: The mental model for Roblox GUI layout — everything floats and is absolutely positioned by default, Position/Size are UDim2 scale+offset pairs, AnchorPoint decides what "position" even means, and scale-based sizing replaces responsive breakpoints entirely. Read this BEFORE writing or editing any Roblox UI code — any ScreenGui, Frame, TextLabel, TextButton, ImageLabel, ImageButton, ScrollingFrame, CanvasGroup, UIListLayout, UIGridLayout, UIPadding, UICorner, UIStroke, UIFlexItem, UISizeConstraint, or UIAspectRatioConstraint. Triggers on "Roblox UI", "Roblox GUI", "HUD", "shop menu", "inventory panel", "settings screen", "UDim2", "scale vs offset", "AnchorPoint", "make this UI responsive", "my UI breaks on mobile", "why is my UI off-center", "center this frame", "add a breakpoint", or any request to port a web/CSS/Figma/React/Tailwind layout into Roblox. Also use when reviewing existing Roblox UI for positioning or scaling bugs. Web and CSS instincts are wrong here by default — do not apply them before reading this.
---

# Roblox UI is not the web

If you have written CSS, your defaults are wrong here in a specific and fixable way. This skill
replaces them. Read the four rules, then the scale/offset table. Everything else is elaboration.

## The four rules

**1. Everything floats.** Every `GuiObject` is absolutely positioned inside its parent. There is no
document flow, no normal flow, no siblings pushing each other around. Two children with the same
`Position` occupy the same pixels and overlap. `position: absolute` is not a tool you reach for —
it is the only mode. Layout classes (`UIListLayout` and friends) are the *opt-in exception*, not the
baseline.

**2. `Position` and `Size` are `UDim2` — a `{scale, offset}` pair per axis.** Scale is a fraction of
the **parent's** absolute size. Offset is pixels. They add.

```lua
UDim2.new(xScale, xOffset, yScale, yOffset)
UDim2.fromScale(0.5, 0.25)   -- half the parent's width, a quarter of its height
UDim2.fromOffset(200, 48)    -- 200px x 48px, regardless of parent
UDim2.new(1, -32, 0, 48)     -- parent width minus 32px, exactly 48px tall
```

That last form is the workhorse. It is CSS `calc(100% - 32px)` without the ceremony.

**3. Scale sizing *is* the responsiveness.** Size things in scale and the desktop layout already is
the mobile layout — same proportions, fewer pixels. A phone is not a different design, it is the
same design at a smaller absolute size. Do not write breakpoints. Do not branch on `AbsoluteSize`.
Do not port media queries.

**4. Scale is parent-relative, never viewport-relative.** `scale = 1` means 100% of the *direct
parent*, always. Nesting multiplies: a `0.5`-wide child of a `0.5`-wide panel is `0.25` of the
screen. There is no `vw`/`vh`.

## Centering, and the AnchorPoint model

`AnchorPoint` is **which point of this element** gets placed at `Position`. It is a `Vector2` in
0–1 element-space. Default `(0, 0)` = top-left corner.

```lua
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position    = UDim2.fromScale(0.5, 0.5)   -- genuinely centered, at any size
```

Setting only `Position` puts the element's *top-left* at the parent's center — the classic
"why is it off-center" bug. The fix is never `UDim2.new(0.5, -width/2, 0.5, -height/2)`: that
silently breaks the moment the width becomes scale-based, because you cannot subtract half of a
percentage in pixels.

| Pin to | AnchorPoint | Position |
|---|---|---|
| Top-left | `(0, 0)` | `UDim2.fromOffset(12, 12)` |
| Top-right | `(1, 0)` | `UDim2.new(1, -12, 0, 12)` |
| Bottom-right | `(1, 1)` | `UDim2.new(1, -12, 1, -12)` |
| Center | `(0.5, 0.5)` | `UDim2.fromScale(0.5, 0.5)` |
| Right edge, vertically centered | `(1, 0.5)` | `UDim2.new(1, -12, 0.5, 0)` |

AnchorPoint does not change `Size`. It *does* move the origin used by `Rotation` and `UIScale`.

### Children are not confined to their parent

Every row above keeps the child *inside*. That is the CSS reflex, and it is only half the story:
**nothing clips by default in Roblox** (`ClipsDescendants` is `false`), so a child may sit partly or
entirely outside its parent. This is not a hack — it is how real Roblox UI pins badges and corner
buttons, and placing them inside instead produces a visibly different design.

```lua
-- centre exactly on the parent's top-right corner: the button overhangs on both axes
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.fromScale(1, 0)

-- centre on the left edge, 20px down: most of a wide badge hangs off to the left
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(0, 0, 0, 20)
```

With `AnchorPoint (0.5, 0.5)` and the position on the edge, exactly half the element sits outside.
Tune the balance with the offset, not by switching to a corner anchor — a corner anchor stops
tracking the edge when the parent resizes.

Two requirements: the parent must not set `ClipsDescendants = true`, and the child needs a `ZIndex`
that wins wherever it overlaps a neighbour.

For classifying these placements from a reference, see the `roblox-element-placement` skill.

## Scale or offset?

The single most useful table in this skill. When in doubt: **things that should track the screen
use scale; things that are visual constants use offset.**

| Thing | Use | Why |
|---|---|---|
| Root panel size | **scale** (+ `UIAspectRatioConstraint`) | must track the screen |
| Root panel position | `fromScale(0.5, 0.5)` + `AnchorPoint (0.5, 0.5)` | centered stays centered |
| Children of a scaled panel | **scale** | they inherit the panel's responsiveness for free |
| "Fill parent minus a gutter" | **both**: `UDim2.new(1, -32, 1, -32)` | the idiomatic mixed form |
| Header bar height | **offset** | chrome should not grow with the screen |
| Close button, icons | **offset** (+ `UIAspectRatioConstraint` to stay square) | fixed affordances |
| Padding, insets | **offset** via `UIPadding` | a visual constant |
| Corner radius | **offset** `UDim.new(0, 12)` — except pills, which are `UDim.new(0.5, 0)` | radius is a visual constant |
| `UIStroke.Thickness` | pixels — it is a plain number, there is no choice | — |
| `UIListLayout.Padding` | **offset** usually | gaps are a visual constant |
| Proportional columns / gutters | **scale** | that is the whole point |
| Text | `TextSize` in px, or `TextScaled` + `UITextSizeConstraint` | UDim2 does not touch text |
| Minimum touch target | **offset floor** via `UISizeConstraint.MinSize` | ~44x44px physical minimum |
| `UISizeConstraint.MinSize`/`MaxSize` | **pixels only** — it takes a `Vector2`, scale is not an option | common surprise |

## Do not write breakpoints

- **Wrong:** read `AbsoluteSize`, compare against thresholds, swap property sets.
- **Right:** express everything in scale. It already works.
- **The global knob**, when the whole thing genuinely needs to be bigger or smaller: exactly one
  `UIScale` on the root. This is the honest replacement for a media query.

```lua
local camera = workspace.CurrentCamera
uiScale.Scale = math.clamp(camera.ViewportSize.Y / 1080, 0.7, 1.3)
```

The **one** legitimate reflow is an **axis flip** — a two-column desktop panel becoming one column
on a phone. The mechanism is toggling `UIListLayout.FillDirection`, not swapping a stylesheet.
Nothing else earns a threshold.

## Where scale-only genuinely isn't enough

The doctrine above is right, but it is not the whole truth. These are the real caveats — apply them
deliberately, not reflexively.

1. **Text does not scale with UDim2.** `TextSize` is absolute pixels. Use `TextScaled = true` plus
   `UITextSizeConstraint{MinTextSize, MaxTextSize}`. Never `TextScaled` alone on a scale-sized frame
   — it renders 8px on a phone and 90px on a 4K monitor.
2. **Offset stroke and corner radius do not shrink.** A 12px radius on a panel that halves in size
   reads twice as round. Pills sidestep this with `UDim.new(0.5, 0)`; otherwise accept it, or drive
   the subtree with one `UIScale`.
3. **Extreme aspect ratios.** Roblox viewports run roughly 0.45 (portrait phone) to 2.4 (ultrawide).
   A scale-only panel becomes a letterbox slab on one and a sliver on the other. Fix with
   `UIAspectRatioConstraint` plus `UISizeConstraint` bounds.
4. **Touch targets have an absolute floor** of about 44x44px. Enforce with `UISizeConstraint.MinSize`
   on the button, not by inflating everything.
5. **Safe areas.** `GuiService:GetGuiInset()` and the top bar eat the top of the screen; phone
   notches eat the sides. Scale knows nothing about either.

## When layouts ARE the right call

Manual UDim2 positioning is the default and is *correct* for fixed chrome (header, close button,
footer), for overlapping and decorative elements, and for anything pinned to a corner.

Reach for a layout when you have **N sibling elements of the same kind whose count comes from data.**
Then, and only then.

| Situation | Use |
|---|---|
| Data-driven vertical or horizontal list | `UIListLayout` |
| Uniform tiles (inventory grid) | `UIGridLayout` |
| Aligned columns across rows | `UITableLayout` |
| One child should absorb leftover space | `UIFlexItem{FlexMode = Fill}` inside a `UIListLayout` |
| Two fixed children | **none** — just position them |

**The rule that bites everyone: once a parent has a layout, its children's `Position` is ignored.**
Only `LayoutOrder` matters. Mixing manual positioning with a layout is the number-one cause of
"my element vanished."

## Web to Roblox

| CSS | Roblox |
|---|---|
| `position: absolute` | the default — do nothing |
| normal flow / `position: relative` | `UIListLayout` on the parent |
| `width: 50%` | `Size = UDim2.fromScale(0.5, ...)` |
| `width: 200px` | `Size = UDim2.fromOffset(200, ...)` |
| `width: calc(100% - 32px)` | `UDim2.new(1, -32, ...)` |
| `display: flex` + `gap` | `UIListLayout{FillDirection, Padding}` |
| `flex: 1` | `UIFlexItem{FlexMode = Enum.UIFlexMode.Fill}` |
| `justify-content` / `align-items` | `HorizontalAlignment` / `VerticalAlignment` (they swap meaning with `FillDirection`) |
| `padding` | `UIPadding` |
| `margin` | **does not exist** — use offset in `Position`, or the parent's `UIListLayout.Padding` |
| `min-width` / `max-width` | `UISizeConstraint{MinSize, MaxSize}` (pixels only) |
| `aspect-ratio` | `UIAspectRatioConstraint` |
| `overflow: hidden` | `ClipsDescendants = true` |
| `overflow: auto` | `ScrollingFrame` + `CanvasSize` / `AutomaticCanvasSize` |
| `z-index` | `ZIndex` (behavior depends on `ScreenGui.ZIndexBehavior`) |
| `border-radius` | `UICorner` (one per element, all four corners together) |
| `border` | `UIStroke`, not `BorderSizePixel` |
| `box-shadow` | no equivalent — a 9-slice `ImageLabel` behind the element |
| `linear-gradient` | `UIGradient` |
| `opacity` on a subtree | `CanvasGroup.GroupTransparency` — transparency does **not** inherit otherwise |
| `text-overflow: ellipsis` | `TextTruncate = Enum.TextTruncate.AtEnd` |
| `height: fit-content` | `AutomaticSize` (that axis's `Size` scale must be 0) |
| `transform: scale()` | `UIScale` |
| `@media` | **nothing. Delete it.** Use scale. |

Full table plus the "no Roblox equivalent" workarounds: `references/web-to-roblox.md`.

## ZIndex

Siblings sort by `ZIndex`. Which *tree* they sort within depends on `ScreenGui.ZIndexBehavior`:

- `Sibling` (modern default) — a parent's `ZIndex` acts like a CSS stacking context for its
  descendants. This is what you want.
- `Global` (legacy) — every `GuiObject` in the entire tree sorts by raw `ZIndex`, ignoring hierarchy.

Check which one you are in before "fixing" a layering bug.

## References

- `references/udim2-and-scaling.md` — UDim2 arithmetic worked through, nesting, `SizeConstraint`, the text-scaling recipe, the `UIScale` root knob, safe areas, aspect-ratio bands
- `references/web-to-roblox.md` — the full translation table and the things with no Roblox equivalent
- `references/layout-classes.md` — every layout, constraint and modifier class with its real gotchas
- `references/anti-patterns.md` — wrong/right code pairs for the mistakes that actually happen

## Executable examples

If [StoryBlox](https://github.com/CapedBojji/storyblox) is checked out, `demo/src/RobloxUI/` has one
runnable story per Roblox UI class — `Frame`, `UIListLayout`, `UIFlexItem`, `UISizeConstraint`,
`UIAspectRatioConstraint`, `ScrollingFrame` and the rest. They are the fastest way to *see* what a
property does. The `roblox-frame-identification` skill drives that previewer end to end.
