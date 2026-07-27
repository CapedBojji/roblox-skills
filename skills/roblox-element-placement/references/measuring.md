# Measuring from a reference

Every placement error this skill exists to prevent started as a *measurement* error. The
classification maths is trivial; getting honest bounding boxes out of an image is the hard part.

## The frame's edges first, and measure them clear of chrome

Everything downstream is expressed relative to the frame, so an error here propagates into every
child.

**Scan for the frame's edge in a row or column that no other element crosses.**

A real failure from this skill's own development: scanning column `x=300` for the first dark pixel
returned `y=84`, and that was taken as the panel's top edge. But `x=300` runs straight through the
title's heavy black outline — the scan found the *text*, not the panel. Columns clear of the title
(`x=500`, `x=700`) both return `y=87`. Everything measured against 84 was 3px out, and the same
method against a thicker banner would be 20px out.

```python
# find a column that only crosses the panel, not its header chrome
for x in (500, 700):           # away from title, icon, close button
    first_dark_y = next(y for y in range(top, bottom) if is_border(px[x, y]))
```

Cross-check two or three separated columns and require them to agree. If they disagree, one of them
is crossing something.

## Text is the worst case

**A glyph bounding box is not the label's `Size`.** A `TextLabel` box is normally taller and wider
than the ink inside it, and alignment decides where the ink sits within it.

- Measure the **ink** — glyphs plus `TextStroke` outline, which on a heavy display face can add
  10px+ on every side.
- Classify placement from the ink's **centre**.
- Then size the label generously and control the ink with `TextXAlignment` / `TextYAlignment`. Do not
  try to make the label box equal the ink box.

Whether you include the outline changes the classification outright. In the reference used here, the
title's white glyphs start 2px above the panel's top edge — under a 3px tolerance, that reads as
INSET. Include the black outline and it starts 12px above — unambiguously STRADDLE. **Include the
outline.** It is part of the element as drawn.

## Colour-predicate boxes bleed

Selecting pixels by colour is the usual way to get a bbox, and it silently swallows neighbours.

Measuring the title with a window of `x 122–520, y 60–150` and a predicate of "white or near-black"
returned a box 397px wide and 74px tall — because the window reached down into the item grid, whose
cards are also outlined in near-black. The title is ~265px wide.

Defences, in order:

1. **Constrain the window tightly** to the element you are after.
2. **Sanity-check the result** against what you see — width, height, aspect. A "title" 397px wide
   when the visible text is ~265px is a failed measurement, not a surprising title.
3. **Prefer a distinctive predicate.** The backpack sprite is brown; nothing else nearby is. That
   measurement was reliable on the first try.
4. **Re-measure with a different window** and require agreement.

## Measure the RENDER through the DOM, never through pixels

Everything above is about the reference, where pixels are all you have. The render is different: the
StoryBlox renderer tags every node with `data-ui-claps-path`, so `preview.mjs --boxes` reads each
node's exact `getBoundingClientRect()` and writes `boxes.json` with panel-relative coordinates and
the computed font size.

**Never measure the render from its screenshot.** Two artefacts encountered while doing exactly that:

- An element screenshot includes whatever is behind the element inside its box. The top ~15px of a
  `stage.png` was solid white *page background*, which a "white = glyph" predicate reported as 500px
  of title ink.
- Glyphs are drawn with subpixel antialiasing, so their edges carry blue and orange fringing. Any
  strict colour test either misses those pixels or catches neighbouring ones.

`boxes.json` has neither problem, and `verify-placement.mjs` diffs it against the reference numbers.

## Text width is font-dependent — do not compare it

The same string at the same cap height occupies a very different width in a condensed display face
than in the preview's font stack: 265px versus ~400px for one 8-character title. **Left edge, top
edge and ink height are real geometry. Width is not.** Size text boxes for the widest font you
expect, and compare only the parts that mean something.

`TextScaled` does not help here: the StoryBlox renderer does not implement it. `fontSize` comes from
`TextSize`, clamped by `UITextSizeConstraint`. To make ink match a measured ink height, set
`TextSize ≈ inkHeight / 0.72`.

## Tolerance

**~3px is flush.** Anti-aliasing, outlines and compression all move an edge by a pixel or two.
Treat anything larger as intentional.

For **alignment** between text elements use ~6px: glyph boxes shift with ascenders and descenders,
so two labels that are authored centre-aligned can measure 4–5px apart.

## Order of work

1. Frame bbox, from clear rows/columns, cross-checked.
2. Each element's bbox, with a tight window and a distinctive predicate.
3. Sanity-check every box against the visible image before using any of it.
4. Feed frame + all elements to `../scripts/place.mjs` in one call, so relations and groups are
   computed too.
5. Only then write positions.

## What the reference cannot tell you

Record these as assumptions rather than inventing values:

- `ZIndex` order, except where something visibly occludes something else
- `ClipsDescendants` — invisible unless something is actually cut off
- whether a region scrolls (partial rows at an edge are good evidence)
- `AutomaticSize`
- hover, pressed and selected states — a still shows one state
- whether repeated elements are authored or data-driven, which decides chrome vs content

## Mockup sheets are not screenshots

If the reference is a design sheet with several panels arranged for presentation, the panels' sizes
and positions **relative to the sheet** are not their sizes relative to a game screen. Measure each
panel's *internal* geometry and its own aspect ratio — those are real — and mark the panel's screen
fraction as chosen rather than measured.
