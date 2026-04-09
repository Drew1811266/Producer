# Producer Module I Semantic Zoom And LOD Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add projected-size-driven semantic zoom so Producer nodes degrade from detailed cards to compact semantic silhouettes as the user zooms out, without turning the canvas into a generic whiteboard or exposing raw zoom-threshold logic all over the UI.

**Architecture:** Keep LOD as a pure frontend concern inside the canvas rendering stack. Compute one shared projected-node appearance model from world layout + camera + viewport, then make both the Pixi renderer and the DOM fallback consume that model so behavior stays consistent across production and test environments. Do not touch Rust, SQLite, graph persistence, or the quick-add/drawer/backend command surface in this module.

**Tech Stack:** React 19, TypeScript, PixiJS 8, Vitest, Testing Library

**Implementation notes:** Follow [$test-driven-development](/Users/drew/.codex/skills/test-driven-development/SKILL.md) for each task. Use [$subagent-driven-development](/Users/drew/.codex/skills/subagent-driven-development/SKILL.md) during execution if subagents are available.

---

## File Map

- Create: `src/canvas/lod.ts`
  - Central projected-size-to-LOD mapping. No JSX, no Pixi objects, no DOM.
- Create: `src/canvas/lod.test.ts`
  - Unit tests for LOD thresholds, anchor handling, and projected-size semantics.
- Create: `src/canvas/nodePresentation.ts`
  - Pure helper that converts a projected node + selection/system flags into a render descriptor used by both Pixi and DOM fallback.
- Create: `src/canvas/nodePresentation.test.ts`
  - Tests for which labels/status/body chrome survive in each LOD band.
- Modify: `src/canvas/nodeProjection.ts`
  - Add projected metrics and LOD fields to the existing projection result. Keep camera math centralized here.
- Modify: `src/canvas/CanvasNodeLayer.tsx`
  - Apply LOD in the DOM fallback path. Render fewer semantics at smaller projected sizes; keep anchors non-interactive.
- Modify: `src/canvas/CanvasStage.tsx`
  - Apply the same LOD descriptor to Pixi rendering. Remove ad hoc “always draw full card text” behavior.
- Modify: `src/canvas/CanvasViewport.test.tsx`
  - Integration tests that drive zoom changes and assert semantic degradation in the fallback path.
- Modify: `src/styles.css`
  - Fallback-only classes for compact/chip/silhouette node states. No global layout changes.

## Scope Guardrails

- Do not add Rust commands, migrations, or database fields.
- Do not add edge rendering or edge-level LOD.
- Do not add thumbnail previews to nodes yet. Even the highest-detail LOD still renders text/status only.
- Do not add generic whiteboard affordances such as freeform sticky-note collapse, arbitrary shape aggregation, or outline mode.
- Do not scatter zoom thresholds across components. All LOD decisions must come from shared projection/presentation helpers.
- Do not remove selection or child-graph affordances. Enterable nodes must still read as enterable at medium detail; at extreme zoom-out they may collapse visually but must keep hit areas and selection correctness.

## LOD Model

Use projected screen size, not raw camera zoom, to determine detail level. The initial cut should be simple and stable:

- `detail`
  - Node is large enough to show type label, full title, and optional status text.
- `summary`
  - Node still shows a full title but hides status and reduces chrome.
- `chip`
  - Node keeps only the title or a short semantic label in a compact capsule.
- `silhouette`
  - Node hides text entirely and renders as a semantic block with selection outline only.

Suggested thresholds should be expressed in `src/canvas/lod.ts` using projected screen dimensions:

- Use `projectedMinEdge` and `projectedArea`.
- Keep the exact values centralized and named, for example:
  - `detail` when `projectedMinEdge >= 72` and `projectedArea >= 9000`
  - `summary` when `projectedMinEdge >= 42` and `projectedArea >= 3600`
  - `chip` when `projectedMinEdge >= 22` and `projectedArea >= 900`
  - else `silhouette`

Anchor nodes should reuse the same LOD engine but with anchor-specific presentation rules:

- `detail`: anchor label + title
- `summary`: title only
- `chip`: compact anchor pill
- `silhouette`: thin anchor bar or minimal banner block

## Task 1: Add Shared LOD Classification

**Files:**
- Create: `src/canvas/lod.ts`
- Create: `src/canvas/lod.test.ts`

- [ ] **Step 1: Write the failing test**

Add unit tests covering:
- projected-size classification into `detail`, `summary`, `chip`, `silhouette`
- projected-size semantics staying stable when node world size differs but on-screen size is the same
- anchor and non-anchor nodes using the same classifier input model

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/lod.test.ts`
Expected: FAIL because `lod.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `type NodeLodLevel = 'detail' | 'summary' | 'chip' | 'silhouette'`
- `type NodeLodMetrics = { projectedWidth: number; projectedHeight: number; projectedArea: number; projectedMinEdge: number }`
- `resolveNodeLod(metrics: NodeLodMetrics): NodeLodLevel`
- named threshold constants in one place

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/lod.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/lod.ts src/canvas/lod.test.ts
git commit -m "feat: add canvas lod classifier"
```

## Task 2: Add Shared Node Presentation Descriptor

**Files:**
- Create: `src/canvas/nodePresentation.ts`
- Create: `src/canvas/nodePresentation.test.ts`
- Modify: `src/canvas/nodeProjection.ts`

- [ ] **Step 1: Write the failing test**

Add tests that describe the presentation contract, for example:
- detail nodes expose type label, title, status, and full chrome
- summary nodes expose type label + title, but no status
- chip nodes expose a compact title token only
- silhouette nodes expose no text but still expose fill/border style info
- system anchors are flagged non-interactive and use anchor-specific descriptors

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/nodePresentation.test.ts`
Expected: FAIL because the presentation helper does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `ProjectedGraphNode` extension in `src/canvas/nodeProjection.ts` with:
  - `projectedArea`
  - `projectedMinEdge`
  - `lod`
- `buildNodePresentation(projectedNode, isSelected)` in `src/canvas/nodePresentation.ts`
- a small descriptor shape, for example:
  - `lod`
  - `interactive`
  - `showTypeLabel`
  - `showTitle`
  - `showStatus`
  - `shape`
  - `padding`
  - `borderWidth`
  - `titleText`
  - `typeText`
  - `statusText`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/nodePresentation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/nodeProjection.ts src/canvas/nodePresentation.ts src/canvas/nodePresentation.test.ts
git commit -m "feat: add shared node presentation model"
```

## Task 3: Apply LOD To DOM Fallback Rendering

**Files:**
- Modify: `src/canvas/CanvasNodeLayer.tsx`
- Modify: `src/styles.css`
- Modify: `src/canvas/CanvasViewport.test.tsx`

- [ ] **Step 1: Write the failing test**

Extend `CanvasViewport.test.tsx` with zoom-driven assertions in the fallback path:
- at default zoom, a node shows title and status
- after zooming far enough out, status disappears but title remains
- after zooming further out, title disappears and a silhouette/chip element remains
- anchor nodes never become selectable or openable, regardless of LOD

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/CanvasViewport.test.tsx`
Expected: FAIL because the fallback still renders all node text at all zoom levels.

- [ ] **Step 3: Write minimal implementation**

Update `CanvasNodeLayer.tsx` to:
- consume the projected-node `lod`
- route every fallback node through `buildNodePresentation(...)`
- render only the semantics allowed by the current LOD
- keep node hit targets and `data-node-id` intact even when text is hidden

Update `src/styles.css` to add clear classes for:
- `.canvas-node-card-lod-detail`
- `.canvas-node-card-lod-summary`
- `.canvas-node-card-lod-chip`
- `.canvas-node-card-lod-silhouette`
- matching anchor variants if needed

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/CanvasViewport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasNodeLayer.tsx src/canvas/CanvasViewport.test.tsx src/styles.css
git commit -m "feat: apply semantic lod to fallback node rendering"
```

## Task 4: Apply LOD To Pixi Rendering

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Modify: `src/canvas/nodeProjection.ts`
- Modify: `src/canvas/nodePresentation.ts`

- [ ] **Step 1: Write the failing test**

Add or extend pure-unit tests instead of trying to snapshot Pixi directly:
- verify the Pixi-facing descriptor exposes the reduced content expected at each LOD
- verify enterable nodes still keep pointer event mode even when rendered as compact chips/silhouettes
- verify system anchors remain non-interactive

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/nodePresentation.test.ts src/canvas/lod.test.ts`
Expected: FAIL because the Pixi path still assumes a full card layout and does not consume the descriptor fully.

- [ ] **Step 3: Write minimal implementation**

Refactor `CanvasStage.tsx` so the Pixi redraw loop:
- projects nodes once
- builds a presentation descriptor once per node
- draws card/background shape based on descriptor
- conditionally creates type/title/status `Text` objects only when descriptor says to show them
- uses lighter geometry for chip/silhouette states
- keeps selection borders visible across all LOD levels

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/nodePresentation.test.ts src/canvas/lod.test.ts src/canvas/CanvasViewport.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasStage.tsx src/canvas/nodeProjection.ts src/canvas/nodePresentation.ts
git commit -m "feat: apply semantic lod to pixi node rendering"
```

## Task 5: Final Integration Verification And Cleanup

**Files:**
- Modify: `src/canvas/CanvasViewport.test.tsx`
- Modify: `src/App.test.tsx` only if a regression proves necessary
- Modify: `src/styles.css` only if class cleanup is needed

- [ ] **Step 1: Write the final regression checks**

Add integration coverage for:
- no regression in selection/deselection with low-detail nodes
- no regression in child-graph double-click behavior on enterable nodes after LOD changes
- no regression in drawer occlusion camera-pan logic when the selected node is in compact or silhouette mode

- [ ] **Step 2: Run focused tests to verify expected failures**

Run: `npm test -- src/canvas/CanvasViewport.test.tsx src/App.test.tsx`
Expected: Any failures should be limited to selection/double-click/occlusion regressions introduced by the new LOD path.

- [ ] **Step 3: Fix only the regressions**

Make minimal adjustments so:
- event routing still works in both DOM fallback and Pixi modes
- node geometry used for occlusion checks remains based on actual world layout, not reduced text content
- no new UI appears outside the canvas overlay model

- [ ] **Step 4: Run the full verification suite**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/canvas/CanvasViewport.test.tsx src/styles.css src/App.test.tsx
git commit -m "test: verify semantic zoom lod integration"
```

## Acceptance Checklist

- Zooming out hides node detail progressively instead of scaling every label indefinitely.
- LOD is driven by projected on-screen size, not scattered `camera.zoom` checks.
- Pixi and DOM fallback paths use the same semantic model.
- System anchors remain visible as context markers but are never editable/selectable.
- Canvas remains map-like and semantic. The result must not look like a generic whiteboard with tiny illegible cards.
- No backend, persistence, graph schema, or node payload format changes are introduced by Module I.

## Verification Commands

- `npm test -- src/canvas/lod.test.ts`
- `npm test -- src/canvas/nodePresentation.test.ts`
- `npm test -- src/canvas/CanvasViewport.test.tsx`
- `npm test`
- `npm run lint`
- `npm run build`

