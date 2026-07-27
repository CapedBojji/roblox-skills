# Input: an existing instance tree

`.rbxmx`, `.rbxlx`, or a Studio "copy selection" paste — all three are the same `<roblox>` XML
document, so treat them identically.

**This input is authoritative. Extract, never estimate.** The work here is pruning, not measuring.
Every number in the resulting spec should be marked `[X]`. If an `[E]` shows up on this path, you
guessed at something that was sitting right there in the file.

## Document shape

```xml
<roblox version="4">
  <Item class="Frame" referent="RBX0">
    <Properties>
      <string name="Name">ShopPanel</string>
      <UDim2 name="Size"><XS>0.458</XS><XO>0</XO><YS>0.667</YS><YO>0</YO></UDim2>
      <UDim2 name="Position"><XS>0.5</XS><XO>0</XO><YS>0.5</YS><YO>0</YO></UDim2>
      <Vector2 name="AnchorPoint"><X>0.5</X><Y>0.5</Y></Vector2>
      <Color3 name="BackgroundColor3"><R>0.094</R><G>0.11</G><B>0.149</B></Color3>
      <float name="BackgroundTransparency">0</float>
      <int name="ZIndex">2</int>
      <bool name="ClipsDescendants">true</bool>
      <token name="AutomaticSize">0</token>
    </Properties>
    <Item class="UICorner" referent="RBX1">
      <Properties>
        <UDim name="CornerRadius"><S>0</S><O>12</O></UDim>
      </Properties>
    </Item>
  </Item>
</roblox>
```

Children are nested `<Item>` elements. Hierarchy is structural — `referent` is only for internal
cross-references (`Ref` properties) and can be ignored for UI work.

## Property decoding

| XML | Meaning | Becomes |
|---|---|---|
| `<UDim2><XS/><XO/><YS/><YO/>` | scale/offset per axis | `UDim2.new(XS, XO, YS, YO)` |
| `<UDim><S/><O/>` | single axis | `UDim.new(S, O)` |
| `<Vector2><X/><Y/>` | | `Vector2.new(X, Y)` |
| `<Color3><R/><G/><B/>` | **0–1 floats** | `Color3.fromRGB(round(R*255), round(G*255), round(B*255))` |
| `<Color3uint8>` | a packed 32-bit integer | `r = (n >> 16) & 255`, `g = (n >> 8) & 255`, `b = n & 255` |
| `<float>` / `<int>` | plain number | as-is |
| `<bool>` | `true` / `false` | as-is |
| `<string>` | text | as-is |
| `<token>` | an **enum index** | see below |
| `<Content>` / `<ContentId>` | asset URL | the `rbxassetid://…` string |
| `<Font>` / `<FontFace>` | font descriptor | not supported by the StoryBlox renderer |

The `Color3` conversion is the one that produces silently-wrong output if skipped: `0.094` is not
`94`, it is `24`.

## Enum tokens

`<token>` values are enum **indices**, not names. The reliable way to resolve one you are unsure of
is the Roblox Creator Docs enum page. These are the common ones for UI work:

| Enum | Values |
|---|---|
| `TextXAlignment` | 0 Left · 1 Right · 2 Center |
| `TextYAlignment` | 0 Top · 1 Center · 2 Bottom |
| `AutomaticSize` | 0 None · 1 X · 2 Y · 3 XY |
| `SizeConstraint` | 0 RelativeXY · 1 RelativeXX · 2 RelativeYY |
| `FillDirection` | 0 Horizontal · 1 Vertical |
| `HorizontalAlignment` | 0 Center · 1 Left · 2 Right |
| `VerticalAlignment` | 0 Center · 1 Top · 2 Bottom |
| `SortOrder` | 0 Name · 1 Custom · 2 LayoutOrder |
| `ApplyStrokeMode` | 0 Contextual · 1 Border |
| `UIFlexMode` | 0 None · 1 Grow · 2 Shrink · 3 Fill · 4 Custom |
| `DominantAxis` | 0 Width · 1 Height |
| `AspectType` | 0 FitWithinMaxSize · 1 ScaleWithParentSize |
| `StartCorner` | 0 TopLeft · 1 TopRight · 2 BottomLeft · 3 BottomRight |

If a decoded value produces a layout that clearly contradicts the source, suspect the token table
before suspecting your reading — verify that specific enum against the docs rather than guessing
again.

## Prune

Drop outright, without applying the boundary tests:

- `Script`, `LocalScript`, `ModuleScript`
- `<Attributes>` blocks
- any non-GUI class (`Folder` holding logic, `RemoteEvent`, `Configuration`, …)
- `Tags`

Then apply the boundary tests from `boundary-rules.md` to what remains.

**Preserve original `Name` values verbatim.** They are free semantic signal — a node called
`ItemTemplate` or `SlotPrefab` is telling you it is content, and a node called `Header` confirms it
is chrome. They also make the spec readable to whoever wrote the original UI.

Names are also the fastest boundary evidence available on this path:

| Name pattern | Strong signal |
|---|---|
| `*Template`, `*Prefab`, `*Clone`, `Sample*` | **content** — it exists to be cloned per datum |
| `Container`, `Holder`, `List`, `Grid`, `Content`, `Body` | **frame** — a container; cut here |
| `Header`, `TitleBar`, `TopBar`, `Footer`, `Nav` | **frame** |
| `Item1`, `Item2`, `Slot3`, numbered siblings | **content** — the numbering *is* the count test |

A `*Template` node is often `Visible = false` in the source. That is decisive: it is a prototype for
cloning, so it is content, and it is also the perfect model for your single `Placeholder`.

## Non-default properties only

A tree dump carries hundreds of defaults. Copying them all produces unreadable Luau that buries the
handful of properties that matter.

**Rule: include a property only if it differs from the Roblox default, or is load-bearing for the
layout.** `BorderSizePixel = 0` is worth keeping (the default is 1 and it is almost always
deliberate). `Visible = true`, `Active = false`, `Selectable = true`, `Rotation = 0` are not.

## StoryBlox compatibility pass

Before writing the story, check what you extracted against the renderer's supported set. Anything
outside it renders best-effort and shows up as a warning in phase 5 — record it under `Assumptions`
now so the warning is expected rather than alarming.

Supported classes (24):

```
Frame  CanvasGroup  TextLabel  TextButton  TextBox  ImageLabel  ImageButton
ScrollingFrame  VideoFrame  ViewportFrame
UICorner  UIStroke  UIPadding  UIListLayout  UIGridLayout  UIPageLayout
UITableLayout  UIGradient  UIAspectRatioConstraint  UISizeConstraint
UITextSizeConstraint  UIScale  UIFlexItem  UIDragDetector
```

Commonly-hit gaps worth knowing before they surprise you:

- **`SortOrder`** and **`Font` / `FontFace`** are not in the renderer's supported-property list.
  They are valid Roblox and belong in the story — they just will not affect the preview.
- `rbxassetid://` images render as grey text placeholders. Icon-heavy trees will look wrong in the
  preview and that is correct behavior.
- `ViewportFrame` and `VideoFrame` are always placeholders.

## Flagging bad source geometry

An extracted tree is authoritative about *what the UI is*, not about whether it is any good. When
pruning turns up offset-only sizing on a whole panel, negative-offset centering instead of
`AnchorPoint`, or `TextScaled` with no `UITextSizeConstraint`, note it under `Assumptions` — but
**reproduce the source faithfully in the story**. The spec is a record of what exists; fixing it is
a separate request. Say what you found and offer.
