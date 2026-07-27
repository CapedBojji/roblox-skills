# Placement classes

Seven ways an element can sit relative to its owning frame, each with the expression that produces
it. Classify with signed edge deltas (`../scripts/place.mjs`), then read the idiom off this page.

Throughout: `f` is the owning frame, `e` the element, `g` a gutter in pixels.

---

## 1. INSET — fully inside, pinned to a corner or edge

All four deltas positive. The common case, and the only one CSS habits get right by default.

Anchor to the **nearest** corner so the inset survives a resize:

```lua
-- top-left, 16px in
AnchorPoint = Vector2.new(0, 0)
Position    = UDim2.fromOffset(16, 16)

-- top-right, 12px in
AnchorPoint = Vector2.new(1, 0)
Position    = UDim2.new(1, -12, 0, 12)

-- bottom-right, 12px in
AnchorPoint = Vector2.new(1, 1)
Position    = UDim2.new(1, -12, 1, -12)

-- right edge, vertically centred
AnchorPoint = Vector2.new(1, 0.5)
Position    = UDim2.new(1, -12, 0.5, 0)
```

Anchoring to the *far* corner and using a large positive offset technically works and then breaks the
moment the frame resizes. Always anchor to the edge you are measuring from.

---

## 2. STRADDLE — centre inside, part of the element outside

At least one negative delta, centre still within the frame. **The one to internalise.** Roblox does
not clip by default, so this is idiomatic, not a hack: header badges, corner close buttons,
notification dots, ribbon banners.

Anchor at the element's own centre and position at the frame's extreme:

```lua
-- centre exactly on the top-right corner: a quarter of the element sits outside on each axis
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.fromScale(1, 0)

-- centre on the right edge, 18px below the top
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(1, 0, 0, 18)

-- centre on the left edge, 20px down — most of a wide badge hangs off to the left
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(0, 0, 0, 20)

-- centre 13px inside the right edge: overhangs by (width/2 - 13)
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(1, -13, 0, 18)
```

With `AnchorPoint (0.5, 0.5)` and the position on the edge, **exactly half** hangs out. Tune the
balance with the offset — do not switch to a corner anchor, or the overhang stops tracking the edge
when the frame resizes.

How much hangs out, for an element of width `w` positioned at `UDim2.new(1, k, …)`:

```
overhang = w/2 + k          (k is negative when the centre is inside the edge)
```

Requirements: the frame must not set `ClipsDescendants = true`, and the element needs a `ZIndex` that
wins wherever it overlaps a neighbour.

---

## 3. OUTSIDE — entirely beyond an edge

Centre lies outside the frame. A label under a panel, a tab above one, a caption beside an icon.

```lua
-- a caption 8px below the frame, horizontally centred
AnchorPoint = Vector2.new(0.5, 0)
Position    = UDim2.new(0.5, 0, 1, 8)

-- a tab sitting on top of the frame
AnchorPoint = Vector2.new(0, 1)
Position    = UDim2.new(0, 24, 0, 0)
```

Anchor to the side **facing** the frame, so the gap is the offset and stays constant.

Reconsider ownership here: if it is entirely outside and does not move with the frame, it may belong
to the frame's parent instead. See `attribution.md`.

---

## 4. CENTRED

```lua
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.fromScale(0.5, 0.5)
```

Never `UDim2.new(0.5, -w/2, 0.5, -h/2)` — that has no scale-based equivalent and breaks the moment
the size becomes proportional.

---

## 5. FILL — covers the frame, with or without a gutter

```lua
-- fill exactly
Size = UDim2.fromScale(1, 1)

-- fill with a 16px gutter all round
Size     = UDim2.new(1, -32, 1, -32)
Position = UDim2.fromOffset(16, 16)

-- better when several children share the inset: put UIPadding on the frame,
-- then every child is simply Size = UDim2.fromScale(1, 1)
```

**Negative gutter** is the drop-shadow case — deliberately larger than the frame:

```lua
Size     = UDim2.new(1, 24, 1, 24)
Position = UDim2.fromOffset(-12, -8)   -- offset down-right for a cast shadow
ZIndex   = 0
```

Classify a shadow as FILL-with-negative-gutter, not a straddle. It is decoration bound to the frame's
whole silhouette, not pinned to one edge.

---

## 6. FLOW — inside a parent that has a layout

If the parent has a `UIListLayout`, `UIGridLayout`, `UITableLayout` or `UIPageLayout`, then
**`Position` is ignored entirely.** Placement is `LayoutOrder` plus the layout's alignment.

```lua
LayoutOrder = 2
-- and, to absorb leftover space:
UIFlexItem{ FlexMode = Enum.UIFlexMode.Fill }
```

Recording a `Position` for a flow element is a category error, and a common source of "my element
vanished". In a placement table write `layout-driven` in the Position column and give the
`LayoutOrder`.

Cross-axis placement comes from the parent's `HorizontalAlignment` / `VerticalAlignment`, or per-item
via `UIFlexItem.ItemLineAlignment`.

---

## 7. SIBLING-RELATIVE — positioned against a neighbour, not the frame

An icon 8px to the left of a label; a badge on the corner of a *tab* rather than the panel.

Roblox has no "relative to sibling" primitive. Three honest options, in order of preference:

1. **Re-parent.** Make the element a child of the sibling it tracks, then it is a straddle or inset
   on *that* parent. A notification dot on a tab belongs to the tab.
2. **Wrap both in a container** with a `UIListLayout` and let the layout hold the relationship.
3. **Chain offsets** — only when the sibling's size is fixed and known.

If a placement table has an element whose "owner" is really a sibling, that is a signal the tree is
wrong. Fix the hierarchy rather than encoding the relationship in arithmetic.

---

## Choosing between INSET and STRADDLE at a glance

Look at where the element's **centre** falls relative to the frame's edge:

| Centre is… | Class | Anchor |
|---|---|---|
| well inside | INSET | the nearest corner |
| on the edge (±a few px) | STRADDLE | `(0.5, 0.5)` |
| outside the edge | OUTSIDE | the side facing the frame |

Measuring the *centre* rather than the nearest corner is what makes this decidable. An element's
corner being outside tells you little; its centre being on the edge tells you the author pinned it
there deliberately.
