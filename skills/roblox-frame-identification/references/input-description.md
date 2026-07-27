# Input: a plain-text description

Nothing exists yet, so identification is **decision**, not extraction. Everything is marked `[C]`.

The failure mode on this path is inventing arbitrary numbers silently, producing a frame that is
technically valid and visually incoherent. The fix is to draw from a fixed default kit and to list
every choice at the end so the user can correct all of them in one pass.

## 1. Pick an archetype

| Archetype | Root Size | Position / AnchorPoint | Use for |
|---|---|---|---|
| `centered-modal` | `fromScale(0.45, 0.6)` | `fromScale(0.5, 0.5)` / `(0.5, 0.5)` | shop, inventory, settings, confirm dialogs |
| `side-drawer` | `fromScale(0.3, 1)` | `fromScale(0, 0)` / `(0, 0)` (or right edge) | quest log, chat, friends list |
| `hud-corner-cluster` | `fromOffset(220, 96)` | `new(1, -16, 0, 16)` / `(1, 0)` | currency, minimap, timers |
| `bottom-bar` | `fromScale(1, 0.12)` | `fromScale(0, 1)` / `(0, 1)` | hotbar, action bar |
| `full-screen-menu` | `fromScale(1, 1)` | `fromScale(0, 0)` / `(0, 0)` | main menu, pause screen |
| `toast` | `fromOffset(320, 64)` | `new(0.5, 0, 0, 24)` / `(0.5, 0)` | notifications |

If the description does not clearly match one, ask — do not average two of them.

## 2. Fill the standard slots

| Slot | Default | Notes |
|---|---|---|
| Header height | `48` offset | `56` if it holds an icon and a secondary readout |
| Footer height | `56` offset | only when there is a fixed action row |
| Panel padding | `16` offset | via `UIPadding` on the panel |
| Corner radius | `UDim.new(0, 12)` | `UDim.new(0, 8)` for inner elements |
| Stroke thickness | `1` | `Transparency` around `0.5` |
| Divider | `1` offset tall, full width | under the header |
| Title `TextSize` | `22` | `TextXAlignment = Left` |
| Body `TextSize` | `16` | |
| Muted `TextSize` | `13` | |
| Close button | `fromOffset(32, 32)`, `AnchorPoint (1, 0.5)`, `Position new(1, -12, 0.5, 0)` | |
| List gap | `UDim.new(0, 8)` | `UIListLayout.Padding` |
| Grid cell | `fromOffset(120, 120)`, padding `fromOffset(8, 8)` | inventory-style |

Everything in this table is offset, deliberately — it is all chrome, and per
`roblox-ui-fundamentals` chrome does not grow with the screen. The **root** is the thing in scale.

## 3. Pick a palette

Six slots, dark theme by default. Say so, and offer to flip it.

| Slot | `Color3.fromRGB` | Used by |
|---|---|---|
| surface | `(24, 28, 38)` | the panel |
| surfaceRaised | `(34, 40, 54)` | rows, tabs, placeholders |
| stroke | `(58, 66, 84)` | `UIStroke`, dividers |
| textPrimary | `(238, 242, 248)` | titles, body |
| textMuted | `(148, 160, 180)` | secondary text |
| accent | `(56, 189, 248)` | selected state, primary button |

Light theme: surface `(248, 250, 252)`, surfaceRaised `(255, 255, 255)`, stroke `(210, 216, 226)`,
textPrimary `(15, 23, 42)`, textMuted `(100, 116, 139)`, accent `(14, 165, 233)`.

## 4. The boundary rule still applies

A description that mentions data — "a list of items", "a grid of slots", "showing your friends" —
is an immediate **Excluded** row plus exactly one `Placeholder`. Do not build twelve slots because
the user said "a grid of slots". The boundary rule is identical on this path; it is just easier to
get wrong, because inventing content is as cheap as inventing chrome.

If the description mentions no data at all (a confirm dialog, a toast), write
"none — this frame has no data-driven content" in the Excluded table rather than leaving it blank.

## 5. Surface the decisions

End with a compact list, eight bullets maximum, of what you chose. This is the whole point of the
path — the user described a panel in one sentence and got fifty numbers back, and they need to be
able to correct them cheaply.

```markdown
## Decisions I made — say the word to change any

- Archetype: centered-modal at 45% × 60% of screen
- Dark palette (surface rgb(24,28,38), accent rgb(56,189,248))
- 48px header with the title left-aligned, 32px close button top-right
- Body is a ScrollingFrame with a UIGridLayout, 120×120 cells
- One grey Placeholder stands in for the item cards
- 12px corner radius, 1px stroke, 16px padding throughout
- Title 22px, body 16px
```

Then stop and let them react before running the verify loop. Iterating on a list of bullets is far
cheaper than iterating on a rendered frame.
