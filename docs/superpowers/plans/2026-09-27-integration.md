# 2026-09-27 Integration Plan

> **For agentic workers:** Work in `codex/0927-int` at `.worktrees/int`; do not change `codex/0924` or push.

**Goal:** Combine the requested branches into one staging-ready local branch.

**Architecture:** Preserve branch history with `--no-ff` merges. Treat branches already in the base as satisfied, and resolve remaining conflicts without dropping either behavior. Verify each merge by typechecking and verify the final tree by the full test suite, reference wardrobe test, and production build.

**Tech Stack:** Git, TypeScript, Vitest, Next.js.

**Spec:** `.codex-runs/queue/_common.md` and the 2026-09-27 integration task.

## Global Constraints

- Use the project dimension order H × W × D and integer millimetres.
- Keep `src/core` pure TypeScript and `Panel[]` as the manufacturing source of truth.
- Limit Vitest to two workers with a 2048 MB Node heap.
- Do not push or deploy.

---

### Task 1: Establish a clean baseline

- [x] Inspect worktrees, branches, and existing integration work.
- [x] Run baseline typecheck on `codex/0924`.
- [x] Run baseline tests with two workers and record the count: 2900 passed, 5 skipped.

### Task 2: Integrate branches

- [x] Merge each requested branch in order when it is not already an ancestor.
- [x] Run typecheck after each actual merge; inspect and resolve any conflict preserving both intentions.
- [x] Review and merge remaining `claude/*` branches absent from `codex/0924`.

### Task 3: Verify and report

- [x] Run the complete Vitest suite and the reference wardrobe test: 3119 passed, 5 skipped; snapshot 3/3 passed.
- [x] Run typecheck and `next build` with the memory limit; webpack build passed in the symlinked worktree.
- [x] Review the final diff, write the report in the main tree, and leave the integration worktree clean.
