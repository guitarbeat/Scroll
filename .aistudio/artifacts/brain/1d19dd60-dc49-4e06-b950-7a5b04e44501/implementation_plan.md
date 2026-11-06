# Medieval Ink Soaking & Parchment Pointer Interactivity

Comprehensive implementation plan for the tactile ink-soaking effect (capillary feathering, expansion, and rich pigment darkening on fresh vellum strokes over 350–500ms) alongside rigorous pointer-event routing to guarantee smooth drawing and writing in the unrolled scroll state.

## User Review & Critical Decisions

> [!IMPORTANT]
> Key design and visual pacing choices confirmed during Phase 1 clarification:

- **Visual Style**: Pronounced medieval capillary feathering with noticeable stroke expansion and ink deepening into the parchment grain.
- **Timing & Pace**: Natural drying pace spanning 350ms to 500ms after drawing completion.
- **Scope**: Applied dynamically to newly drawn strokes in real time (reloaded or historical strokes render in their fully cured/soaked state).
- **Pointer Hierarchy**: Zero occlusion over the interactive canvas surface, strict `pointer-events: auto` on Tldraw canvas wrappers, and event passthrough for decorative deckled borders.

---

## 1. Overview & Core Concept

When a scribe draws on authentic calfskin or sheepskin vellum, wet iron gall ink initially rests on the smooth surface before capillary action pulls the liquid into microscopic parchment fibers. Within half a second, the stroke slightly widens, edges soften with subtle organic feathering, and the pigment shifts from glossy wet sepia/black to a deep, matte, permanent tone.

This feature introduces an SVG filter and dynamic stroke state lifecycle in Tldraw that watches for freshly completed draw shapes (`type: "draw"`), tags their DOM representations with an ephemeral ink-settling animation, and transitions them smoothly from freshly deposited wet liquid into deeply absorbed vellum ink. Simultaneously, it audits every DOM layer between the viewport root and `.tl-canvas` to guarantee uninhibited pointer input across mouse, stylus, and touch.

---

## 2. User Experience & Visual Design

### The Tactile Ink Soaking Lifecycle
```
[Pen / Mouse Down] ──► [Crisp Wet Ink Stroke] ──► [Pen Up / Stroke Finish]
                                                          │
                                                          ▼ (0ms - 80ms)
                                            Subtle wet gloss sheen
                                                          │
                                                          ▼ (80ms - 380ms)
                                            Capillary edge feathering
                                            + 4-8% stroke dilation
                                                          │
                                                          ▼ (380ms - 480ms)
                                            Pigment deepening & matte vellum lock
```

### Visual Specifications
- **Dilation & Feathering**: Newly finished strokes expand by ~5–8% using an SVG filter composite (`feMorphology` / `feDisplacementMap` / `feGaussianBlur`) mapped to the vellum grain texture, creating authentic organic fiber bleeds.
- **Color Shift**: Stroke path deepens from initial wet ink tone into its final saturated pigment (e.g., Oak Gall shifts from #2c2419 to deep carbon #14120f; Vermillion shifts from vibrant scarlet #c92a2a to aged cinnabar #941e1e).
- **Performance**: GPU-accelerated CSS keyframe transitions and SVG filter effects targeting only the active stroke's SVG path, preserving 60fps drawing responsiveness.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Stroke-Level CSS/SVG Filter Animation vs. Raster Canvas Manipulation**
  - *Chosen Approach*: Intercept newly created `draw` shapes via Tldraw's store listener, attach an ephemeral `ink-soaking` CSS class and SVG filter (`#parchment-ink-soak-filter`) to the shape's DOM node for 500ms, then remove the transient class once dried.
  - *Why*: Retains full vector crispness, infinite zoom fidelity, and compatibility with Ably collaborative sync without modifying shape geometry records in the database.
  - *Alternative Considered*: Modifying vector spline point radii directly in Tldraw shapes (rejected because it causes unnecessary network broadcast churn and undo/redo history pollution).

- **Decision 2: Pointer Event Architecture on `#sheet` and `#sheetWrap`**
  - *Chosen Approach*: `#sheetWrap` handles scroll container duties (`overflow-y: auto`, `pointer-events: auto`), `#sheet` maintains layout coordinates, `#content` (headers/ornaments) enforces strict `pointer-events: none`, and `WritingCanvas` (`z-index: 10`) hosts the interactive `.tl-container` with `pointer-events: auto`.
  - *Why*: Eliminates any accidental hit-test interception while allowing scroll gestures on rollers and touch devices to function naturally.

---

## 4. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ #sheetWrap (overflow-y: auto, scroll bounds updater)                   │
│  └─► #sheet (relative container, min-height: dynamicSheetHeight)        │
│        ├─► .parchment-bg-container (z-index: -1, pointer-events: none) │
│        │     ├─ Parchment textures & discoloration                     │
│        │     └─ SVG Filters: #parchment-ink-soak-filter                │
│        ├─► #content (pointer-events: none)                             │
│        │     └─ CornerFlourishGenerator (illuminated headers)          │
│        └─► WritingCanvas Container (z-index: 10, pointer-events: auto) │
│              └─► <Tldraw> (.tl-container, .tl-canvas)                  │
│                    ├─► InkSoakManager (store listener -> DOM anim)     │
│                    ├─► CameraLock (x:0, y:0, origin lock)              │
│                    └─► CommunalSync (Ably & local shape cache)         │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & File Workflows
1. **`src/components/WritingCanvas.tsx`**:
   - Add `InkSoakFilterDef` SVG filter definitions with capillary feathering and displacement.
   - Implement `InkSoakManager` hook listening to `editor.store.listen(..., { source: 'user' })` for newly added `draw` shapes.
   - Attach the ephemeral `.ink-soak-active` class to the shape container in DOM for 480ms.
   - Ensure pointer events and editor focus are never blocked on mount or during tool switches.

2. **`src/index.css`**:
   - Define `@keyframes inkSoakBleed`:
     - `0%`: standard stroke width, wet luster, clean vector edge.
     - `40%`: slight expansion (dilation via stroke-width scale or SVG filter), micro-bleed onto vellum.
     - `100%`: final deepened hue, softened edge blend, fully settled into parchment.
   - Confirm pointer-events hierarchy across `.tl-canvas`, `.tl-canvas-container`, `#sheet`, `#sheetWrap`, and `#content`.

3. **`src/App.tsx`**:
   - Ensure `#sheet` and `#sheetWrap` have explicit pointer-events configuration during all phases (rolled, unrolling, fully unrolled).

---

## 5. Verification & Acceptance Criteria
- Drawing with mouse or stylus produces immediate strokes without hesitation.
- Newly drawn lines subtly expand by 5–8% and deepen in shade over ~400ms before locking into parchment grain.
- Reloaded or existing strokes remain in their cured, final soaked state without replaying the animation.
- All pointer events on the parchment interact cleanly with Tldraw tools (Quill, Note, Eraser, Move, Scroll).
- Compilation (`compile_applet`) and type checking (`lint_applet`) pass cleanly.
