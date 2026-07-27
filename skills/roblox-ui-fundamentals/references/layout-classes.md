# Layout, constraint and modifier classes

Modifier instances configure their **parent**. They are never rendered themselves — you parent a
`UICorner` to a `Frame` and the frame gets rounded. One instance per parent for most of them.

## Renderable classes

| Class | Notes |
|---|---|
| `Frame` | the plain container. `BackgroundTransparency = 1` makes it a pure positioning box |
| `CanvasGroup` | a `Frame` that composites its subtree first, enabling `GroupTransparency` / `GroupColor3`. The only way to fade a whole subtree together |
| `TextLabel` | non-interactive text |
| `TextButton` | text + click events |
| `TextBox` | text input: `PlaceholderText`, `ClearTextOnFocus`, `MultiLine`, `TextEditable` |
| `ImageLabel` | non-interactive image |
| `ImageButton` | image + click; also `HoverImage`, `PressedImage` |
| `ScrollingFrame` | clipped scroll region — see below |
| `ViewportFrame` | renders 3D instances into a 2D frame |
| `VideoFrame` | video playback |

`CanvasGroup` is underused. Fading a panel in and out by tweening every descendant's transparency
individually is a common mistake; wrap it in a `CanvasGroup` and tween one property.

## UIListLayout

The flexbox analogue and the layout you will use most.

```lua
UIListLayout{
  FillDirection       = Enum.FillDirection.Vertical,       -- or Horizontal
  Padding             = UDim.new(0, 8),                    -- the gap, usually offset
  HorizontalAlignment = Enum.HorizontalAlignment.Center,
  VerticalAlignment   = Enum.VerticalAlignment.Top,
  SortOrder           = Enum.SortOrder.LayoutOrder,        -- set this, always
  Wraps               = false,
}
```

Gotchas, in order of how often they bite:

1. **Children's `Position` is ignored.** Order comes from `LayoutOrder` only. If you position a
   child manually under a layout, the position silently does nothing.
2. **`SortOrder` defaults to `Name`** in some contexts — alphabetical, which is almost never what you
   want. Set `SortOrder = Enum.SortOrder.LayoutOrder` explicitly and give children a `LayoutOrder`.
3. **`HorizontalAlignment` and `VerticalAlignment` swap roles** with `FillDirection`. Along the fill
   axis, the alignment property is your `justify-content`; across it, your `align-items`.
4. **The layout does not size the parent.** For a parent that hugs its children, add
   `AutomaticSize` — and that axis's `Size` scale must be `0`, or there is nothing to hug to.

## UIFlexItem

Goes on a **child** of a `UIListLayout` parent. Without that parent it does nothing.

| `FlexMode` | Effect |
|---|---|
| `None` | default; the item keeps its own `Size` |
| `Grow` | absorbs leftover space, weighted by `GrowRatio` |
| `Shrink` | gives up space when short, weighted by `ShrinkRatio` |
| `Fill` | both — the `flex: 1` equivalent |
| `Custom` | `GrowRatio` and `ShrinkRatio` both apply independently |

`ItemLineAlignment` overrides the parent's cross-axis alignment for this one item; `Stretch` is the
`align-self: stretch` equivalent. The parent also has `HorizontalFlex` / `VerticalFlex` for
distributing space without touching each child.

## UIGridLayout

Uniform tiles in reading order. Inventory grids, shop grids, emote pickers.

```lua
UIGridLayout{
  CellSize    = UDim2.fromOffset(120, 120),   -- accepts scale, but scale cells wrap unpredictably
  CellPadding = UDim2.fromOffset(8, 8),
  FillDirection        = Enum.FillDirection.Horizontal,
  FillDirectionMaxCells = 0,                  -- 0 = as many as fit
  StartCorner = Enum.StartCorner.TopLeft,
  SortOrder   = Enum.SortOrder.LayoutOrder,
}
```

`CellSize` may use scale, but scale cells combined with wrapping produce layouts that are hard to
predict; offset cells inside a scale-sized `ScrollingFrame` is the reliable combination.
No spans, no named areas — if you need those, position manually.

## UITableLayout

Rows of children, each row's children forming columns that align across rows. Use for stat sheets
and settings tables. `FillEmptySpaceColumns` / `FillEmptySpaceRows` distribute leftover space.

## UIPageLayout

One child visible at a time with animated transitions — carousels, tutorial steps, tabbed bodies.
Driven in code via `:JumpTo(child)` / `:Next()` / `:Previous()`, with `EasingStyle`, `EasingDirection`,
`TweenTime`, `Circular`, and `Animated`.

## UIPadding

```lua
UIPadding{
  PaddingTop = UDim.new(0, 16), PaddingBottom = UDim.new(0, 16),
  PaddingLeft = UDim.new(0, 16), PaddingRight = UDim.new(0, 16),
}
```

Shrinks the parent's **content box**. After it, a child's `Size = UDim2.fromScale(1, 1)` means "the
padded area." Each side is a `UDim`, so percentage padding is possible — usually a mistake, since
padding is a visual constant.

Combines with `AutomaticSize`: the padding is added to the hugged content size, exactly like
`box-sizing: content-box`.

## UICorner

```lua
UICorner{ CornerRadius = UDim.new(0, 12) }    -- 12px
UICorner{ CornerRadius = UDim.new(0.5, 0) }   -- pill / circle
```

One instance per element and all four corners together — there is no per-corner control. The
`UDim.new(0.5, 0)` form is genuinely useful: it stays a pill at any size, which offset radii do not.

## UIStroke

```lua
UIStroke{
  Color = Color3.fromRGB(255, 255, 255),
  Thickness = 2,                                    -- plain number, pixels
  Transparency = 0.35,
  ApplyStrokeMode = Enum.ApplyStrokeMode.Border,    -- or Contextual
  LineJoinMode = Enum.LineJoinMode.Round,
}
```

Use this rather than `BorderSizePixel`, which is a legacy property that renders poorly and does not
follow `UICorner`. Set `BorderSizePixel = 0` on frames as a matter of course.

`ApplyStrokeMode.Contextual` strokes text and images by their contours; `Border` strokes the
element's rectangle.

## UIGradient

`Color` is a `ColorSequence`, `Transparency` a `NumberSequence`, `Rotation` is degrees, and `Offset`
shifts the ramp. Applies to the parent's background *and* to text/image contents, which is
occasionally surprising.

## UIAspectRatioConstraint

```lua
UIAspectRatioConstraint{
  AspectRatio  = 1.6,                              -- width / height
  DominantAxis = Enum.DominantAxis.Height,         -- which axis is honored first
  AspectType   = Enum.AspectType.FitWithinMaxSize, -- or ScaleWithParentSize
}
```

The tool for keeping a panel usable across the 0.45–2.4 viewport ratio range, and for keeping icons
square. `FitWithinMaxSize` treats the element's `Size` as a bounding box and letterboxes inside it;
`ScaleWithParentSize` derives from the parent instead.

## UISizeConstraint

```lua
UISizeConstraint{ MinSize = Vector2.new(320, 240), MaxSize = Vector2.new(900, 700) }
```

**`Vector2` — pixels only. Scale is not an option here.** This is the enforcement point for minimum
touch targets (~44x44px) and for stopping a scale-sized panel from becoming absurd on a 4K display.
It clamps *after* `Size` resolves, so it composes correctly with scale sizing.

## UITextSizeConstraint

`MinTextSize` / `MaxTextSize`. Only meaningful alongside `TextScaled = true`. The pairing is
mandatory: `TextScaled` without it is the single most common Roblox UI text bug.

## UIScale

One `Scale` number multiplying the element and its whole subtree, about the element's `AnchorPoint`.
On the root, this is the legitimate replacement for a global zoom or a media query.

## ScrollingFrame

```lua
ScrollingFrame{
  CanvasSize            = UDim2.fromScale(0, 0),          -- with AutomaticCanvasSize
  AutomaticCanvasSize   = Enum.AutomaticSize.Y,
  ScrollingDirection    = Enum.ScrollingDirection.Y,
  ScrollBarThickness    = 6,
  ScrollBarImageColor3   = Color3.fromRGB(120, 120, 120),
  ScrollBarImageTransparency = 0.4,
  BorderSizePixel = 0,
}
```

- The scrollbar is **properties, not a child instance**. There is nothing to build.
- `AutomaticCanvasSize` with a `UIListLayout` inside is the modern pattern; the manual alternative is
  recomputing `CanvasSize` from `UIListLayout.AbsoluteContentSize` on every change.
- When using `AutomaticCanvasSize` on an axis, set that axis of `CanvasSize` to zero, or the two
  fight.
- Nesting `ScrollingFrame`s inside each other on the same axis makes input routing ambiguous. Avoid.

## AutomaticSize

`Enum.AutomaticSize.X`, `.Y`, `.XY`, or `.None`. The `fit-content` equivalent. The hugged axis's
`Size` scale must be `0` — with a nonzero scale there is a fixed target and nothing to hug to.
Combines with `UIPadding` (padding is added) and with `UIListLayout` (hugs the laid-out content).

## StoryBlox rendering support

If you are previewing in [StoryBlox](https://github.com/CapedBojji/storyblox), its DOM renderer
supports exactly these 24 classes — everything above:

```
Frame  CanvasGroup  TextLabel  TextButton  TextBox  ImageLabel  ImageButton
ScrollingFrame  VideoFrame  ViewportFrame
UICorner  UIStroke  UIPadding  UIListLayout  UIGridLayout  UIPageLayout
UITableLayout  UIGradient  UIAspectRatioConstraint  UISizeConstraint
UITextSizeConstraint  UIScale  UIFlexItem  UIDragDetector
```

Anything else renders best-effort and reports a warning. Two properties worth knowing about because
they are commonly used and **not** in the renderer's supported-property list: `SortOrder` and
`Font` / `FontFace`. They are valid Roblox and belong in your real code — they just will not affect
the preview, and they will surface as warnings there.
