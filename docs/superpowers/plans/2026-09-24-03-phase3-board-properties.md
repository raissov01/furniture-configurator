# 03-phase3-board-properties жоспары

## Эталон және шешім

- [x] Worktree таза, база `59b24b6`; v4 өндіріс жолы `flattenTree` арқылы дайын.
- [x] Нақты PRO100 v7.08 `base-carcass-properties.png` қаралды: **General** (Name + Dimensions + Position), **Material**, **Reports** — үш қосымша. 2026-09-24 тапсырмасының жоғарғы ескертуі ескі 4/5 таб болжамынан басым. Біздің присадка/раскрой/DXF үшін төртінші **Производство** қосымшасы қалады.
- [x] `BoardSpec.length/width` — дайын бет өлшемдері, үшінші ось — материал қалыңдығы; H × W × D көрінісі orientation бойынша есептеледі. Қалыңдық бөлек сақталмайды, `cutLength/cutWidth` тек core-да туындайды.

## TDD тапсырмалары

- [x] `src/core/boardProperties.ts`: orientation↔H/W/D сәйкестігі және бүтін өлшем валидациясы. `tests/boardProperties.test.ts` RED→GREEN; cp мутация.
- [x] `store/configurator.ts`: board қосу, өңдеу, жылжыту, өшіру; drilling/cutouts өзгерту, undo/redo және v4 round-trip. `tests/boardStore.test.ts` RED→GREEN; cp мутация.
- [x] `components/BoardProperties.tsx`, `Workspace.tsx`: таңдалған board-қа бір Properties панелі; H × W × D, материал, төрт кромка, поза, `custom` рөлі, текстура бағыты. Жаңа UI мәтіні i18n.
- [x] `components/Configurator.tsx`: cabinet Properties нақты үш PRO100 табына және біздің төртінші Production табына жиналды; өлшемдер General ішінде.
- [x] `components/DrillEditor.tsx`: board таңдалғанда `BoardSpec.drilling` және cutouts қолмен жазылады; cabinet drillEdits жолы сақталды. Store/production тесті және браузер сценарийі жазылды.
- [x] Canonical board-тың cut/nesting/quote/DXF-ке жетуі `tests/boardProductionUi.test.ts` арқылы бекітілді; 3D дайын `Panel[]` ағынын оқиды.
- [x] `scripts/e2e-board-properties.mjs` дайын; `scripts/e2e-structure-tree.mjs` күтілімі жаңартылды. Dev/build/e2e-ні оркестр интеграциядан кейін жүргізеді.
- [x] Маңызды тесттерге cp мутация жасалды; толық тест/typecheck және қазақша есеп коммит алдында орындалады.
