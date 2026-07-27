---
name: roblox-element-placement
description: Go element by element through a Roblox UI reference — every icon, label, badge, button, counter, pill and divider — and for each one work out what it is for, which frame owns it, and exactly where it sits relative to that frame, including when it hangs outside the frame's bounds. Use this whenever recreating or auditing a Roblox UI from a screenshot, mockup, .rbxmx/.rbxlx export or Studio paste; whenever an element's Position or AnchorPoint looks wrong; whenever asked "where does this button go", "which panel does this icon belong to", "why is my close button in the wrong place", "how do I anchor this badge", or "how do I hang this icon off the corner". Also use before writing any Roblox UI that has header badges, corner buttons, overhanging icons, notification dots, or tabs — the placements CSS instincts get wrong. Pairs with roblox-frame-identification, which finds the frames this skill assigns elements to.
---

# Element placement

Frame identification draws the boundary. This skill fills it in: for every element in a reference,
**what is it for, which frame owns it, and where does it sit relative to that frame.**

Read `../roblox-ui-fundamentals/SKILL.md` first for the `UDim2`/`AnchorPoint` model.

## The two mistakes this skill exists to stop

**1. Assuming an element is inside the frame it belongs to.**

In CSS, chrome lives inside its container's padding box; anything else needs `overflow: visible` and
deliberate negative margins, so it is rare. In Roblox **nothing clips by default** — `ClipsDescendants`
is `false` — so a child sitting half outside its parent is not a hack, it is the *normal* way to pin
a badge or a close button to an edge. Real Roblox UI does this constantly:

- a close button whose centre sits on the frame's top-right corner
- a header icon whose centre sits on the frame's left edge, most of it hanging outside
- a title banner overhanging the top edge
- a notification dot on the corner of a tab

If you place these fully inside, the layout is *wrong* — not slightly off, but a different design.
Measure before you place.

**2. Assuming containment decides ownership.**

"Which frame does this belong to" is a question about **what it is for**, not about which rectangle
it happens to sit in. A close button hanging entirely outside the panel still belongs to the panel.
A tooltip drawn on top of a panel belongs to neither — it is its own overlay. See
`references/attribution.md`.

## Procedure

For each element, in order:

1. **Name and purpose.** One short phrase: `Close — dismisses the panel`. If you cannot say what it
   is for, you have not identified it; look again.
2. **Owning frame.** Apply the attribution tests. Record it even when the element sits outside.
3. **Measure.** Get the element's bounding box and its frame's bounding box in reference pixels.
4. **Classify and place.** Compute signed edge deltas and read off the class. Use the script:

```bash
node <skill>/scripts/place.mjs --frame 95,84,961,570 --element 923,78,972,125 \
     --name Close --class TextButton
```

```
Close (TextButton)  49 x 47
  edge deltas (positive = inside):  left +828  top -6  right -11  bottom +445
  centre relative to frame: (853, 18)  =  (0.984, 0.036) of frame

  CLASS: STRADDLE — 6px past the top edge, 11px past the right edge

  Size        = UDim2.fromOffset(49, 47)
  AnchorPoint = Vector2.new(0.5, 0.5)
  Position    = UDim2.new(1, -13, 0, 18)
```

**A negative delta means the element hangs outside that edge.** That is the whole test, and it is
the one an eyeball reliably gets wrong.

## The signed-delta rule

With `y` growing downward, for element `e` inside frame `f`:

```
left   = e.x0 - f.x0        right  = f.x1 - e.x1
top    = e.y0 - f.y0        bottom = f.y1 - e.y1
```

Positive = inside that edge. Negative = hanging outside it. Anything within ~3px is flush, not
intentional overhang — that is measurement noise.

## Placement classes

| Class | Test | Idiom |
|---|---|---|
| **INSET** | all four deltas positive | anchor to the nearest corner, inset with negative offsets |
| **STRADDLE** | some delta negative, centre still inside | `AnchorPoint (0.5, 0.5)`, position **on** the edge |
| **OUTSIDE** | centre beyond the frame | anchor to the near edge, push past it |
| **CENTRED** | centre matches the frame centre | `fromScale(0.5, 0.5)` + `AnchorPoint (0.5, 0.5)` |
| **FILL** | covers ≥90% of the frame | `UDim2.new(1, -2g, 1, -2g)` with a gutter |
| **FLOW** | inside a parent that has a layout | `LayoutOrder` — `Position` is ignored |

Full definitions, the exact expression for each, and the sibling-relative case are in
`references/placement-classes.md`.

**The straddle idiom** is the one to internalise. To put an element's centre on a frame's edge or
corner, anchor it at its own centre and position it at the frame's extreme:

```lua
-- centre exactly on the top-right corner
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.fromScale(1, 0)

-- centre on the right edge, 18px down from the top
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(1, 0, 0, 18)

-- centre on the left edge, 20px down  (most of the badge hangs off to the left)
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(0, 0, 0, 20)
```

Because `AnchorPoint` is `(0.5, 0.5)`, exactly half the element sits outside. Shift the balance with
the offset, not by changing to a corner anchor.

## Output

A placement table, one row per element, grouped by owning frame:

| Element | Purpose | Owner | Class | Size | AnchorPoint | Position |
|---|---|---|---|---|---|---|
| HeaderIcon | panel identity badge | BackpackPanel | STRADDLE (L,T) | `fromOffset(47, 56)` | `(0.5, 0.5)` | `new(0, 3, 0, 20)` |
| Title | panel name | BackpackPanel | INSET | `fromOffset(265, 39)` | `(0, 0.5)` | `new(0, 40, 0, 18)` |
| Close | dismisses the panel | BackpackPanel | STRADDLE (T,R) | `fromOffset(49, 47)` | `(0.5, 0.5)` | `new(1, -13, 0, 18)` |

This drops straight into the `Nodes` table of a `roblox-frame-identification` frame spec.

## Gotchas

- **`ClipsDescendants` kills straddles.** If the owning frame clips, an overhanging child is cut off.
  When you place a straddle, confirm the frame does not clip — and if the reference shows a clipped
  content region *and* an overhanging badge, the badge is a sibling of the clipper, not a child.
- **`ZIndex` matters for overhangs.** An element hanging over a neighbouring frame needs to win the
  stacking order, and under `ZIndexBehavior = Sibling` that is decided by its ancestors.
- **Screenshotting the frame element clips its overhang.** When verifying in StoryBlox, `frame.png`
  captures the root element's own box, so straddling chrome is cut off by the *capture*, not by the
  UI. Compare with `stage.png` instead.
- **Text bounding boxes are the glyphs, not the label.** A `TextLabel` is usually larger than its
  visible text. Measure the glyph extent, then decide the label box and alignment separately.
- **Drop shadows read as overhang.** A 9-slice shadow is deliberately larger than its frame. It is a
  child of the frame, `ZIndex` below it — classify it as FILL-with-negative-gutter, not a straddle.

## References

- `references/placement-classes.md` — every class with its exact expression, plus flow and sibling-relative
- `references/attribution.md` — which frame owns an element when geometry is ambiguous
- `scripts/place.mjs` — signed deltas, classification, and the emitted anchor/position
