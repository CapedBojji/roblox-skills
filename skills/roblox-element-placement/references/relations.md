# Relations between elements

Placement against the frame is only half the description. "The title is 62px from the left edge" is
true and useless; "the title sits immediately right of the header icon, sharing its centre line" is
what a person actually means, survives a change in icon width, and tells you the two belong in a
container together.

Relations are also **how you discover layouts.** Three evenly-spaced, centre-aligned siblings are a
`UIListLayout` — not three hand-tuned positions. Without relations you will hand-place everything,
which is brittle and does not match how the UI was authored.

## Vocabulary

| Relation | Holds when | Why it matters |
|---|---|---|
| `immediately-right-of` | gap is small and positive, vertical spans overlap | reading order; candidate for a horizontal layout |
| `immediately-left-of` | mirror of the above | |
| `immediately-below` / `above` | small positive vertical gap, horizontal spans overlap | candidate for a vertical layout |
| `right-of` / `below` | same band, but a wide gap | ordering context; **not** a layout candidate — the gap is doing deliberate separating work |
| `centre-aligned-y` | `\|cyA − cyB\| ≤ tol` | the two sit on one line; implies `VerticalAlignment = Center` |
| `centre-aligned-x` | `\|cxA − cxB\| ≤ tol` | a vertical stack, centred |
| `baseline-aligned` | text bottoms agree, centres do not | typographic alignment; different sizes on one baseline |
| `same-size-as` | width and height agree within tol | a repeated element — a tab, a slot, a button pair |
| `evenly-spaced-with` | consecutive gaps agree within tol | the strongest layout signal there is |
| `contained-by` | one box wholly inside another | a real parent/child, or just overlap — check ownership |

## Detection

```
gapX  = b.x0 - a.x1                  # positive: b is right of a
gapY  = b.y0 - a.y1
overlap(a0,a1,b0,b1) = (min(a1,b1) - max(a0,b0)) / min(a1-a0, b1-b0)
```

- **Adjacent on X** when `gapX >= -tol`, vertical `overlap > 0.5`, and
  `gapX <= max(24, 0.5 × min(widthA, widthB))`. Scaling the threshold to the *smaller* element is
  what keeps a 47px icon next to a 265px title reading as adjacent while two distant labels do not.
- **Aligned** when the centre delta is within tolerance — use ~6px for text, whose glyph box wobbles
  with ascenders and descenders.
- **Evenly spaced** when the spread of consecutive gaps is within a few px.

`../scripts/place.mjs` computes all of this from bounding boxes. Symmetric relations
(`centre-aligned-*`, `same-size-as`) are reported once, not twice.

## Groups

When a set of elements is **adjacent + aligned + evenly spaced**, they are a group. Emit a container
for them, place the *container* against the frame, and place the members inside it.

```
GROUPS
  HeaderIcon + Title   [horizontal run]
    gaps 14px  (mean 14, spread 0)
    group box: x 74–400, y 76–132
    suggests: UIListLayout{ FillDirection = Enum.FillDirection.Horizontal,
                            Padding = UDim.new(0, 14),
                            VerticalAlignment = Enum.VerticalAlignment.Center,
                            SortOrder = Enum.SortOrder.LayoutOrder }
```

That reads directly as:

```lua
UI.create("Frame", {
  Name = "Header",
  Size = UDim2.fromOffset(326, 56),
  Position = UDim2.new(0, 3, 0, 17),      -- the GROUP straddles the frame's left edge
  AnchorPoint = Vector2.new(0, 0.5),
  BackgroundTransparency = 1,
}, {
  UI.create("UIListLayout", {
    FillDirection = Enum.FillDirection.Horizontal,
    Padding = UDim.new(0, 14),
    VerticalAlignment = Enum.VerticalAlignment.Center,
    SortOrder = Enum.SortOrder.LayoutOrder,
  }),
  icon,   -- LayoutOrder 1
  title,  -- LayoutOrder 2
})
```

**The group inherits the straddle.** If the leftmost member hangs off the frame's left edge, the
group's box does too — so the group is what straddles, and its members become FLOW inside it. This
is much more robust than giving each member its own overhanging position: change the icon's width
and the title follows automatically.

## Test top-alignment as well as centre-alignment

`centre-aligned-y` within tolerance does not prove the author centred anything. Check the **tops**
too and take whichever agrees more tightly.

In the reference used here, the header icon and title have centres 5px apart but tops 1px apart.
They are top-aligned, and a `UIListLayout` with `VerticalAlignment = Center` puts the title 5px too
low — an error small enough to survive any visual comparison and large enough to be wrong. The
numeric diff is what separates the two hypotheses.

## Anchor a group by the edge it straddles

A group's `Position` should be expressed from the edge it is pinned to, with `AnchorPoint` on that
same edge — not from its centre. Centre-anchoring makes the group's left edge depend on the *total
width of its members*, so widening one member silently drags the whole group sideways.

```lua
-- WRONG: widen the title and the group's left edge moves
AnchorPoint = Vector2.new(0.5, 0.5)
Position    = UDim2.new(0, 142, 0, 17)

-- RIGHT: the straddled edge is pinned; member sizes cannot move it
AnchorPoint = Vector2.new(0, 0)
Position    = UDim2.new(0, -21, 0, -11.5)
```

## When *not* to make a group

- **Two elements, uneven gap, no shared alignment.** Just position them.
- **Gaps that vary deliberately** — a left-aligned title and a right-aligned counter are not a run;
  the space between them is doing work. `place.mjs` reports these as `right-of` rather than
  `immediately-right-of`, and refuses to suggest a layout when the gap spread is large.
- **Elements with different owners.** A close button and a title may be centre-aligned by
  coincidence of the header band. Alignment is not ownership — check `attribution.md`.

That last one is worth care: in the reference used to build this skill, the close button is
centre-aligned-y with both the header icon and the title, because all three sit in the header band.
But the close button is anchored to the *right* edge and the header group to the *left*. Putting all
three in one layout would be wrong. **A relation is evidence, not an instruction.**

## Recording relations

In a placement record:

```
rel : immediately-right-of HeaderIcon (14px); centre-aligned-y with HeaderIcon (Δ3px)
```

In a frame spec's Nodes table, a `Relations` column carrying the same, abbreviated. Anything
`layout-driven` needs no `Position` — say so and give the `LayoutOrder` instead.
