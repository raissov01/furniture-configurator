# Еркін редактор 4-фаза Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion. This task uses one isolated worktree; no further agents.

**Goal:** Еркін тақталарды дәл орналастыру, привязка, массив және көптік туралауды пайдаланушыға беру.

**Architecture:** `src/core` ішінде өлшем мен координата таза функциялармен есептеледі. Store ағашты бір әрекетпен жаңартып, тарихқа бір жазба қосады; көрініс пен өндіріс `flattenTree` нәтижесін пайдаланады.

**Tech Stack:** TypeScript, Zustand, React, Vitest, R3F.

**Spec:** `docs/superpowers/specs/2026-09-20-free-form-editor-design.md` §7–8, §11.

## Global Constraints

- H × W × D реті; өлшем және орын бүтін мм.
- `src/core` React/three.js импортысыз; `Panel[]` жалғыз өндірістік ақиқат.
- UI мәтіні `t()` арқылы қазақша және орысша.
- Бір уақытта Next dev/build/e2e іске қосылмайды; бұл worktree-де оларды оркестр атқарады.

---

### Task 1: Привязка және массивтің таза өзегі

**Files:** Create `src/core/snap.ts`, `src/core/array.ts`; Modify `src/core/index.ts`; Test `tests/snap.test.ts`, `tests/array.test.ts`.

- [x] Алдымен бетті/жиекті/центрді, grid/wall-ды және қателерді тексеретін RED тесттер.
- [x] `snapPosition` пен `arrayNodes` минимал іске асыруы, GREEN.
- [x] Әр маңызды тестке әдейі мутация, құлауын көру және `cp` арқылы қалпына келтіру.
- [ ] Толық тест/typecheck, commit.

### Task 2: Ағаш әрекеттері және дәл енгізу

**Files:** Modify `src/core/treeEditing.ts`, `store/configurator.ts`, `components/BoardProperties.tsx`; Test `tests/treeEditing.test.ts`, `tests/boardProperties.test.ts`.

- [ ] RED: массив id-лері бірегей, топ ішінде дұрыс орналасады; multi-move бір undo; +/- енгізу.
- [ ] Store әрекеттері мен қасиет өрістерін іске асыру, GREEN.
- [ ] Мутация, толық тест/typecheck, commit.

### Task 3: Көптік туралау/тарату UI және 3D сүйреу

**Files:** Modify `components/panels/StructurePanel.tsx`, `components/Scene.tsx`; Test `tests/structureEditor.test.ts`, `scripts/e2e-structure*.mjs`.

- [ ] RED: таңдаудың дүниелік bounds-ы мен позициясы дәл ауысады, бір undo.
- [ ] Батырмалар/хоткейлер, массив диалогы және еркін тақта сүйреуі.
- [ ] Мутация, толық тест/typecheck, commit; e2e сценарийін қосу, node --check.

### Task 4: Тексеру және есеп

- [ ] Өз diff-ін review, қателерін түзету.
- [ ] `npm test -- --maxWorkers=2`, `npm run typecheck`; есепке сандар мен шектеулер.
- [ ] `.codex-runs/0924-04-phase4-snap-array-report.md` жазу; оркестрге SHA хабарлау.
