# Producer Layered xyflow Node System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current fallback canvas node chrome with a React Flow based layered node system that uses React Flow UI building blocks and preserves Producer's existing graph CRUD, camera, drawer, and quick-add workflows.

**Architecture:** Keep the existing backend node taxonomy and graph APIs intact. Introduce a React Flow viewport adapter that maps persisted graph nodes into custom Producer node components derived from React Flow UI `BaseNode` primitives, with layer-aware creation filters, top-in bottom-out handles, and lightweight support components for status, appendix badges, placeholder add nodes, and future group/handle variants.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, `@xyflow/react`, React Flow UI patterns, Tailwind CSS 4, shadcn-style local UI components.

---

### Task 1: Node system contract

**Files:**
- Create: `src/canvas/producerNodeSystem.tsx`
- Create: `src/canvas/producerNodeSystem.test.ts`
- Modify: `src/copy/zh-CN.ts`

- [ ] **Step 1: Write failing tests for node-family mapping, status mapping, and layer whitelists**
- [ ] **Step 2: Run `npm test -- src/canvas/producerNodeSystem.test.ts` and confirm failures**
- [ ] **Step 3: Implement Producer node visual mapping and localized labels without renaming backend node types**
- [ ] **Step 4: Re-run `npm test -- src/canvas/producerNodeSystem.test.ts` and confirm green**

### Task 2: React Flow UI foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.app.json`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Create: `src/lib/utils.ts`
- Create: `src/components/base-node.tsx`
- Create: `src/components/base-handle.tsx`
- Create: `src/components/node-status-indicator.tsx`
- Create: `src/components/node-appendix.tsx`
- Create: `src/components/placeholder-node.tsx`
- Create: `src/components/labeled-group-node.tsx`
- Create: `src/components/labeled-handle.tsx`
- Create: `src/components/button-handle.tsx`

- [ ] **Step 1: Add failing smoke coverage for React Flow viewport rendering**
- [ ] **Step 2: Install and wire Tailwind 4 and `@xyflow/react`**
- [ ] **Step 3: Vendor the React Flow UI building blocks into the app source**
- [ ] **Step 4: Re-run the smoke test to confirm the base stack renders**

### Task 3: Canvas viewport migration

**Files:**
- Modify: `src/canvas/CanvasViewport.tsx`
- Create: `src/canvas/ProducerEdge.tsx`
- Modify: `src/canvas/CanvasViewport.test.tsx`

- [ ] **Step 1: Write failing viewport tests for selection, drag, top-bottom handles, placeholder add state, and child-graph entry**
- [ ] **Step 2: Run `npm test -- src/canvas/CanvasViewport.test.tsx` and confirm failures**
- [ ] **Step 3: Replace the fallback stage with a controlled React Flow viewport that preserves the existing external props contract**
- [ ] **Step 4: Re-run `npm test -- src/canvas/CanvasViewport.test.tsx` and confirm green**

### Task 4: App integration and regression pass

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/quick-add/QuickAddOverlay.tsx`
- Modify: `src/quick-add/localNode.ts`

- [ ] **Step 1: Add failing assertions for layer-aware quick add options and placeholder-triggered creation**
- [ ] **Step 2: Run the affected tests and confirm failures**
- [ ] **Step 3: Integrate layer filtering and any viewport data plumbing needed by the new node system**
- [ ] **Step 4: Run `npm test -- src/canvas/producerNodeSystem.test.ts src/canvas/CanvasViewport.test.tsx src/App.test.tsx` and confirm green**
