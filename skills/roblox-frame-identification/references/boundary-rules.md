# The frame/content boundary, in full

> **The rule:** an element belongs to the frame if it survives when the data is empty and stays put
> when the content scrolls. It is content if it exists once per datum.
> **When ambiguous: keep the container, drop the fill.**

## The three tests

**Test 1 — Empty state (primary).** Mentally open this panel with zero data: an inventory with no
items, a shop with nothing for sale, a quest log with no quests, a friends list with no friends.
Whatever is still on screen is **frame**. Whatever vanished is **content**. This resolves about 80%
of elements on its own.

**Test 2 — Scroll (for what Test 1 leaves ambiguous).** Scroll the panel's body. Anything that moves
is **content**; anything pinned is **frame**. This correctly classifies sticky footers (frame),
floating action buttons pinned to the panel (frame), and in-body section headers (content).

**Test 3 — Count (for repeated fixed elements).** If the number depends on data, it is **content**;
if it is authored and fixed, it is **frame**. Three tabs labeled Weapons/Armor/Potions: frame. One
tab per owned pet: content — but the strip holding them is frame either way.

**The containment corollary.** The container is almost always frame even when everything inside it
is content. That is what "keep the container, drop the fill" means.

## The full catalogue

| Element | Verdict | Deciding test |
|---|---|---|
| Outer panel frame | **FRAME** | — it is the subject |
| `UICorner` / `UIStroke` / `UIGradient` / `UIPadding` on the panel | **FRAME** | modifiers of an included node |
| Header / title bar | **FRAME** | empty-state |
| Title text | **FRAME** (text itself is a control prop) | empty-state |
| Header icon | **FRAME** | empty-state |
| Close (X) button | **FRAME** | empty-state |
| Minimize / expand button | **FRAME** | empty-state |
| Back / breadcrumb button | **FRAME** | empty-state |
| Divider under the header | **FRAME** | scroll — it stays pinned |
| Content container (`ScrollingFrame` or body `Frame`) | **FRAME**, then **cut** | empty-state; its children fail count |
| The container's own `UIListLayout` / `UIGridLayout` / `UIPadding` | **FRAME** | modifiers of an included node |
| List items, cards, inventory slots, rows | **CONTENT** | count |
| Per-item icons, labels, price tags, quantity badges | **CONTENT** | count |
| Scrollbar | **FRAME — and not an instance at all.** `ScrollBarThickness`, `ScrollBarImageColor3`, `ScrollBarImageTransparency` are properties of the `ScrollingFrame` | it is a property, not a child |
| Section header inside the scroll body | **CONTENT** | scroll — it moves with its group |
| Footer / action bar | **FRAME** | scroll |
| Footer buttons | **FRAME** if a fixed set (OK/Cancel/Equip); **CONTENT** if one per item | count |
| Tab strip | **FRAME** | empty-state |
| Individual tabs | **FRAME** if authored and fixed; **CONTENT** if data-driven. Selected state is a control prop, never structure | count |
| Search box / filter dropdown in the header | **FRAME**; the typed text is a control prop | empty-state |
| Currency / coin / level readout in the header | **FRAME** structure with a placeholder value; expose as a control | empty-state |
| Notification badge on a tab or button | **FRAME** structure; the number is a prop | empty-state |
| Progress / XP bar | **FRAME** (track and fill both); the fill's `Size` is a control prop | empty-state |
| Empty-state illustration ("Nothing here yet!") | **FRAME.** It *is* the empty state. Include it, and set `Visible = false` if the reference shows populated content | empty-state, definitionally |
| Drop shadow | **FRAME.** Usually a 9-slice `ImageLabel` child sized larger than the panel with a negative-offset `Position` and a lower `ZIndex` | empty-state |
| Decorative flourishes, ribbons, corner ornaments | **FRAME** | empty-state |
| Resize handle / drag bar | **FRAME** (often carries a `UIDragDetector`) | empty-state |
| Pagination dots | container **FRAME**; the dots **CONTENT** if the count is data-driven | count |
| `ViewportFrame` character preview | container **FRAME**; its 3D contents **OUT** (the renderer shows a placeholder regardless) | count / renderer limit |
| Anything animated (spinner, shimmer, pulse) | **FRAME**, captured in its rest pose. Note the animation under `Assumptions` | empty-state |
| Backdrop / dim overlay behind the panel | **OUT OF SCOPE.** It is a sibling belonging to the `ScreenGui`, not part of the panel. Record it under `Context` with its color and transparency | ancestor-level |
| Tooltip / popover / context menu | **OUT.** A separate frame; run its own identification pass if asked | transient — absent in the empty state |
| A confirm dialog stacked on top | **OUT.** A separate subject | separate subject |
| Other HUD elements outside the panel | **OUT.** Record under `Context` if they clarify scale | not contained |

## Two panels on screen

Pick exactly one. In order of precedence:

1. The panel the user explicitly pointed at.
2. The panel with the strongest containment — the one others sit inside or in front of.
3. The largest panel by area.

State the choice in the spec's `Subject` line and list the rejected candidates. A stacked modal and
the panel behind it are two separate frames and two separate stories. Merging them produces a story
that can never be reused.

## Worked tree cuts

### Inventory grid

```
InventoryPanel (Frame)                    FRAME
├─ UICorner                               FRAME   modifier
├─ Shadow (ImageLabel)                    FRAME   drop shadow
├─ Header (Frame)                         FRAME
│  ├─ Title (TextLabel) "INVENTORY"       FRAME   text -> control
│  ├─ Icon (ImageLabel)                   FRAME
│  └─ Close (ImageButton)                 FRAME
├─ Divider (Frame)                        FRAME   pinned
└─ SlotGrid (ScrollingFrame)              FRAME   <-- CUT HERE
   ├─ UIGridLayout                        FRAME   modifier of an included node
   ├─ Slot1 (Frame)                       CONTENT one per item
   ├─ Slot2 (Frame)                       CONTENT
   └─ ...                                 CONTENT
                                          + build exactly one Placeholder (Frame)
```

### Settings list

```
SettingsPanel (Frame)                     FRAME
├─ Header (Frame)                         FRAME
│  ├─ Title (TextLabel)                   FRAME
│  └─ Close (ImageButton)                 FRAME
├─ Body (ScrollingFrame)                  FRAME   <-- CUT HERE
│  ├─ UIListLayout                        FRAME
│  ├─ SectionAudio (TextLabel)            CONTENT scrolls with its group
│  ├─ RowVolume (Frame)                   CONTENT
│  └─ ...                                 CONTENT
└─ Footer (Frame)                         FRAME   pinned
   ├─ Apply (TextButton)                  FRAME   fixed set
   └─ Cancel (TextButton)                 FRAME   fixed set
```

Note the asymmetry: the footer's two buttons are frame (a fixed authored set), while the body's rows
are content (one per setting). Same shape, different verdict, decided by the count test.

### Shop with tabs

```
ShopPanel (Frame)                         FRAME
├─ Header (Frame)                         FRAME
│  ├─ Title (TextLabel)                   FRAME
│  ├─ CoinCount (TextLabel) "1,240"       FRAME   structure; value -> control
│  └─ Close (ImageButton)                 FRAME
├─ TabStrip (Frame)                       FRAME
│  ├─ UIListLayout                        FRAME
│  ├─ TabWeapons (TextButton)             FRAME   authored, fixed
│  ├─ TabArmor (TextButton)               FRAME   authored, fixed
│  └─ TabPotions (TextButton)             FRAME   authored, fixed
└─ ItemList (ScrollingFrame)              FRAME   <-- CUT HERE
   ├─ UIGridLayout                        FRAME
   └─ ItemCard xN                         CONTENT one per SKU
```

If the tabs were "one per owned pet" rather than three authored categories, `TabStrip` would stay
frame and the tabs would become content with a single `Placeholder`. The visual is identical; the
count test is what separates them.

## What "control prop, not structure" means

Several rows above say the *structure* is frame but the *value* is a control. That distinction
matters for phase 4:

- Build the `TextLabel` — it is part of the frame.
- Do **not** hardcode `"1,240"` — expose it as `UI.control.string("1,240")`.
- The default must reproduce the reference exactly, because the verification screenshot renders with
  defaults.

Selected-tab state is the same: build all three tabs, expose which one is selected as
`UI.control.select`, and default it to whatever the reference shows.
