# Базис присадка экспорты және 17-кезең түзетулері

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion task by task.

**Goal:** Базис экспорты тармағын қауіпсіз біріктіру, екі дәлелденген қате мен қалған присадка тармақтарын тексеру.

**Architecture:** `claude/basis-script` diff-ін осы оқшау тармақта merge алдында stage күйіне әкеліп, тестті RED, түзетуді GREEN орындаймыз. Скрипт `flattenTree` панель/тесік моделін тұтынады; audit кірісі нақты Zod құрылымымен тексеріледі. Базис runtime жоқтығы есепте ашық қалады.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js.

**Spec:** `CLAUDE.md` §0, §3, §4.3, §4.9; `.codex-runs/0924-basis-review-notes.md`; `.codex-runs/basis-drilling-import-route.md`; тапсырманың 17 тармағы.

## Global Constraints

- H × W × D, миллиметр бүтін; `Panel[]` — өндірістің ақиқат көзі.
- Тәуелділік, ойдан өндірістік тұрақты, proprietary SDK тип файлы қосылмайды.
- Субагент build/dev/e2e жүргізбейді; толық test `--maxWorkers=2` және typecheck commit алдында.

## Task 1 — Базис тармағын ревью және интеграция

- [x] `claude/basis-script` diff-ін қарап, merge-ді commit-сіз stage күйінде бастау; конфликт болса екі жақты сақтау.
- [x] `tests/fixtures/bazis/index.d.ts.txt`-ті алып, API тестіне қысқа өз stub-ымызды жазу; лицензия мен нақты дереккөзге сілтемені сақтау.
- [x] `basis-drilling-import-route.md` құжатын `docs/basis/` ішіне көшіру; экспорт уәделерін дерекке сай тексеру.

## Task 2 — Екі регрессия (TDD)

- [x] Кабинеттің жеке `minBandSubtract` баптауы clip/cut origin-ге жетпейтінін тестпен RED көрсету.
- [x] Панель түйініне арналған нақты settings-ті скрипт экспортына жеткізу, GREEN және мутация.
- [x] `expected.panels:[null]` audit parse-тен өтпеуі керек екенін RED көрсету.
- [x] `expected` үшін нақты Zod schema, CLI-дің басқарылатын validation қатесі; GREEN және мутация.

## Task 3 — 17-қалған тармақтарының аудиті

- [x] Claude түзетулері мен алдыңғы тесттер арқылы 2–10 пункттің қайсысы жасалғанын кодпен белгілеу; жасалмаған маңыздысын TDD-пен толықтыру.
- [x] `scripts/e2e-basis-export.mjs` ZIP құрамының сценарийі жазылды, `node --check` өтті; браузерді оркестр іске қосады.
- [x] Diff review, `npm test -- --maxWorkers=2`, `npm run typecheck`, e2e сценарийінің syntax check.
- [x] `.codex-runs/0924-17-drill-followups-report.md` есеп, қалған жұмыс және шағын қазақша conventional коммиттер.

## Peer review follow-up

- [x] Chrome spawn қатесі try/finally cleanup-тан тыс қалатынын RED тестпен көрсету; процесс басталуын try ішінде күтіп, екі temp буманы жабу; GREEN және `cp` мутациясы.
- [x] `holes:null` және `holes.available:false` кезінде CLI exit 0 екенін RED тестпен көрсету; environment мәселесіне exit 3 және анық хабарлама; GREEN және `cp` мутациясы.
- [x] Толық `npm test -- --maxWorkers=2`, typecheck, diff review, есеп және шағын коммит.
