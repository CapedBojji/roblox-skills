# UDim2, scaling, and where it breaks

## The arithmetic

A `UDim` is `{Scale, Offset}`. Resolved against a parent length `P`:

```
absolute = Scale * P + Offset
```

A `UDim2` is two of them, `X` and `Y`. That is the entire model.

```lua
-- parent is 800 x 600
UDim2.new(0.5, 0, 0.5, 0)      -- 400 x 300
UDim2.new(0.5, 20, 0.5, -10)   -- 420 x 290
UDim2.fromScale(1, 1)          -- 800 x 600
UDim2.fromOffset(120, 40)      -- 120 x 40, whatever the parent is
UDim2.new(1, -32, 1, -32)      -- 768 x 568  (fill, 16px gutter each side)
```

Constructors worth memorizing:

| Constructor | Use |
|---|---|
| `UDim2.new(xs, xo, ys, yo)` | the general form; the only one that does mixed |
| `UDim2.fromScale(x, y)` | pure proportional |
| `UDim2.fromOffset(x, y)` | pure pixel |
| `UDim.new(s, o)` | single-axis props: `CornerRadius`, `UIListLayout.Padding`, `UIPadding.*` |

`Size` measures the element. `Position` places the element's **AnchorPoint** relative to the
parent's top-left. Those are different reference points, which is why AnchorPoint confusion shows up
as a positioning bug rather than a sizing bug.

## Nesting multiplies

Scale is always relative to the **direct parent**, and it compounds:

```
ScreenGui           1920 x 1080
└─ Panel            Size = fromScale(0.5, 0.6)     ->  960 x 648
   └─ Body          Size = fromScale(0.9, 0.8)     ->  864 x 518   (0.45 x 0.48 of screen)
      └─ Row        Size = UDim2.new(1, -24, 0, 40) -> 840 x 40
```

Two consequences:

- There is no `vw`/`vh`. To size something against the *screen*, it must be a direct child of the
  `ScreenGui`, or you do the multiplication yourself.
- A deeply nested `0.9` chain shrinks fast. Prefer `UDim2.new(1, -pad, 1, -pad)` or `UIPadding` for
  insets, and reserve fractional scale for genuinely proportional splits.

## The gutter idiom

The most common real-world sizing in Roblox UI:

```lua
-- fill the parent with a 16px gutter on every side
Size     = UDim2.new(1, -32, 1, -32)
Position = UDim2.fromOffset(16, 16)

-- or, equivalently and more maintainably, on the parent:
UIPadding{ PaddingTop = UDim.new(0, 16), PaddingBottom = UDim.new(0, 16),
           PaddingLeft = UDim.new(0, 16), PaddingRight = UDim.new(0, 16) }
-- then the child is simply Size = UDim2.fromScale(1, 1)
```

Prefer `UIPadding` when more than one child shares the inset. It shrinks the parent's content box,
so every child's `scale = 1` means "the padded area."

## SizeConstraint — the cheap square

`GuiObject.SizeConstraint` decides which parent axis *both* of your scale values measure against:

| Value | Meaning |
|---|---|
| `RelativeXY` (default) | X scale uses parent width, Y scale uses parent height |
| `RelativeXX` | **both** axes use the parent's **width** |
| `RelativeYY` | **both** axes use the parent's **height** |

```lua
-- a square that stays square, no constraint instance needed
icon.SizeConstraint = Enum.SizeConstraint.RelativeYY
icon.Size = UDim2.fromScale(0.6, 0.6)   -- 60% of parent height, on both axes
```

This is lighter than `UIAspectRatioConstraint` when you only need square-against-one-axis. Reach for
`UIAspectRatioConstraint` when you need a non-1:1 ratio or you need the *parent* to adapt.

## Text does not scale

`TextSize` is absolute pixels and `UDim2` never touches it. Three options:

```lua
-- 1. Fixed size. Correct for chrome: buttons, labels, headers.
label.TextSize = 18

-- 2. Fill the box, bounded. Correct for anything on a scale-sized frame.
label.TextScaled = true
local c = Instance.new("UITextSizeConstraint")
c.MinTextSize = 12
c.MaxTextSize = 28
c.Parent = label

-- 3. Global knob. One UIScale on the root; text rides along with everything else.
```

**Never `TextScaled = true` alone on a scale-sized frame.** With no `UITextSizeConstraint` it will
render illegibly small on a phone and comically large on a 4K monitor. `TextScaled` also overrides
`TextSize` entirely, so setting both is a no-op on the latter.

Wrapping: `TextWrapped = true` wraps at the frame width. `TextTruncate = Enum.TextTruncate.AtEnd`
gives you the ellipsis. Both measure against the element's *absolute* size, so they interact with
scale in ways worth previewing rather than reasoning about.

## The UIScale root knob

The honest replacement for media queries. One instance, on the root:

```lua
local camera = workspace.CurrentCamera
local uiScale = Instance.new("UIScale")
uiScale.Parent = root

local function refresh()
    local viewport = camera.ViewportSize
    -- 1080p is the design canvas; clamp so it never gets silly
    uiScale.Scale = math.clamp(viewport.Y / 1080, 0.7, 1.3)
end

refresh()
camera:GetPropertyChangedSignal("ViewportSize"):Connect(refresh)
```

Scaling from the Y axis is usually right — width varies far more than height across devices.
`UIScale` scales about the element's `AnchorPoint`, so set that before you expect centered growth.

## Aspect-ratio bands

What a scale-only panel actually does across real Roblox viewports:

| Band | Ratio | What happens to `fromScale(0.5, 0.6)` |
|---|---|---|
| Phone portrait | ~0.46 | Tall, narrow sliver. Text wraps badly, rows crush |
| Phone landscape | ~2.16 | Wide, short letterbox. Vertical lists run out of room |
| Tablet | ~1.33 | Close to the design intent |
| Desktop 16:9 | ~1.78 | The usual design target |
| Ultrawide | ~2.4 | Very wide slab; content floats apart |

Mitigation, in order of preference:

```lua
-- 1. Lock the panel's shape, let it letterbox inside the screen
local arc = Instance.new("UIAspectRatioConstraint")
arc.AspectRatio = 1.6                             -- width / height
arc.DominantAxis = Enum.DominantAxis.Height       -- fit height first, derive width
arc.AspectType  = Enum.AspectType.FitWithinMaxSize

-- 2. Bound the extremes in absolute pixels
local sc = Instance.new("UISizeConstraint")
sc.MinSize = Vector2.new(320, 240)
sc.MaxSize = Vector2.new(900, 700)
```

`UISizeConstraint` takes `Vector2` — **pixels only, no scale**. This surprises people who expect a
UDim2. It is the right tool for "never smaller than a usable size" and "never absurd on a 4K
monitor," and it is the correct enforcement point for the ~44x44px minimum touch target.

## Safe areas

Scale knows nothing about hardware intrusions.

- `GuiService:GetGuiInset()` returns the top-left inset taken by the Roblox top bar. Content pinned
  to `Position = UDim2.fromScale(0, 0)` will sit underneath it.
- `ScreenGui.IgnoreGuiInset` controls whether your GUI's coordinate space starts above or below that
  inset. Set it deliberately; the default is `false`.
- Phone notches and rounded corners eat the edges. Keep anything critical off a ~5% margin.

```lua
local inset = game:GetService("GuiService"):GetGuiInset()
topBar.Position = UDim2.fromOffset(0, inset.Y)
```

## Quick reference: resolving a layout by hand

When a layout is wrong and you need to know why, resolve it numerically from the root down. Parent
absolute size, then `Scale * P + Offset` per axis, then subtract `UIPadding`, then apply
`AnchorPoint` to convert `Position` into a top-left. Nine times out of ten the bug is visible the
moment the numbers are on paper: a scale that should have been offset, or an AnchorPoint that was
never set.
