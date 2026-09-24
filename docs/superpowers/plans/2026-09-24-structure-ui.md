# Structure UI implementation plan

**Goal:** Replace the flat Structure dock with the canonical v4 project tree, preserve generated panel selection, and expose the existing Layers panel in the same dock.

**Design decision:** Keep one dock with Project and Selection tabs, as in the observed PRO100 structure window. Render actual group/cabinet/board/solid nodes recursively, then generated cabinet panel rows from `flattenTree`. Hidden nodes remain in the DOM and visible in the tree so they can be unhidden; their production panels are absent. UI state (expanded rows, multi-selection, focused row) is local; persisted edits and undo/redo go through the structure agent's store actions. The Layers tab reuses `LayersPanel` and its callbacks. Native HTML drag/drop drops a node into a group only; invalid self/descendant/locked moves are blocked by store/core. This is simpler than a new docking or drag library and preserves the existing panel.

**Own files:** `components/panels/StructurePanel.tsx`, `components/panels/LayersPanel.tsx`, `components/panels/TreeDock.tsx`, new `components/panels/canonicalTreeRows.ts`, tests, locale dictionaries, `scripts/e2e-structure-tree.mjs`, this plan. `Workspace.tsx`, store/core/scene are owned by the structure agent. The exported integration contract is a no-prop `TreeDock` component at `@/components/panels/TreeDock`.

**Review focus:** Group nesting and hidden layer behavior, part IDs matching `store.selected`/3D, keyboard focus and modifier selection, drag/drop cycles, lock affordances, and no duplicate dock.

## Task 1 — Pure tree rows and selection model

- [x] Add RED Vitest coverage for recursive order/depth, group/board/solid rows, generated cabinet parts, hidden ancestor/layer visibility, single-cabinet vs multi-node panel selection IDs, multi-select Shift/Ctrl behavior, and drop eligibility.
- [x] Implement pure adapter and selection helpers without React; confirm focused tests GREEN.
- [x] Mutate a key selection/hidden rule, observe RED, restore with `cp` and rerun.

## Task 2 — Structure view and dock

- [x] Add focused component/markup tests where existing harness supports them; otherwise test the pure controller plus standalone browser scenario for root.
- [x] Implement Project/Selection tabs, accessible recursive rows, collapse without DOM removal, rename, hide/lock, group/ungroup, drag/drop reparent, keyboard shortcuts, and 3D selection sync.
- [x] Connect no-prop `TreeDock` to v4 store checkpoint. Preserve `StructurePanel` import path for existing demo.
- [x] Reuse `LayersPanel` in the dock; localize all added interface strings in kk/en/uz.

## Task 3 — Verification and handoff

- [x] Add `scripts/e2e-structure-tree.mjs` as an isolated scenario; do not run browser locally.
- [x] After checkpoint, run focused tests, full `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=2`, and typecheck (memory check first); review own diff.
- [x] Write `.codex-runs/0924-phase2-structure-tree-report.md` with tests, mutation, integration/e2e instructions, and any limitation; commit in Kazakh. Parent handles merge/build/e2e.
