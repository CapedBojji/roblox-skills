# The frame spec

Write it to `<storyRoot>/<PascalName>.frame.md`, beside the story it produces.

## Confidence markers

Every number carries one. They tell a reviewer where to look.

| Marker | Meaning |
|---|---|
| `[M]` | **Measured** — read off a full-resolution screenshot |
| `[E]` | **Estimated** — eyeballed from an image (colors, text sizes, cropped captures) |
| `[X]` | **Extracted** — read from an instance tree. Authoritative |
| `[C]` | **Chosen** — invented, because the input was a description |

A spec built from an instance tree should be uniformly `[X]`. If an `[E]` appears on that path,
something was estimated that should have been read.

## Template

````markdown
# Frame Spec — <Name>

## Subject
<One sentence naming the panel.>
Rejected candidates: <other panels visible in the reference, and why not>

## Reference
Input: screenshot | instance-tree | description
Source: <path, or "user description">
Screen resolution: <WxH> (given | inferred | assumed)
Panel bbox in reference: x <a>–<b>, y <c>–<d>  →  <w> × <h> of screen

## Boundary

### Included
| Element | Class | Why (test) |
|---|---|---|

### Excluded
| Element | Why (test) | Cut point in tree |
|---|---|---|

### Context (present in the reference, outside the frame)
| Element | Note |
|---|---|

## Geometry
Design canvas: <WxH>
Root: Size <UDim2> [?], AnchorPoint <Vector2>, Position <UDim2>
Scale/offset rationale:
- <one line per node that deviates from the default rule>

## Tree
```
<Name> (Frame)
├─ UICorner
├─ Header (Frame)
│  ├─ Title (TextLabel)
│  └─ Close (ImageButton)
└─ Body (ScrollingFrame)          ← CUT: children are content
   ├─ UIListLayout
   └─ Placeholder (Frame)
```

## Nodes
Role, placement class and relations come from the `roblox-element-placement` skill. `Place` is one of
INSET / STRADDLE / OUTSIDE / CENTRED / FILL / FLOW — a STRADDLE means part of the element sits
outside the frame on purpose, and FLOW means `Position` is layout-driven and must be left blank.

| Name | Role | Class | Place | Size | Position | AnchorPoint | Relations | Conf |
|---|---|---|---|---|---|---|---|---|

## Palette
| Slot | Color3.fromRGB | Used by |
|---|---|---|

## Placeholders
| Stands in for | Node | Note |
|---|---|---|

## Controls
| Control | Type | Default | Drives |
|---|---|---|---|

## Assumptions / open questions
- <every guess, every thing the input could not tell you>
````

## Worked example

````markdown
# Frame Spec — ShopPanel

## Subject
The centered shop window with a header, a three-tab category strip, and a scrolling grid of items.
Rejected candidates: the HUD coin pill in the top-right (a separate frame, not contained by this one).

## Reference
Input: screenshot
Source: refs/shop.png (1920×1080, full-screen capture)
Screen resolution: 1920×1080 (given — the capture is full-screen)
Panel bbox in reference: x 520–1400, y 180–900  →  0.458 × 0.667 of screen

## Boundary

### Included
| Element | Class | Why (test) |
|---|---|---|
| ShopPanel | Frame | the subject |
| Shadow | ImageLabel | empty-state — chrome |
| Header | Frame | empty-state |
| Title "SHOP" | TextLabel | empty-state |
| CoinCount "1,240" | TextLabel | empty-state — structure stays, value is a control |
| Close | ImageButton | empty-state |
| TabStrip | Frame | empty-state |
| TabWeapons / TabArmor / TabPotions | TextButton | count — three authored categories, not data-driven |
| ItemList | ScrollingFrame | empty-state — the container survives, empty |

### Excluded
| Element | Why (test) | Cut point in tree |
|---|---|---|
| Item cards (12 visible) | count — one per SKU | children of ItemList |
| Per-card icon, name, price | count | descendants of each card |

### Context (present in the reference, outside the frame)
| Element | Note |
|---|---|
| Dim backdrop | rgb(0,0,0) at ~0.5 transparency, sibling on the ScreenGui — not part of this panel |
| HUD coin pill, top-right | separate frame |

## Geometry
Design canvas: 1920×1080
Root: Size UDim2.fromScale(0.458, 0.667) [M], AnchorPoint (0.5, 0.5), Position fromScale(0.5, 0.5)
Scale/offset rationale:
- Header height is offset (56px) — chrome should not grow with the screen
- TabStrip height is offset (44px) — same reason
- ItemList uses `UDim2.new(1, -32, 1, -132)` — fills the remainder minus a 16px gutter and the
  header+tabs stack above it
- Grid CellSize is offset (120×120) — scale cells wrap unpredictably

## Tree
```
ShopPanel (Frame)
├─ UICorner
├─ Shadow (ImageLabel)
├─ Header (Frame)
│  ├─ Title (TextLabel)
│  ├─ CoinCount (TextLabel)
│  └─ Close (ImageButton)
├─ TabStrip (Frame)
│  ├─ UIListLayout
│  ├─ TabWeapons (TextButton)
│  ├─ TabArmor (TextButton)
│  └─ TabPotions (TextButton)
└─ ItemList (ScrollingFrame)          ← CUT: children are one-per-SKU
   ├─ UIGridLayout
   └─ Placeholder (Frame)
```

## Nodes
Role, placement class and relations come from the `roblox-element-placement` skill. `Place` is one of
INSET / STRADDLE / OUTSIDE / CENTRED / FILL / FLOW — a STRADDLE means part of the element sits
outside the frame on purpose, and FLOW means `Position` is layout-driven and must be left blank.

| Name | Role | Class | Place | Size | Position | AnchorPoint | Relations | Conf |
|---|---|---|---|---|---|---|---|---|
| ShopPanel | panel | Frame | — | `fromScale(0.458, 0.667)` | `fromScale(0.5, 0.5)` | `(0.5, 0.5)` | — | [M] |
| — UICorner | — | UICorner | — | — | — | — | modifier | [E] |
| Shadow | drop shadow | ImageLabel | FILL (neg. gutter) | `new(1, 24, 1, 24)` | `fromOffset(-12, -8)` | `(0, 0)` | `ZIndex 0`, behind panel | [E] |
| Header | group | Frame | INSET | `new(1, 0, 0, 56)` | `fromOffset(0, 0)` | `(0, 0)` | contains Title, CoinCount | [M] |
| Title | header title | TextLabel | STRADDLE top | `new(0.5, 0, 1, 0)` | `fromOffset(20, 0)` | `(0, 0.5)` | ink overhangs top edge | [E] |
| CoinCount | currency readout | TextLabel | INSET | `fromOffset(120, 24)` | `new(1, -56, 0.5, 0)` | `(1, 0.5)` | `right-of` Title | [E] |
| Close | close button | ImageButton | STRADDLE top+right | `fromOffset(32, 32)` | `new(1, -12, 0, 16)` | `(0.5, 0.5)` | `centre-aligned-y` Header | [M] |
| TabStrip | tab strip | Frame | INSET | `new(1, -32, 0, 44)` | `fromOffset(16, 56)` | `(0, 0)` | `immediately-below` Header | [M] |
| — UIListLayout | — | UIListLayout | — | — | — | — | `Horizontal`, `Padding (0,8)`, `SortOrder LayoutOrder` | [E] |
| TabWeapons | tab | TextButton | FLOW | `fromOffset(110, 44)` | *layout-driven* | `(0, 0)` | `LayoutOrder 1`; `same-size-as` sibling tabs | [M] |
| ItemList | scroll container | ScrollingFrame | INSET | `new(1, -32, 1, -132)` | `fromOffset(16, 116)` | `(0, 0)` | `immediately-below` TabStrip | [M] |
| — UIGridLayout | — | UIGridLayout | — | — | — | — | `CellSize (0,120)`, `CellPadding (0,8)` | [M] |
| Placeholder | item slot | Frame | FLOW | `fromOffset(120, 120)` | *layout-driven* | `(0, 0)` | stands in for content | [C] |

`TabArmor` and `TabPotions` match `TabWeapons` with `LayoutOrder` 2 and 3.

## Palette
| Slot | Color3.fromRGB | Used by |
|---|---|---|
| surface | `(24, 28, 38)` | ShopPanel |
| surfaceRaised | `(34, 40, 54)` | tabs, Placeholder |
| stroke | `(58, 66, 84)` | UIStroke, Divider |
| textPrimary | `(238, 242, 248)` | Title |
| textMuted | `(148, 160, 180)` | CoinCount |
| accent | `(56, 189, 248)` | selected tab |

## Placeholders
| Stands in for | Node | Note |
|---|---|---|
| 12 item cards | Placeholder | one only; proves CellSize and CellPadding |

## Controls
| Control | Type | Default | Drives |
|---|---|---|---|
| title | string | `"SHOP"` | Title.Text |
| coins | string | `"1,240"` | CoinCount.Text |
| selectedTab | select | `"Weapons"` | which tab gets the accent color |
| accent | color | `(56, 189, 248)` | selected tab fill |

## Assumptions / open questions
- The capture is full-screen, so panel scale is measured rather than assumed.
- Corner radius, text sizes and the exact palette are eyeballed from a compressed PNG; the panel is
  slightly translucent over the dim backdrop, so sampled colors read darker than the true
  `BackgroundColor3`. Expect to correct these during the visual compare.
- The close button's `Image` is an `rbxassetid://` and will render as a grey placeholder in the
  preview. That is a renderer limitation, not a mismatch.
- Cannot tell from a still image whether `ItemList` actually scrolls, or whether `ClipsDescendants`
  is set on the panel. Both assumed true.
- Whether the tab count is authored or data-driven is inferred from the labels being distinct
  category names. If they are dynamic, `TabStrip` stays and the tabs become content.
````
