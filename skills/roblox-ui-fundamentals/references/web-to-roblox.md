# CSS to Roblox, in full

## Sizing and position

| CSS | Roblox |
|---|---|
| `position: absolute` | the default; do nothing |
| `position: relative` (as flow) | `UIListLayout` on the parent |
| `position: fixed` | parent it to the `ScreenGui` instead of the panel |
| `position: sticky` | no equivalent; keep it outside the `ScrollingFrame` and position manually |
| `top` / `left` | `Position` X/Y |
| `right: 12px` | `AnchorPoint = (1, y)` + `Position = UDim2.new(1, -12, ...)` |
| `bottom: 12px` | `AnchorPoint = (x, 1)` + `Position = UDim2.new(..., 1, -12)` |
| `width: 50%` | `Size = UDim2.fromScale(0.5, ...)` |
| `width: 200px` | `Size = UDim2.fromOffset(200, ...)` |
| `width: calc(100% - 32px)` | `Size = UDim2.new(1, -32, ...)` |
| `min-width` / `max-width` / `min-height` / `max-height` | `UISizeConstraint{MinSize, MaxSize}` — `Vector2`, pixels only |
| `aspect-ratio: 16/9` | `UIAspectRatioConstraint{AspectRatio = 16/9}` |
| `width: fit-content` / `height: fit-content` | `AutomaticSize` (`X`, `Y`, or `XY`); that axis's `Size` scale must be 0 |
| `transform: translate(-50%, -50%)` | `AnchorPoint = Vector2.new(0.5, 0.5)` |
| `transform: scale()` | `UIScale` |
| `transform: rotate()` | `Rotation` (degrees, a plain number) |
| `vw` / `vh` | nothing — scale is parent-relative. Parent to the `ScreenGui` to approximate |

## Flow and layout

| CSS | Roblox |
|---|---|
| `display: flex` | `UIListLayout` |
| `flex-direction: row` / `column` | `FillDirection = Horizontal` / `Vertical` |
| `gap` | `UIListLayout.Padding` (a `UDim`) |
| `flex-wrap: wrap` | `UIListLayout.Wraps = true` |
| `justify-content` | the alignment property **along** `FillDirection` |
| `align-items` | the alignment property **across** `FillDirection` |
| `flex: 1` | `UIFlexItem{FlexMode = Fill}` |
| `flex-grow: 2` | `UIFlexItem{FlexMode = Grow, GrowRatio = 2}` |
| `flex-shrink` | `UIFlexItem{FlexMode = Shrink, ShrinkRatio = n}` |
| `align-self: stretch` | `UIFlexItem.ItemLineAlignment = Stretch` |
| `order` | `LayoutOrder` |
| `display: grid` (uniform cells) | `UIGridLayout{CellSize, CellPadding}` |
| `display: grid` (named areas, spans) | no equivalent — position manually or nest lists |
| aligned columns across rows | `UITableLayout` |
| carousel / paged view | `UIPageLayout` |
| `padding` | `UIPadding{PaddingTop, PaddingRight, PaddingBottom, PaddingLeft}` |
| `margin` | **no equivalent.** Use offset in `Position`, or the parent's `UIListLayout.Padding`, or `UIPadding` on a wrapper |

`justify-content` and `align-items` map to `HorizontalAlignment` and `VerticalAlignment`, but
**which one is which depends on `FillDirection`**. With `FillDirection = Vertical`,
`VerticalAlignment` is your `justify-content` and `HorizontalAlignment` is your `align-items`. With
`Horizontal`, they swap. This trips up everyone once.

## Appearance

| CSS | Roblox |
|---|---|
| `background-color` | `BackgroundColor3` (a `Color3`) |
| `background: transparent` | `BackgroundTransparency = 1` (0 = opaque, 1 = invisible — inverted from CSS `opacity`) |
| `border-radius` | `UICorner.CornerRadius` — one instance, all four corners together |
| individual corner radii | no equivalent on `UICorner`; use a 9-slice `ImageLabel` |
| `border` | `UIStroke{Color, Thickness, Transparency, ApplyStrokeMode}` |
| `outline` | `UIStroke` with `ApplyStrokeMode = Border` |
| `box-shadow` | no equivalent — a 9-slice `ImageLabel` behind the element, sized larger with a negative-offset `Position` |
| `linear-gradient` | `UIGradient{Color, Rotation, Offset}` |
| `opacity` on one element | the matching `*Transparency` property |
| `opacity` on a subtree | `CanvasGroup.GroupTransparency` — transparency does **not** inherit otherwise |
| `overflow: hidden` | `ClipsDescendants = true` |
| `overflow: auto` / `scroll` | `ScrollingFrame` + `CanvasSize` or `AutomaticCanvasSize` |
| independent `overflow-x` / `overflow-y` | partially: `ScrollingFrame.ScrollingDirection` |
| `z-index` | `ZIndex`, scoped by `ScreenGui.ZIndexBehavior` |
| `cursor: pointer` | use a `TextButton` / `ImageButton` |
| `:hover` | `MouseEnter` / `MouseLeave`, or `ImageButton.HoverImage` |
| `:active` | `ImageButton.PressedImage`, or `InputBegan` |
| `pointer-events: none` | `Active = false`, or `Interactable = false` on buttons |
| `visibility: hidden` | `Visible = false` |
| `transition` / `animation` | `TweenService` |
| `::before` / `::after` | no equivalent — add a real child instance |

## Text

| CSS | Roblox |
|---|---|
| `font-size` | `TextSize` (px), or `TextScaled` + `UITextSizeConstraint` |
| `color` | `TextColor3` |
| `font-family` / `font-weight` | `FontFace` (a `Font` object) or the legacy `Font` enum |
| `text-align` | `TextXAlignment` |
| vertical centering | `TextYAlignment` — no CSS line-height hack needed |
| `line-height` | `LineHeight` (a multiplier) |
| `letter-spacing` | no equivalent |
| `white-space: nowrap` | `TextWrapped = false` |
| `text-overflow: ellipsis` | `TextTruncate = Enum.TextTruncate.AtEnd` |
| `-webkit-text-stroke` | `TextStrokeColor3` + `TextStrokeTransparency` |
| markup / rich text | `RichText = true` (supports a small tag subset) |
| `input` element | `TextBox` (`PlaceholderText`, `ClearTextOnFocus`, `MultiLine`) |

## Responsive

| CSS | Roblox |
|---|---|
| `@media (max-width: …)` | **nothing. Delete it.** Size in scale |
| fluid type (`clamp()`) | `TextScaled` + `UITextSizeConstraint{MinTextSize, MaxTextSize}` |
| container queries | no equivalent |
| a global zoom factor | one `UIScale` on the root |
| safe-area insets | `GuiService:GetGuiInset()`, `ScreenGui.IgnoreGuiInset` |

## Things with no Roblox equivalent, and what to do instead

**`box-shadow`** — the standard workaround is a 9-slice `ImageLabel` parented behind the element
(lower `ZIndex`), sized larger than it, positioned with a negative offset, using `ScaleType = Slice`
and a `SliceCenter` rect. Every shadow you have seen in a polished Roblox game is this.

**`margin`** — genuinely absent. Collapsing margins do not exist either, which is a mercy. Either
put the space in the child's `Position` offset, use the parent's `UIListLayout.Padding` for uniform
gaps, or wrap the child in a padded container.

**CSS Grid areas and spans** — `UIGridLayout` only does uniform cells in reading order. Anything
with spans or named areas gets positioned manually, or built as nested `UIListLayout`s.

**`position: sticky`** — keep the sticky element *outside* the `ScrollingFrame` as a sibling, and
position it over the scroll region.

**Pseudo-elements** — add a real child instance. There is no shortcut.

**`letter-spacing`** — not exposed. If you truly need it, render per-character labels in a
`UIListLayout`, and reconsider whether you need it.

## Transparency is inverted

Worth its own note because it causes silent bugs. CSS `opacity: 1` is fully visible;
Roblox `Transparency = 1` is fully **invisible**. Every `*Transparency` property in Roblox runs
0 (opaque) to 1 (invisible). `BackgroundTransparency = 1` is the standard way to make a label or
container purely a positioning box with no fill.
