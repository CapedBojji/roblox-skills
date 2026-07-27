# Input: a screenshot or mockup image

## 0. Look before you measure

Read the image and **describe what you see in prose first** — what kind of panel, what regions,
what is clearly repeated content. This catches the expensive mistake (identifying the wrong panel)
before any numbers exist.

## 1. Establish the screen resolution

This is the step that decides whether the output is scale-correct or pixel-hardcoded. Get it wrong
and everything downstream is wrong in a way that is invisible until someone opens the game on a
phone.

| The capture is… | Then |
|---|---|
| Full-screen | The image dimensions **are** the screen. Panel size ÷ image size gives scale directly. Mark `[M]` |
| Cropped to the panel | You **cannot** derive scale from the image. Ask the user for the capture resolution |
| Cropped, user does not know | Assume a 1920×1080 design canvas, state the assumption in the spec, express the panel in scale against it. Mark `[E]` |
| A Figma/mockup export | Ask what canvas it was designed at. Treat that as the screen |

Record the answer in the spec's `Reference` block with `(given | inferred | assumed)`.

## 2. Measure the panel

Find the panel's bounding box in image pixels, then:

```
rootScaleX = panelWidth  / screenWidth
rootScaleY = panelHeight / screenHeight
```

The panel is almost always centered or corner-pinned. Centered means
`Position = UDim2.fromScale(0.5, 0.5)` with `AnchorPoint = Vector2.new(0.5, 0.5)` — do not compute a
pixel offset for it.

## 3. Measure children relative to the panel — not the screen

This is the single most common error on this path. A child that is half the panel's width is
`fromScale(0.5, …)` **regardless of how wide the panel is on screen**.

```
childScaleX = childWidthPx / panelWidthPx      -- panel, not screen
```

If you divide by the screen width instead, every child comes out too small by exactly the panel's
scale factor, and the layout looks plausible but collapses inward the moment the panel resizes.

## 4. Decide scale vs offset per child

Per `roblox-ui-fundamentals`: things that track the screen use scale; visual constants use offset.
On this path, the practical translation is:

**Keep in offset** (measure the pixels, use them directly):

- header bar height
- close button and icon sizes
- padding and gutters
- corner radii, stroke thickness
- `UIListLayout.Padding`, `UIGridLayout.CellSize` / `CellPadding`

**Convert to scale**:

- the panel itself
- content regions that fill the panel
- proportional column splits

**Use the mixed form** for the common "fill the rest" case:

```lua
-- a body that fills below a 56px header, with a 16px gutter
Size     = UDim2.new(1, -32, 1, -72)
Position = UDim2.fromOffset(16, 56)
```

## 5. Text

Measure the **cap height** (top of a capital letter to the baseline), not the full line box:

```
TextSize ≈ capHeightPx / 0.7
```

Always mark `[E]`. Then check alignment (`TextXAlignment`, `TextYAlignment`) which is usually easier
to read off the image than the size is.

## 6. Color

Sample by eye and convert to `Color3.fromRGB(r, g, b)`. Mark `[E]`, and expect to correct during the
visual compare. Two systematic distortions to account for:

- **JPEG/PNG compression** shifts colors slightly, especially at edges and on gradients.
- **Semi-transparent panels blend with what is behind them.** A panel at
  `BackgroundTransparency = 0.1` over a dim backdrop samples *darker* than its true
  `BackgroundColor3`. If the reference shows a dim overlay, the true panel color is lighter than
  what you sampled.

Build a 6-slot palette (surface, surfaceRaised, stroke, textPrimary, textMuted, accent) rather than
sampling every element independently. It converges faster and produces a coherent result.

## 7. What a 2D image cannot tell you

All of these go in the spec's `Assumptions` section:

- **`ZIndex` ordering** — infer from occlusion; anything not overlapping is a guess.
- **`ClipsDescendants`** — invisible unless something is actually clipped at an edge.
- **Whether a region scrolls** — a partial row at the bottom edge is good evidence; otherwise assume
  `ScrollingFrame` for anything that looks like a list, and say so.
- **`AutomaticSize`** — never visible in a still.
- **Hover, pressed, and selected states** — only the rest state is captured.
- **Whether repeated elements are authored or data-driven** — this decides the count test. Distinct
  category names suggest authored; uniform items suggest data-driven. State which you assumed.
- **Animation** — a spinner or shimmer is captured mid-frame. Note it and build the rest pose.

## 8. Verify honestly

The preview will not match pixel-for-pixel and should not be forced to. `rbxassetid://` icons render
as grey placeholders, and fonts differ. Compare in the priority order from SKILL.md — silhouette,
structure, alignment, color, type, detail — and stop after three iterations, writing the remaining
deltas into `Assumptions` and marking which are renderer divergences.
