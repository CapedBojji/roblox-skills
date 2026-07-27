# Which frame owns this element?

**Containment does not decide ownership.** That is the CSS reflex and it is wrong here, in both
directions: elements that belong to a frame routinely sit outside it, and elements drawn on top of a
frame routinely belong to something else.

Ownership is about **what the element is for and what it moves with**.

## The tests, in order

**1. The move test (decisive).** If the frame slid 200px to the right, would this element go with it?
Yes → it belongs to the frame. A close button hanging off the top-right corner moves with the panel,
so it is the panel's child even though most of it is outside.

**2. The lifetime test.** If the frame were destroyed or hidden, would this element go too? A
panel's header badge dies with the panel. The HUD currency pill behind it does not.

**3. The purpose test.** Does it act on the frame, describe the frame, or decorate the frame? Close
buttons, title text, identity icons, resize handles, drop shadows — all owned by the frame they act
on, wherever they happen to sit.

**4. The styling test (weak, corroborating).** Shared palette, corner radius and stroke suggest a
family. Useful for breaking ties, never on its own.

## The cases that trip people up

| Element | Owner | Why |
|---|---|---|
| Close button overhanging the corner | **the panel** | moves and dies with it (move + lifetime) |
| Header badge/icon hanging off the left edge | **the panel** | decorates it (purpose) |
| Title banner overhanging the top | **the panel** | describes it |
| Drop shadow larger than the panel | **the panel** | decoration bound to its silhouette |
| Dim backdrop *behind* the panel | **the ScreenGui** | it dims everything, not just this panel; it is a sibling, not an ancestor-owned child |
| Tooltip drawn on top of the panel | **neither** | its own transient overlay; identify separately |
| Notification dot on a tab | **the tab**, not the panel | it tracks the tab — re-parent it there |
| Currency pill in the panel's header | **the panel** | inside the header, moves with it |
| The same currency pill in the HUD corner | **the HUD** | does not move with the panel |
| A stacked confirm dialog over the panel | **neither** | a separate frame, its own pass |
| Cursor / drag ghost | **neither** | follows input, not the frame |

## When two frames both look plausible

Ask which one the element **tracks**. A badge sitting in the gap between two panels belongs to
whichever it would follow if that panel moved. If the answer is genuinely "neither" — it is anchored
to the screen — then its owner is the `ScreenGui` and it is out of scope for this frame's spec.
Record it under `Context`.

## When the element sits outside every frame

Two possibilities:

1. **It is chrome of a nearby frame**, placed OUTSIDE (a caption below a panel, a tab above one).
   Attribute it to that frame and classify it as OUTSIDE.
2. **It is a peer** belonging to the screen. Record it under `Context` in the frame spec and move on.

The move test separates them. Nothing else reliably does.

## Attribution and the tree

Once ownership is settled, the element becomes a child of that frame in the tree — even when
its geometry sits outside. That is what makes the placement expression work: `Position` is resolved
against the parent, so a straddle is only expressible if the parent is the frame it straddles.

If you find yourself wanting to place an element against a *sibling*, ownership is wrong. Re-parent
it to the thing it actually tracks. See `placement-classes.md` §7.

## Recording it

Every element gets an owner, including the ones outside:

| Element | Purpose | Owner | Placement |
|---|---|---|---|
| Close | dismisses the panel | BackpackPanel | STRADDLE (top, right) |
| HeaderIcon | panel identity badge | BackpackPanel | STRADDLE (left, top) |
| DimBackdrop | dims the world behind | *ScreenGui (context)* | — out of scope |
| Tooltip | describes the hovered slot | *own overlay* | — separate pass |

Elements whose owner is not the subject frame belong in the frame spec's `Context` section, not in
its `Nodes` table.
