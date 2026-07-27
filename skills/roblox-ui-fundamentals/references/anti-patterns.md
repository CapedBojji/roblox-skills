# Anti-patterns

Each one is a real mistake with a real fix. Most come from carrying a web habit across.

## 1. Centering with negative offsets

```lua
-- WRONG: breaks the moment Size becomes scale-based
frame.Size     = UDim2.fromOffset(400, 300)
frame.Position = UDim2.new(0.5, -200, 0.5, -150)
```
```lua
-- RIGHT
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position    = UDim2.fromScale(0.5, 0.5)
```
You cannot subtract half of a percentage in pixels, so the negative-offset trick has no scale-based
equivalent. `AnchorPoint` is the mechanism that exists for this.

## 2. Breakpoints

```lua
-- WRONG
if camera.ViewportSize.X < 800 then
    panel.Size = UDim2.fromOffset(320, 480)
else
    panel.Size = UDim2.fromOffset(720, 540)
end
```
```lua
-- RIGHT: one expression, every screen
panel.Size = UDim2.fromScale(0.45, 0.6)
```
If the whole UI genuinely needs a size multiplier, that is one `UIScale` on the root — not a
threshold, and not two property sets to keep in sync.

## 3. `TextScaled` with no constraint

```lua
-- WRONG: 8px on a phone, 90px on a 4K monitor
label.TextScaled = true
```
```lua
-- RIGHT
label.TextScaled = true
local c = Instance.new("UITextSizeConstraint")
c.MinTextSize, c.MaxTextSize = 12, 28
c.Parent = label
```

## 4. `Position` on a child of a layout

```lua
-- WRONG: the layout ignores Position entirely; this line does nothing
row.Parent   = listWithUIListLayout
row.Position = UDim2.fromOffset(0, 40)
```
```lua
-- RIGHT
row.LayoutOrder = 2
```
Symptom: "my element vanished" or "everything is stacked at the top." Once a parent has a layout,
order comes from `LayoutOrder` and nothing else.

## 5. Forgetting `SortOrder`

```lua
-- WRONG: children order alphabetically by Name
layout.FillDirection = Enum.FillDirection.Vertical
```
```lua
-- RIGHT
layout.SortOrder = Enum.SortOrder.LayoutOrder
```
Symptom: items appear in a stable but nonsensical order that changes when you rename something.

## 6. Sizing a whole panel in offset

```lua
-- WRONG: correct on your monitor, wrong everywhere else
panel.Size = UDim2.fromOffset(720, 540)
```
```lua
-- RIGHT
panel.Size = UDim2.fromScale(0.45, 0.6)
-- optionally bound the extremes
sizeConstraint.MinSize = Vector2.new(320, 240)
sizeConstraint.MaxSize = Vector2.new(900, 700)
```
Offset is for *chrome inside* the panel — header height, icon size, padding. Not for the panel.

## 7. A layout for two fixed children

```lua
-- WRONG: ceremony, and now neither child can be positioned
local layout = Instance.new("UIListLayout")
layout.Parent = header
```
```lua
-- RIGHT: two fixed children, so position them
title.Position    = UDim2.fromOffset(16, 0)
close.AnchorPoint = Vector2.new(1, 0.5)
close.Position    = UDim2.new(1, -12, 0.5, 0)
```
Layouts are for N-of-a-kind where N comes from data.

## 8. `BorderSizePixel` instead of `UIStroke`

```lua
-- WRONG: legacy, renders poorly, ignores UICorner
frame.BorderSizePixel = 2
frame.BorderColor3 = Color3.fromRGB(255, 255, 255)
```
```lua
-- RIGHT
frame.BorderSizePixel = 0
local stroke = Instance.new("UIStroke")
stroke.Thickness, stroke.Color = 2, Color3.fromRGB(255, 255, 255)
stroke.Parent = frame
```
Set `BorderSizePixel = 0` on every frame as a habit — the default is not zero.

## 9. Fading a subtree property by property

```lua
-- WRONG: transparency does not inherit, so this is a loop over every descendant
for _, d in ipairs(panel:GetDescendants()) do
    -- ...and now you need to remember each one's original transparency
end
```
```lua
-- RIGHT: make the panel a CanvasGroup, tween one property
TweenService:Create(canvasGroup, info, { GroupTransparency = 1 }):Play()
```

## 10. `AutomaticSize` with a nonzero scale

```lua
-- WRONG: the Y scale gives it a fixed target, so there is nothing to hug
frame.Size = UDim2.fromScale(1, 0.5)
frame.AutomaticSize = Enum.AutomaticSize.Y
```
```lua
-- RIGHT
frame.Size = UDim2.new(1, 0, 0, 0)
frame.AutomaticSize = Enum.AutomaticSize.Y
```

## 11. `CanvasSize` fighting `AutomaticCanvasSize`

```lua
-- WRONG: both set on the same axis
scroll.CanvasSize          = UDim2.fromScale(0, 2)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
```
```lua
-- RIGHT: zero the automatic axis
scroll.CanvasSize          = UDim2.fromScale(0, 0)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
```

## 12. Building a scrollbar

There is nothing to build. `ScrollBarThickness`, `ScrollBarImageColor3` and
`ScrollBarImageTransparency` are properties of the `ScrollingFrame`. A hand-built scrollbar child is
a sign the model has been misread.

## 13. Nesting frames purely to fake margins

```lua
-- WRONG: a wrapper per child, purely for spacing
```
```lua
-- RIGHT: one UIPadding on the container, or UIListLayout.Padding for uniform gaps
```
Margin does not exist, but the answer is a padding instance on the parent — not a wrapper per child.

## 14. Reading `AbsoluteSize` during construction

`AbsoluteSize` is `0, 0` until the instance is parented into a rendered tree and a frame has passed.
Reading it in the same tick you build the UI gives zeros, and layout math built on those zeros
collapses. If you genuinely need it, wait for
`GetPropertyChangedSignal("AbsoluteSize")` — but first check whether scale sizing removes the need.

## 15. Tucking overhanging chrome inside the frame

```lua
-- WRONG: the reference shows the close button straddling the corner; this hides that entirely
close.AnchorPoint = Vector2.new(1, 0)
close.Position    = UDim2.new(1, -12, 0, 12)
```
```lua
-- RIGHT: centre on the edge, so it deliberately overhangs
close.AnchorPoint = Vector2.new(0.5, 0.5)
close.Position    = UDim2.new(1, -13, 0, 18)
```
The CSS reflex is that chrome lives inside its container. Roblox does not clip by default, and
header badges, corner buttons and notification dots routinely hang outside. Measure the signed edge
deltas before placing: a negative delta means it belongs outside.

## 16. Hardcoding a design-resolution pixel grid

Laying the whole UI out in 1920x1080 pixel coordinates and hoping is the web habit that transfers
worst. The output looks perfect in Studio at one window size and wrong on every device. Convert to
scale as you go, not as a cleanup pass — retrofitting scale onto a finished offset layout means
redoing it.
