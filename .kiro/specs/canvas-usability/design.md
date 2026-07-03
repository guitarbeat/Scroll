# Design: Canvas Usability and Mobile Magnifier

## Context

Current relevant behavior:
- `WritingCanvas.tsx` wraps tldraw with `hideUi`, plus helper components:
  `CommunalSync` (Ably + Redis sync), `CameraLock` (pins camera at
  `x:0, y:0, z:1`), `ScrollBoundsUpdater`, and `MagnifierOverlay`
  (hand-rolled 2.3x loupe, only handles draw/text/image, shown while pointer
  is down when the magnifier tool is toggled on).
- `App.tsx` implements a custom parchment scroll via `sheetWrap.scrollTop`,
  with roller rotation and dynamic sheet height driven by that scroll.
- The rig is scaled to fit the viewport via `rigScale`.

The two hard problems:
1. The magnifier must show the **real** canvas including the live stroke.
2. Touch gestures (1-finger draw, 2-finger pan, pinch zoom) must work, which
   is impossible while the camera is hard-locked and a custom scroll owns
   vertical movement.

---

## Key Decision: camera ownership (needs sign-off)

Pinch-zoom and two-finger pan are native tldraw camera operations. The current
`CameraLock` + custom `sheetWrap` scroll actively prevent them. We must pick
one of two directions. Both satisfy the requirements; they differ in effort
and in how much of the parchment aesthetic is affected.

### Option A (recommended): tldraw owns pan/zoom
- Remove `CameraLock`. Let tldraw's native camera handle pan and zoom.
- Constrain the camera: fixed content width equal to the design width, a tall
  page height, `cameraOptions` with pan bounds around the parchment and zoom
  clamped (for example 0.5x to 5x).
- The parchment (rollers, torn edges, burn) becomes a decorative frame around
  the tldraw viewport. Vertical movement is camera pan, not `scrollTop`.
- Roller rotation, currently driven by `scrollTop`, is re-driven by camera Y.
- Pros: gestures "just work" via tldraw, page-space sync and ghost cursors
  keep working, magnifier zoom aligns with camera. Removes the whole class of
  scroll-vs-canvas conflicts.
- Cons: the unroll animation, dynamic sheet height, and roller physics that
  currently depend on `scrollTop` must be re-expressed in terms of the camera.
  This is the bulk of the rework.

### Option B: keep custom scroll, route gestures manually
- Keep `sheetWrap.scrollTop` and `CameraLock`.
- Intercept touch events, implement two-finger pan by adjusting `scrollTop`,
  and fake zoom by scaling the rig (`rigScale`) or a wrapper.
- Pros: preserves current parchment scroll code.
- Cons: we reimplement pan/zoom/inertia by hand, fighting tldraw the whole
  way. Zoom via CSS scale desyncs tldraw's hit-testing and the magnifier.
  High risk of exactly the bugs we are trying to remove.

**Recommendation: Option A.** The interview said a big rework is acceptable,
and Option A is the only one that makes pinch-zoom genuinely correct. The rest
of this design assumes Option A. If you prefer B, the magnifier and gesture
sections still apply but the camera tasks change.

---

## Gesture model (Requirement 1)

Use tldraw's input system rather than custom pointer parsing where possible.

- **One finger + draw tool**: draws. Default tldraw behavior once the camera
  is unlocked.
- **Two fingers**: tldraw natively treats a two-finger drag as pan and a
  pinch as zoom. We enable this by not blocking multi-touch.
- **Gesture arbitration**: if a second finger lands during a one-finger
  stroke, cancel the in-progress stroke (`editor.cancel()` / bail the draw)
  so no stray mark is committed, then let the pan/zoom take over.
- Remove the app-level `touch-none` / manual `pointermove` scroll hacks that
  currently swallow touch, replacing them with tldraw-native handling plus a
  thin arbitration layer only where needed.
- Desktop input paths remain: wheel scrolls (maps to camera pan Y), draw tool
  draws.

Browser vs canvas pinch (Requirement 4.5): the in-canvas pinch should own the
gesture over the parchment area. Keep the page itself non-zoomable there
(the canvas handles it) while still allowing the user to browser-zoom UI
chrome outside the canvas. Exact approach: `touch-action: none` on the tldraw
surface only, not the whole document.

---

## Magnifier loupe (Requirement 2)

### Rendering the real canvas
The hand-rolled canvas redraw is replaced. Two candidate techniques:

1. **DOM clone + CSS transform (recommended first attempt).**
   - The loupe is a circular, clipped container.
   - Inside it, clone the tldraw shapes layer (the rendered SVG/HTML for the
     current page) and apply `transform: scale(z) translate(...)` so the
     point under the finger is centered and magnified.
   - Refresh on a `requestAnimationFrame` loop while drawing. Because the live
     stroke is a real tldraw shape being updated in the store, cloning the
     layer each frame naturally includes it (Requirement 2.4).
   - Pros: pixel-accurate to the real canvas, handles every shape type for
     free. Cons: cloning cost grows with shape count; mitigate by cloning only
     the shapes layer and throttling.

2. **Second read-only tldraw viewport (fallback).**
   - Mount a hidden second `<Tldraw>` bound to the same store, camera centered
     on the finger at higher zoom, displayed inside the loupe clip.
   - Pros: no manual cloning, always correct. Cons: heavier, two editors on
     one store; use only if technique 1 is too slow.

Decision: implement technique 1, keep 2 as a documented fallback if
performance (Requirement 5.1) is not met.

### Position and finger avoidance (Req 2.5)
- Loupe default position: a fixed anchor (for example top-left).
- Track the finger's screen position. If the finger enters a buffer zone
  around the loupe, move the loupe to the opposite region (left/right or
  the opposite corner). Debounce so it does not oscillate.

### Zoom factor (Req 2.6)
- Loupe magnification is user-adjustable via pinch. Store a `loupeZoom` value,
  clamped (for example 1.5x to 6x). Pinch while the loupe is active adjusts
  `loupeZoom`. Persist the last value for the session.

### Touch-only (Req 2.7)
- Gate the entire loupe on `pointerType === "touch"`. Never render for mouse.
- The existing "Scribe's Glass" toolbar toggle: repurpose or remove. Since the
  loupe is now automatic while drawing on touch, the manual toggle is
  redundant. Proposal: remove it on touch, hide it on desktop. Confirm in
  review.

---

## Coordinate and sync integrity (Requirement 3)

- Page-space sync already makes shapes device-independent; unlocking the
  camera does not change stored coordinates, only the view transform.
- Ghost cursors already convert page space to screen via `pageToScreen`; they
  keep working at any zoom/pan.
- Add camera constraints via tldraw `cameraOptions`: `constraints` with the
  parchment bounds, `zoomSteps`/clamp for min/max.

---

## Responsive layout (Requirement 4)

- Keep the `rigScale` fit-to-width behavior for the decorative frame.
- Audit toolbar: ensure 44px min tap targets on phone; the current buttons are
  `w-8 h-8` (32px) which is below target. Increase hit area on touch.
- Use `100dvh` / dynamic viewport units so mobile browser chrome does not
  clip the toolbar.

---

## Robustness (Requirement 5)

- Ably `Realtime` already auto-reconnects; add explicit handling: on
  `connected` after a drop, re-run `loadFromRedis()` to reconcile any missed
  deltas, and re-enter presence.
- Buffer local diffs while `connectionState !== "connected"`, flush on
  reconnect (Req 5.3).
- On `visibilitychange` to hidden, leave presence; on visible, re-enter and
  reconcile (Req 5.4).
- Keep the 80ms shape publish debounce; ensure loupe RAF loop is scoped to
  active drawing only (Req 5.1).

---

## Risks
- Re-expressing the unroll animation and roller physics in camera terms
  (Option A) is the largest risk; isolate it and keep the visual result
  identical.
- DOM cloning performance for the loupe on large canvases; fallback defined.
- Multi-touch arbitration edge cases (finger down/up ordering); needs device
  testing on a real phone.

## Testing strategy
- Manual device testing on the user's phone (portrait) is required; automated
  tests cannot cover touch gestures and the loupe well.
- Verify: 1-finger draw, 2-finger pan, pinch zoom, loupe appears/relocates,
  live stroke in loupe, two-browser realtime still syncs, reconnect after
  backgrounding.
- Regression: desktop wheel scroll, draw, ghost cursors, realtime sync.
