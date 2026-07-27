# Element roles

Before you can say where something goes, you have to say **what it is**. This is the vocabulary.

Each role gives its **visual signature** (how to recognise it), **typical owner**, **expected
placement**, what it **maps to**, and whether its **value is a control**.

> **Expected placement is a cross-check, never an override.** If the measurement disagrees with the
> convention, something is interesting: either you mis-identified the element, or the design is
> deliberately unusual. Say which. Measurement always wins.

## Panel chrome

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **close button** | small square, high-contrast fill (usually red), `X` glyph or icon, at a top corner | the panel it dismisses | **STRADDLE** on the top-right corner — overhangs both edges | `ImageButton`, or `TextButton` + `UICorner` + `UIStroke` | no |
| **back button** | arrow or chevron glyph, top-left | the panel | STRADDLE or INSET top-left | `ImageButton` | no |
| **header title** | largest text in the panel, heavy display face, often outlined, upper-left | the panel it names | **STRADDLE top** — heavy titles routinely overhang the top edge | `TextLabel` + `TextStrokeTransparency` | yes (the string) |
| **header icon** | small sprite immediately left of the title, same centre line | the panel | **STRADDLE** on the left edge or top-left corner | `ImageLabel` | no |
| **header banner / ribbon** | a shaped plate behind the title, wider than the text | the panel | STRADDLE top, `ZIndex` below the title | `ImageLabel` 9-slice | no |
| **divider** | 1–2px line, full width, directly under the header | the panel | INSET, full width minus gutters | `Frame`, height offset 1–2 | no |
| **drop shadow** | soft dark halo, larger than the panel, offset down | the panel | **FILL with a negative gutter**, `ZIndex` 0 — not a straddle | `ImageLabel` 9-slice | no |
| **resize / drag handle** | grip dots or a bar, a corner or the title bar | the panel | INSET corner, or the header itself | `Frame` + `UIDragDetector` | no |

## Readouts

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **counter / capacity** | `n/m` form, small, muted label + coloured value | the panel header | INSET, right side of the header | `TextLabel`, or two for label/value colouring | yes |
| **currency readout** | coin/gem icon + abbreviated number (`456M`) | header, or the HUD | INSET; icon `immediately-left-of` the number, centre-aligned-y | `ImageLabel` + `TextLabel` in a group | yes |
| **price tag** | small coin icon + number, on an item card | the card | INSET bottom of the card | group | yes |
| **rate / per-second** | number + `/s`, gold or accent coloured | detail pane | INSET, centred | `TextLabel` | yes |
| **timer** | clock icon + `mm:ss` | panel or HUD | INSET corner | group | yes |
| **rarity pill** | short word in a small rounded capsule, saturated fill | item card or detail pane | INSET, centred under the name | `Frame` + `UICorner(0.5,0)` + `TextLabel` | yes |
| **notification badge** | tiny filled circle, often with a count, on a corner of *another control* | **the control it marks**, not the panel | **STRADDLE** the owner control's corner — re-parent to that control | `Frame` + `UICorner` | yes |

## Composite and structural

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **stat row** | bordered box holding icon + small label + large value, repeated in a column | the panel or its column | FLOW in a vertical run | `Frame` + `UICorner` + a group inside | the value is |
| **status line** | tick/cross glyph + a sentence, near the top | the panel | INSET, below the header | `ImageLabel` + `TextLabel`, grouped | text and state are |
| **decorative connector** | arrow, chevron or line *between* two groups, pointing from one to the other | the panel — **not** either group | **CENTRED between** the two; measure against the frame and record `right-of A` / `left-of B` | `ImageLabel` | no |

A connector is worth calling out because ownership is counter-intuitive: an arrow between a
before-column and an after-column belongs to the panel, not to either column, and its whole meaning
is the relation it expresses. Record both neighbours, not just a position.

## Navigation

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **tab strip** | horizontal band of same-size buttons under the header | the panel | INSET, full width minus gutters | `Frame` + `UIListLayout` | no |
| **tab** | one button in the strip; the active one differs in fill | the strip | FLOW — `LayoutOrder`, `Position` ignored | `TextButton` | selection is |
| **pagination dots** | small circles in a row | the panel | INSET, centred at the bottom | `Frame` + `UIListLayout` | index is |

## Content containers

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **scroll container** | a region with clipped partial rows at its top or bottom edge | the panel | INSET, fills the body | `ScrollingFrame` + `AutomaticCanvasSize` | no |
| **item slot / card** | repeated same-size tile inside a container | the container | FLOW — one per datum, so this is **content**, not frame | `Frame` | it *is* the data |
| **detail / preview pane** | a distinct sub-panel showing one selected thing | the panel | INSET, right or bottom | `Frame` + `UICorner` | no (its contents are) |
| **avatar / model preview** | a portrait region, often circular | the detail pane | INSET, centred at the top | `ViewportFrame`, or `ImageLabel` | yes |
| **empty-state illustration** | art plus a "nothing here" message | the container | CENTRED in the container | group, `Visible = false` when populated | no |

## Actions and inputs

| Role | Visual signature | Owner | Expected placement | Maps to | Value is a control |
|---|---|---|---|---|---|
| **primary action** | widest / most saturated button, usually green | panel or detail pane | INSET bottom, often in a row | `TextButton` | label is |
| **secondary / destructive** | paired with the primary, red or muted | same row | FLOW inside the button row | `TextButton` | label is |
| **search field** | rounded box with a magnifier and placeholder text | header | INSET | `TextBox` | text is |
| **filter dropdown** | box with a chevron | header or strip | INSET | `TextButton` + a popup frame | selection is |
| **toggle / checkbox** | small square or pill with an on/off state | a settings row | INSET right of the row | `ImageButton` / `TextButton` | state is |
| **slider** | track with a draggable knob | a settings row | INSET right, fills remaining width | `Frame` + knob | value is |
| **progress / XP bar** | long thin track with a coloured fill and often `n/m` text | the panel | INSET, near-full width | `Frame` track + `Frame` fill | fill fraction is |

## Recognising a role from pixels

Work down this list; the first confident answer wins.

1. **Glyph or symbol.** `X` at a corner → close. Arrow at the left → back. Magnifier → search.
2. **Position plus size.** Largest text in the upper-left → header title. Small sprite immediately
   left of it, same centre line → header icon.
3. **Repetition.** Same size, evenly spaced, more than three of them → item slots (content) or tabs
   (chrome). The *count test* separates those: data-driven → content, authored → chrome.
4. **Containment and clipping.** A region with partial rows at its edge → scroll container.
5. **Contrast.** The most saturated button in a group → the primary action.

If none fits, name what you see and say the role is unknown. An honest "unclassified: small purple
capsule under the name, probably a status badge" is far better than forcing it into a role and then
inheriting that role's expected placement.

## Using the cross-check

```
Close — close button
  expected : STRADDLE on the top-right corner
  measured : STRADDLE — 9px past the top edge, 11px past the right edge
  verdict  : agrees
```

```
Title — header title
  expected : STRADDLE top (heavy display titles usually overhang)
  measured : INSET — fully inside, nearest edge top at +18px
  verdict  : DISAGREES — either this design tucks its title in, or the glyph box was measured
             without its outline. Re-measure including TextStroke before accepting INSET.
```

That second case is not hypothetical: it is exactly the error that put a title fully inside a panel
when the reference had it overhanging by 12px.
