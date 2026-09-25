# PRO100 номенклатура импорты

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion task by task.

**Goal:** Атаулардан танылған қарапайым шкаф ен қатарын генератор шаблондарына байланыстырып, кітапханада «Стандарт номенклатура» санатын көрсету; сәйкессіздерді есепке шығару.

**Architecture:** `docs/pro100/nomenclature.json` — дайын талданған атаулардың жалғыз кірісі. Таза сәйкестендіргіш тек генератор айнытпай жасайтын типтерді өткізеді. CLI детерминистік шағын манифест пен қамту есебін жазады; runtime манифестті қолдағы шаблондардан нақты `CabinetTemplate[]` етіп құрастырады. H/D шаблоннан алынады, атау оларды дәлелдемейді.

**Tech Stack:** TypeScript, tsx, Vitest, Next/React.

**Spec:** `docs/superpowers/specs/2026-09-20-free-form-editor-design.md` §10–11; `docs/pro100/nomenclature.md`.

## Global Constraints

- Өлшем реті H × W × D; миллиметр бүтін.
- `.meb` және суреттер репоға кірмейді; баға мен H/D ойдан шығарылмайды.
- Өзекте React/three жоқ; UI мәтіндері i18n арқылы.

## Task 1 — Сәйкестендіру және CLI

- [x] Таза сәйкестендіргішке тест жазып, RED тексеру: есік/ящик/мойка; ерекше/белгісіз модельдер есепке түседі; қайталау бірігеді.
- [x] `src/core/nomenclature.ts`, `scripts/importNomenclature.ts` және `package.json` командасын жасау.
- [x] Генерацияланған манифест пен қамту есебін жазу, детерминизм мен мутацияны тексеру.

## Task 2 — Галереяға қосу

- [x] Импортталған манифесттен шаблон құрастыру тесті RED: ен, есік/ящик саны, панель генерациясы.
- [x] `src/core/templates.ts` және `components/TemplateGallery.tsx` ішінде «Стандарт номенклатура» сүзгісін іске қосу; i18n кілтін қосу.
- [x] Жаңа e2e сценарийі, синтаксис тексеруі. Браузер орындауын оркестр жасайды.

## Task 3 — Дәлел және есеп

- [x] `npm test -- --maxWorkers=2`, `npm run typecheck`; өз diff ревьюі.
- [x] `.codex-runs/0924-06-phase6-nomenclature-report.md`: қамту, сәйкес келмегендер, тест, мутация, тәуекел.
- [x] Шағын conventional коммиттер (қазақша).
