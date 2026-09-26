# Автоматты буынды өзгерістен қайта құру жоспары

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Еркін тақта буынының тесіктері жоба өзгергенде автоматты қайта есептеліп, v4 файл, undo, өндіріс көрінісі және түсінікті ескерту арасында бір күйде қалсын.

**Architecture:** `src/core/autoJointRebuild.ts` пен v4 `autoJoints` моделі параллель бұтақтан біріктірілді. Store-дағы бір өзгеріс жаңа root/каталог/settings-ті `applyAutoJointChange` арқылы өткізеді; `BoardSpec.drilling` тек қол тесігі болып қалады. Барлық өндірістік `flattenTree` шақырулары сақталған буынды алады.

**Tech Stack:** TypeScript, Zustand, Zod, Vitest, Next.js, R3F.

**Spec:** `.codex-runs/queue/03d4-autojoint-rebuild.md`, `CLAUDE.md` §0.2/§3/§4.9, `docs/superpowers/specs/2026-09-20-free-form-editor-design.md`.

## Global Constraints

- H × W × D; өлшем бүтін мм, аппараттық бұрғы сызбасындағы ондық дәлдікке рұқсат.
- `Panel[]` жалғыз өндірістік ақиқат; core-да React/three жоқ.
- Қол тесіктері буыннан бөлек; бұзылған буын сақталады, өндірістік тесік шығармайды.
- Жаңа тәуелділік, баға моделі, push, deploy жоқ. UI мәтіні i18n арқылы, градиент/blur/эмоджи жоқ.

---

### Task 1: Біріктіруден туған v4 оқу регрессиясы

**Files:** `src/core/autoJointRebuild.ts`, `tests/autoJointRebuild.test.ts`, бұрыннан бар `tests/cutPageTree.test.ts`, `tests/dockProduction.test.ts`, `tests/polygonPanel.test.ts`.

**Interface:** `validateManualBoardDrilling(root, catalog, settings, layers)` тесігі жоқ тақтаны өндірістік есепке мәжбүрлемейді; қол тесігі бар тақтаны тексереді.

- [x] RED: үш бұрынғы тесттің 5 қатесін тіркеу; қол тесігі бар жарамсыз тақтаны `autoJointRebuild.test.ts` қазірдің өзінде тексереді.
- [x] GREEN: тексерісті қол тесігі бар тақтаға шектеу, сол тесттерді өткізу (4 файл, 26 тест).
- [x] Тесттің мәнін `cp` мутациясымен тексеру, қайтару (2 тест құлады).
- [ ] `npm test` + typecheck, шағын `fix(core)` коммит.

### Task 2: Store, тарих және v4 буын дерегі

**Files:** `store/configurator.ts`, `tests/boardStore.test.ts`, `tests/configuratorV4.test.ts`, жаңа `tests/autoJointStore.test.ts`.

**Interface:** store-дағы `autoJoints: AutoJointRecord[]`; `autoJointBoards`, `setAutoJointKind`; `treeEdit` және каталог өзгерісі `applyAutoJointChange` арқылы бір undo қадамын жасайды; `exportProject`/`loadProject` буындарды тасиды.

- [ ] RED: 16→18 мм, кромка, өлшем, жылжыту, материал, бекіткіш, undo/redo, v4 round-trip және қол тесік сақталуы тесттерін жазып құлағанын көру.
- [ ] GREEN: буынды BoardSpec.drilling ішіне көшірмей, store өзгерістерін бір адаптерден өткізу; тарих пен жоба сериализациясын жалғау.
- [ ] Әр маңызды тестке `cp` арқылы мутация, тест құлағанын көру және қалпына келтіру.
- [ ] `npm test` + typecheck, `feat(store)` коммит.

### Task 3: Өндіріс көрінісі мен ескерту

**Files:** `components/panels/StructurePanel.tsx`, `components/CutPage.tsx`, өндіріс селекторлары мен экспорт шақырулары, `lib/locales/{kk,ru,en,uz}.ts`, `scripts/e2e-structure-tree.mjs`, тиісті UI тесттері.

**Interface:** өндіріс `flattenTree(..., autoJoints)` алады; Structure таңдалған жұптың буынын/бұзылған күйін көрсетеді және бекіткішті ауыстырады; ескерту өріс атымен шығады.

- [ ] RED: өндірістік тесіктер мен broken warning UI сценарийін толықтырып құлағанын көру.
- [ ] GREEN: селекторлар/экспорт, i18n ескертуі, UI басқаруын жалғау.
- [ ] Мутация, толық тест, typecheck, `npm run build -- --webpack`, бос порттағы e2e; dev серверін тоқтату.
- [ ] Diff ревью, `feat(ui)` коммит, жоспардағы барлық қадамды белгілеу.

### Task 4: Интеграция және есеп

**Files:** `.codex-runs/0924-03d4-autojoint-rebuild-report.md`.

- [ ] Worktree diff ревью; `codex/0924`-ке `merge --no-ff`.
- [ ] Merge-ден кейін толық тест, typecheck, UI build/e2e; нәтижені қазақша есепке жазу.
- [ ] Worktree-ді алып тастау; өзіміз қосқан server/browser процестерін тоқтату.
