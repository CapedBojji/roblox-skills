---
name: roblox-element-placement
description: Go element by element through a Roblox UI reference — every icon, label, badge, button, counter, pill and divider — and for each one work out what it is, what role it plays, which frame owns it, where it sits relative to that frame, and how it relates to its neighbours. Use this whenever recreating or auditing a Roblox UI from a screenshot, mockup, .rbxmx/.rbxlx export or Studio paste; whenever an element's Position or AnchorPoint looks wrong; whenever asked "where does this button go", "which panel does this icon belong to", "what is this element", "why is my close button in the wrong place", "how do I anchor this badge", or "how do I hang this icon off the corner". Also use before writing any Roblox UI with header badges, corner buttons, overhanging titles, notification dots or tabs — the placements CSS instincts get wrong. Pairs with roblox-frame-identification, which finds the frames this skill assigns elements to.
---

# Element placement

Frame identification draws the boundary. This skill fills it in. For **every** element in a
reference, five facts:

> **visual → role → owner → placement → relations**

Read `../roblox-ui-fundamentals/SKILL.md` first for the `UDim2`/`AnchorPoint` model.

## Three mistakes this exists to stop

**1. Assuming an element is inside the frame it belongs to.**

In CSS chrome lives inside its container's padding box. In Roblox **nothing clips by default** —
`ClipsDescendants` is `false` — so a child sitting half outside its parent is the *normal* way to pin
a badge or a corner button. Header titles overhang the top edge. Close buttons straddle the corner.
Icons hang off the left edge. Placing these inside is a different design, not a rounding error.

**2. Assuming containment decides ownership.**

"Which frame does this belong to" is a question about **what it is for**, not which rectangle it sits
in. A close button hanging entirely outside a panel still belongs to that panel. See
`references/attribution.md`.

**3. Only examining the elements that look suspicious.**

This is the one that bites hardest, because it is invisible. Fixing the close button and stopping
there left a title fully inside a panel that the reference had overhanging by 12px — the identical
error, one element over. **Every element gets a record.** No exceptions, no spot-checks.

## Procedure

1. **Measure the frame** — from rows and columns clear of overlapping chrome, cross-checked.
   `references/measuring.md`. Get this wrong and every child inherits the error.
2. **Inventory every element.** List them all before analysing any. If you cannot say what something
   is, record it as unclassified rather than skipping it.
3. **Assign a role** to each — `references/element-roles.md`. This yields an *expected* placement to
   check the measurement against.
4. **Assign an owner** — `references/attribution.md`. The move test, not containment.
5. **Measure and classify, all at once:**

```bash
node <skill>/scripts/place.mjs --frame 95,87,961,570 \
  --element "HeaderIcon:74,76,121,132" \
  --element "Title:135,82,400,121" \
  --element "Close:923,78,972,125"
```

One call with every element, not one call per element — that is what produces relations and groups.

6. **Write the record** for each, and reconcile role-expectation against measurement.

## The record

```
Title — header title
  visual : "BACKPACK", heavy outlined display face, white glyphs on a black stroke
  owner  : BackpackPanel — it names the panel (purpose test)
  place  : STRADDLE top — ink box overhangs 12px above the top edge; centre 22px below it
  rel    : immediately-right-of HeaderIcon (14px); centre-aligned-y with it (Δ3px)
  group  : Header (HeaderIcon + Title) — horizontal run, so the GROUP straddles and members flow
  maps to: TextLabel + TextStrokeTransparency; Text is a control
  check  : expected STRADDLE top for a heavy display title — agrees
```

Every field is mandatory. `check` is where a disagreement between the role's convention and the
measurement gets stated out loud rather than quietly resolved in favour of whichever came first.

## Placement classes

| Class | Test | Idiom |
|---|---|---|
| **INSET** | all four deltas positive | anchor to the nearest corner, inset with negative offsets |
| **STRADDLE** | some delta negative, centre still inside | `AnchorPoint (0.5, 0.5)`, position **on** the edge |
| **OUTSIDE** | centre beyond the frame | anchor to the near edge, push past it |
| **CENTRED** | centre matches the frame centre | `fromScale(0.5, 0.5)` + `AnchorPoint (0.5, 0.5)` |
| **FILL** | covers ≥90% of the frame | `UDim2.new(1, -2g, 1, -2g)` with a gutter |
| **FLOW** | parent has a layout | `LayoutOrder` — `Position` is ignored |

Signed edge deltas decide it — `element.x0 - frame.x0` and friends, positive inside, **negative means
it hangs outside that edge**. Within ~3px is flush, not intentional overhang.

Full definitions and exact expressions: `references/placement-classes.md`.

**The straddle idiom:**

```lua
-- centre exactly on the top-right corner
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.fromScale(1, 0)

-- centre on the left edge, 20px down: most of a wide badge hangs off to the left
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(0, 0, 0, 20)
```

With `AnchorPoint (0.5, 0.5)` exactly half sits outside. Tune with the offset, not by switching to a
corner anchor — a corner anchor stops tracking the edge when the frame resizes.

## Relations and groups

An element's position relative to its *neighbours* is often the real description: "immediately right
of the header icon, sharing its centre line" survives a change in icon width; "62px from the left
edge" does not.

Relations are also how layouts are **discovered**. Adjacent + aligned + evenly spaced ⇒ a
`UIListLayout`, not N hand-placed positions. `place.mjs` reports runs and the layout they imply.

**When a group straddles, the group straddles — not each member.** If the leftmost member hangs off
the frame's left edge, put the overhang on the container and let the members flow inside it. Change
the icon's width later and the title follows automatically.

Beware the false positive: alignment is not ownership. Three elements sharing a header band will all
be `centre-aligned-y` with each other, but a left-anchored header group and a right-anchored close
button do not belong in one layout. `references/relations.md`.

## Gotchas

- **`ClipsDescendants` kills straddles.** Confirm the owning frame does not clip. If the reference
  shows a clipped content region *and* an overhanging badge, the badge is a sibling of the clipper.
- **`ZIndex` matters for overhangs** — under `ZIndexBehavior = Sibling`, ancestors decide.
- **Screenshotting the frame element clips its overhang.** In StoryBlox, `frame.png` captures the
  root's own box, so straddling chrome is cut off by the *capture*. Compare with `stage.png`.
- **Text ink is not the label box**, and whether you include `TextStroke` changes the class. Include
  it. `references/measuring.md`.
- **Drop shadows are FILL with a negative gutter**, not straddles.

## References

- `references/element-roles.md` — the role vocabulary and each role's expected placement
- `references/placement-classes.md` — every class with its exact expression
- `references/relations.md` — sibling relations, grouping, discovering layouts
- `references/attribution.md` — which frame owns an element when geometry is ambiguous
- `references/measuring.md` — how to get honest bounding boxes, and the traps that produce wrong ones
- `scripts/place.mjs` — deltas, classes, anchors, relations, groups
