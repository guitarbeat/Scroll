# Tasks: Canvas Usability and Mobile Magnifier

Assumes design Option A (tldraw owns pan/zoom). Tasks are ordered so the app
stays runnable after each one. Each task lists the requirements it covers.

## Phase 1: Camera and gesture foundation

- [ ] 1. Remove `CameraLock` and introduce constrained native camera
  - Delete the hard camera lock; configure tldraw `cameraOptions` with pan
    constraints around the parchment and clamped zoom (min/max).
  - Keep the initial view centered on the top of the parchment.
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.3, 3.4_

- [ ] 2. Migrate parchment scroll from `sheetWrap.scrollTop` to camera Y
  - Drive roller rotation and dynamic sheet height from `editor.getCamera()`
    instead of `scrollTop`.
  - Preserve the existing visual result (rollers rotate, sheet grows).
  - _Requirements: 3.1, 3.3, 4.4_

- [ ] 3. Re-express the unroll / open animation in camera terms
  - Ensure the intro unroll and the reroll still play correctly without the
    custom scroll container.
  - _Requirements: 3.1, 4.4_

- [ ] 4. Implement touch gesture arbitration
  - One finger draws; two fingers pan; pinch zooms (native tldraw once
    unlocked).
  - Cancel an in-progress one-finger stroke cleanly if a second finger lands.
  - Scope `touch-action: none` to the tldraw surface only.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.5_

- [ ] 5. Preserve desktop input
  - Verify wheel scroll maps to camera pan, draw tool draws, ghost cursors and
    realtime sync unaffected.
  - _Requirements: 1.6, 3.5, 5.5_

## Phase 2: Magnifier loupe (touch only)

- [ ] 6. Replace `MagnifierOverlay` with a real-canvas loupe
  - Circular clipped container; clone the tldraw shapes layer and apply a
    CSS scale/translate so the point under the finger is centered.
  - Update on a `requestAnimationFrame` loop only while a one-finger stroke is
    active.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1_

- [ ] 7. Live in-progress stroke inside the loupe
  - Confirm the currently-drawn stroke appears live (it is a real store shape,
    so cloning includes it). Add explicit handling if the shapes layer lags.
  - _Requirements: 2.4_

- [ ] 8. Finger-avoidance repositioning
  - Move the loupe away when the finger nears it (opposite corner/side),
    debounced to avoid oscillation.
  - _Requirements: 2.5_

- [ ] 9. Pinch-adjustable loupe magnification
  - Bind a clamped `loupeZoom` (for example 1.5x to 6x) to pinch while the
    loupe is active; persist for the session.
  - _Requirements: 2.6_

- [ ] 10. Touch-only gating and toolbar cleanup
  - Loupe never renders for mouse pointers.
  - Remove or hide the now-redundant "Scribe's Glass" toggle on desktop;
    confirm final toolbar set.
  - _Requirements: 2.7, 4.2_

- [ ] 11. Loupe performance validation and fallback
  - Measure loupe fps with a large canvas. If below target, switch to the
    second read-only tldraw viewport fallback from design.md.
  - _Requirements: 2.8, 5.1_

## Phase 3: Responsive layout

- [ ] 12. Toolbar touch targets and dynamic viewport
  - Enforce ~44px min tap targets on phone; use `dvh` units so mobile chrome
    does not clip controls.
  - _Requirements: 4.2, 4.3_

- [ ] 13. Portrait fit and rotation
  - Verify full rig visibility in portrait and clean reflow on rotation.
  - _Requirements: 4.1, 4.4_

## Phase 4: Robustness (confirm scope in review)

- [ ] 14. Reconnect reconciliation
  - On Ably `connected` after a drop, re-run `loadFromRedis()` and re-enter
    presence.
  - _Requirements: 5.2, 5.4_

- [ ] 15. Offline diff buffering
  - Buffer local diffs while disconnected; flush on reconnect.
  - _Requirements: 5.3_

- [ ] 16. Visibility-based presence
  - Leave presence on tab hidden; re-enter and reconcile on visible.
  - _Requirements: 5.4_

## Phase 5: Verification

- [ ] 17. Device test pass on phone (portrait) and desktop
  - 1-finger draw, 2-finger pan, pinch zoom, loupe appears/relocates/live
    stroke, two-browser realtime sync, reconnect after backgrounding.
  - Regression check desktop wheel/draw/cursors/sync.
  - _Requirements: all_
