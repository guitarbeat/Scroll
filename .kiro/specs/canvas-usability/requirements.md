# Requirements: Canvas Usability and Mobile Magnifier

## Overview

Improve the drawing experience across devices, with a focus on **phone
(portrait)** and **desktop**. The headline feature is a Procreate-style
magnifier loupe for touch drawing. Alongside it, we fix the touch gesture
model (one finger draws, two fingers pan/scroll, pinch zooms) which currently
misbehaves, and make the realtime/session layer more robust.

Primary devices, in priority order:
1. Phone, portrait
2. Desktop

Landscape phone and tablet are secondary. They should not break, but are not
optimized in this phase.

## Terminology

- **Loupe**: the circular magnifier overlay shown while drawing on touch.
- **Page space**: tldraw's virtual coordinate system (already used for shape
  and cursor sync).
- **Native camera**: tldraw's built-in pan/zoom, currently disabled by
  `CameraLock`.

---

## Requirement 1: Touch gesture model

**User story:** As a phone user, I want one finger to draw, two fingers to
pan and scroll, and a pinch to zoom, so the canvas behaves like every painting
app I already know.

### Acceptance criteria
1. WHEN the user drags with one finger and the draw tool is active, THEN a
   stroke is drawn and the canvas does NOT pan or scroll.
2. WHEN the user drags with two fingers, THEN the canvas pans/scrolls and no
   stroke is created.
3. WHEN the user performs a pinch gesture with two fingers, THEN the canvas
   zooms about the pinch midpoint.
4. WHEN a two-finger gesture begins after a one-finger stroke has started,
   THEN the in-progress stroke is cancelled or committed cleanly with no
   stray marks.
5. WHEN the user is panning or zooming, THEN no accidental stroke is committed
   to the shared canvas.
6. IF the user is on desktop, THEN existing mouse/trackpad and wheel behavior
   continues to work (wheel scrolls the parchment, draw tool draws).

---

## Requirement 2: Procreate-style magnifier loupe (touch only)

**User story:** As a phone user drawing fine detail, I want a magnifier loupe
that shows exactly what is under my finger, live, so I can place strokes
precisely.

### Acceptance criteria
1. WHEN the user is actively drawing with one finger on a touch device, THEN a
   circular loupe appears automatically, with no toggle required.
2. WHEN the finger lifts, THEN the loupe disappears.
3. WHEN the loupe is visible, THEN it shows the real tldraw canvas content
   (all shape types, colors, images, text), not a hand-rolled re-render.
4. WHEN the user is mid-stroke, THEN the stroke currently being drawn appears
   live inside the loupe as it is drawn.
5. WHEN the finger approaches the loupe's current screen position, THEN the
   loupe relocates (for example to the opposite corner or side) so it never
   sits under the finger. This is the Procreate-style avoidance behavior.
6. WHEN the user pinch-zooms, THEN the loupe's magnification factor is
   adjustable by the user (pinch-adjustable), within sane min/max bounds.
7. IF the device is desktop (non-touch, mouse pointer), THEN the loupe never
   appears.
8. WHEN many shapes exist on the canvas, THEN the loupe still updates smoothly
   (target: visually fluid, see Requirement 5).

---

## Requirement 3: Canvas pan and zoom ownership

**User story:** As any user, I want panning and zooming to feel correct and
consistent, so drawings stay aligned and the parchment framing still looks
right.

### Acceptance criteria
1. WHEN the user zooms, THEN shapes remain in the correct position relative to
   each other and to the parchment.
2. WHEN two users are on different screen sizes or zoom levels, THEN a shape
   drawn by one appears in the same page-space location for the other
   (page-space sync must be preserved).
3. WHEN the user pans, THEN they cannot pan infinitely away from the parchment
   content; panning is constrained to sensible bounds around the parchment.
4. WHEN zoom is applied, THEN it is clamped to a minimum and maximum level.
5. THE ghost-cursor overlay SHALL continue to position remote cursors
   correctly at any zoom or pan offset (it already maps via page space).

> Design note: this requirement forces a decision about replacing `CameraLock`
> and the custom `sheetWrap` scroll. See design.md "Key Decision: camera
> ownership." This requirement is written to be satisfiable by either option
> the user approves.

---

## Requirement 4: Responsive layout and touch targets

**User story:** As a phone user, I want the whole scroll and all controls
visible and comfortably tappable, so I can use every tool without zooming the
browser.

### Acceptance criteria
1. WHEN the app loads on a phone in portrait, THEN the entire scroll rig is
   visible within the viewport without horizontal clipping.
2. WHEN the toolbar renders on a phone, THEN every button meets a minimum
   touch target of about 44x44 CSS px.
3. WHEN the on-screen keyboard or browser chrome reduces viewport height, THEN
   the toolbar and canvas remain reachable.
4. WHEN the user rotates the device, THEN the layout reflows without breaking
   or losing canvas content.
5. THE browser-level pinch-zoom (added earlier via viewport meta) SHALL not
   fight the in-canvas pinch-zoom; the design must define which layer owns
   pinch (see design.md).

---

## Requirement 5: Performance and robustness

**User story:** As any user, I want the canvas to stay responsive and recover
gracefully from network issues, so I never lose work or get stuck.

### Acceptance criteria
1. WHEN the loupe is active and being moved, THEN it updates at a fluid frame
   rate (target ~60fps on a modern phone with a typical canvas; degrade
   gracefully with very large canvases).
2. WHEN the network connection drops and returns (for example after the tab is
   backgrounded), THEN the Ably connection re-establishes and the local canvas
   re-syncs with Redis without a manual refresh.
3. WHEN the user draws while temporarily disconnected, THEN their strokes are
   preserved locally and published once the connection returns.
4. WHEN presence is lost (tab backgrounded), THEN the user's ghost cursor is
   removed for others within a bounded time and restored on return.
5. THE realtime shape sync and page-space coordinate behavior SHALL not
   regress from current behavior.

> Flagged default: items 2 through 4 (reconnect/offline resilience) were not
> explicitly requested in the interview. They are included as recommended
> robustness defaults. Confirm scope during review; they can be split into a
> later phase.

---

## Out of scope (this phase)
- Landscape-phone and tablet-specific optimization beyond "does not break."
- Per-user color pickers, brush settings, layers.
- Authentication or per-room canvases.
- Desktop magnifier.
