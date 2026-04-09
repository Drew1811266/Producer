# Producer Canvas Rendering Best Practices V1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Producer canvas onto a crisp-by-default rendering foundation with DPR-aware Pixi initialization, screen-space snapping, consistent node geometry/text layering, and regression tests that preserve semantic zoom behavior.

**Architecture:** Keep the existing Tauri + React + PixiJS canvas stack and improve it in-place rather than replacing it. Extract pure rendering helpers for DPR and pixel snapping, then make `CanvasStage` consume those helpers so Pixi rendering stays sharp on Retina and Windows fractional scaling while the DOM fallback stays behaviorally aligned. Do not add media thumbnails, video frames, or `cacheAsTexture` flows in this pass because the current canvas data model does not yet render media previews.

**Tech Stack:** React 19, TypeScript, PixiJS 8, Vitest, Testing Library

---

## Scope Check

The provided spec spans multiple subsystems:

- renderer bootstrapping and DPR handling
- geometry/text layering and pixel alignment
- text system strategy (`BitmapText` / `Text` / DOM editing)
- thumbnail/video preview LOD and cache policy
- viewport culling and cache invalidation

This implementation plan covers the parts that are already grounded in the current repo:

- Pixi renderer initialization and DPR updates
- screen-space snapping for crisp geometry and lines
- clearer Pixi layer separation between node geometry and node text
- tests for zoom, fallback behavior, and render helpers

This plan explicitly defers:

- thumbnail/video preview rendering, because `GraphNodeSummary` does not currently expose per-node preview payloads on the canvas path
- `BitmapText` buckets, because the project does not yet ship a bitmap font asset pipeline and that deserves its own focused plan
- `cacheAsTexture`, because current nodes are interactive and frequently redrawn, and the spec explicitly says not to cache ordinary working nodes

## File Map

- Create: `src/canvas/rendering.ts`
  - Pure helpers for DPR resolution, DPR change subscription, pixel snapping, and screen-space line alignment.
- Create: `src/canvas/rendering.test.ts`
  - Unit tests for DPR normalization and pixel snapping helpers.
- Modify: `src/canvas/CanvasStage.tsx`
  - Pixi Application init, host resize/DPR reaction, screen-space snapping, and explicit geometry/text layer separation.
- Modify: `src/canvas/canvasEdges.ts`
  - Optional edge-point snapping helpers if needed by the new render helpers.
- Modify: `src/canvas/CanvasViewport.test.tsx`
  - Integration tests covering semantic zoom regressions and any fallback-visible behavior affected by render-layer changes.
- Modify: `src/styles.css`
  - Only if the fallback path needs a tiny class adjustment to stay visually aligned with the new crispness rules.

## Guardrails

- Do not add Rust/Tauri commands or backend schema changes.
- Do not add media previews to the canvas in this pass.
- Do not add `cacheAsTexture` for ordinary nodes.
- Do not rework the DOM fallback into a separate architecture; keep Pixi production and DOM fallback behavior aligned.
- Do not introduce CSS `transform: scale(...)` anywhere on the final canvas surface.
- Keep tests focused on pure math/helpers and DOM fallback semantics. Avoid brittle Pixi snapshots.

## Task 1: Add Shared DPR And Pixel-Snapping Helpers

**Files:**
- Create: `src/canvas/rendering.ts`
- Create: `src/canvas/rendering.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- resolving a safe renderer DPR from raw input values
- building crisp pixel-aligned coordinates for 1px lines
- snapping screen-space rectangles and anchor points without mutating world-space data
- re-subscribing the DPR media query when the observed DPR changes

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/rendering.test.ts`
Expected: FAIL because `rendering.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement pure helpers such as:
- `resolveCanvasResolution(rawDpr?: number): number`
- `alignScreenLine(value: number, lineWidth?: number): number`
- `snapScreenPoint(point, resolution): point`
- `snapScreenRect(rect, resolution): rect`
- `subscribeToDevicePixelRatioChanges(onChange): () => void`

Keep browser access behind tiny wrappers so unit tests can stub it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/rendering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/rendering.ts src/canvas/rendering.test.ts
git commit -m "feat: add canvas rendering helpers"
```

## Task 2: Make Pixi Initialization DPR-Aware And Layered

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`

- [ ] **Step 1: Write the failing test**

Extend tests or add helper-driven tests that prove:
- the Pixi init path requests `autoDensity: true`
- the Pixi init path uses normalized DPR-based `resolution`
- the stage reacts to DPR changes by updating renderer resolution and redrawing
- node geometry and node text are maintained as distinct Pixi containers

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/rendering.test.ts src/canvas/CanvasViewport.test.tsx`
Expected: FAIL because the current stage init omits DPR config and the node layer is not split into geometry/text sublayers.

- [ ] **Step 3: Write minimal implementation**

Update `CanvasStage.tsx` to:
- initialize Pixi with `autoDensity: true`, `resolution: resolveCanvasResolution(window.devicePixelRatio)`, `antialias: true`, and `resizeTo: host`
- subscribe to DPR changes and update renderer resolution without CSS scaling hacks
- replace the single node layer with separate node geometry and node text containers
- keep selection rings as separate geometry objects rather than simulated texture scaling

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/rendering.test.ts src/canvas/CanvasViewport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasStage.tsx src/canvas/rendering.ts src/canvas/rendering.test.ts src/canvas/CanvasViewport.test.tsx
git commit -m "feat: make canvas stage dpr aware"
```

## Task 3: Snap Grid, Node Geometry, And Edge Strokes To Screen Pixels

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Modify: `src/canvas/canvasEdges.ts`
- Modify: `src/canvas/rendering.ts`
- Modify: `src/canvas/rendering.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that describe crispness behavior:
- 1px grid lines align to half-pixel positions in screen space
- node rectangles and selection rings snap their screen-space boundaries before drawing
- edge polyline points can be transformed into aligned screen-space points for the fallback path or future debug tooling

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/rendering.test.ts`
Expected: FAIL because the current implementation draws directly from unsnapped floating-point values.

- [ ] **Step 3: Write minimal implementation**

Implement snapping in the Pixi path:
- draw grid using aligned screen-space coordinates
- snap node body, accent bars, silhouette bars, and selection rings
- align edge label positions and edge stroke points where helpful

Do not corrupt world coordinates. Snap only the final draw coordinates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/rendering.test.ts src/canvas/CanvasViewport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasStage.tsx src/canvas/canvasEdges.ts src/canvas/rendering.ts src/canvas/rendering.test.ts src/canvas/CanvasViewport.test.tsx
git commit -m "feat: align canvas geometry to device pixels"
```

## Task 4: Verify DOM Fallback Semantics Still Match The Shared LOD Model

**Files:**
- Modify: `src/canvas/CanvasViewport.test.tsx`
- Modify: `src/styles.css` (only if needed)

- [ ] **Step 1: Write the failing test**

Add focused fallback assertions for:
- detail -> summary -> silhouette transitions still happen at the current thresholds
- selection and double-click behavior still work after the Pixi refactor
- system anchors remain visible and non-interactive

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/CanvasViewport.test.tsx`
Expected: FAIL if the Pixi-layer refactor changed shared LOD or fallback assumptions.

- [ ] **Step 3: Write minimal implementation**

Only adjust fallback classes or props if the tests reveal drift. Do not redesign the fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/CanvasViewport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasViewport.test.tsx src/styles.css
git commit -m "test: lock fallback semantic zoom behavior"
```

## Task 5: Full Regression Sweep

**Files:**
- Modify: none unless regressions are found

- [ ] **Step 1: Run targeted frontend tests**

Run:
- `npm test -- src/canvas/rendering.test.ts`
- `npm test -- src/canvas/lod.test.ts`
- `npm test -- src/canvas/nodePresentation.test.ts`
- `npm test -- src/canvas/CanvasViewport.test.tsx`

Expected: PASS

- [ ] **Step 2: Run the broader frontend suite if the targeted tests pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Manual QA checklist**

Verify in the app:
- canvas stays sharp when moving between displays or changing OS scaling
- no CSS-scaled blur on the Pixi surface
- grid, borders, and selection rings look stable at 100%, 125%, 150%, and 200%
- semantic zoom behavior still matches the current LOD rules

- [ ] **Step 4: Commit regression fixes if needed**

```bash
git add <files>
git commit -m "fix: address canvas rendering regressions"
```

## Notes For Future Plans

Create separate follow-up plans for:

- `BitmapText` buckets + selected-node `Text` strategy
- media thumbnail/video frame LOD and async upgrade path
- view culling / prefetch margins / background thumbnail work queues
- optional selective caching for far-field aggregate summaries only
