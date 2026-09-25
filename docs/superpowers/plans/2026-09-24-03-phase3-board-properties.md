# 03-phase3-board-properties жоспары

## Эталон және шешім

- [x] Worktree таза, база `59b24b6`; v4 өндіріс жолы `flattenTree` арқылы дайын.
- [x] Нақты PRO100 v7.08 `base-carcass-properties.png` қаралды: **General** (Name + Dimensions + Position), **Material**, **Reports** — үш қосымша. 2026-09-24 тапсырмасының жоғарғы ескертуі ескі 4/5 таб болжамынан басым. Біздің присадка/раскрой/DXF үшін төртінші **Производство** қосымшасы қалады.
- [x] `BoardSpec.length/width` — дайын бет өлшемдері, үшінші ось — материал қалыңдығы; H × W × D көрінісі orientation бойынша есептеледі. Қалыңдық бөлек сақталмайды, `cutLength/cutWidth` тек core-да туындайды.

## TDD тапсырмалары

- [ ] `src/core/boardProperties.ts` немесе `treeEditing.ts`: orientation↔H/W/D сәйкестігі және board құру/өзгерту валидациясы. `tests/boardProperties.test.ts` алдымен RED, кейін GREEN; cp мутация.
- [ ] `store/configurator.ts`: board қосу, өңдеу, жылжыту, өшіру, drilling/cutouts өзгерту; undo/redo және v4 round-trip. `tests/boardStore.test.ts` RED→GREEN; cp мутация.
- [ ] `components/BoardProperties.tsx`, `Workspace.tsx`, `TreeDock`/`StructurePanel`: таңдалған board-қа бір Properties панелі; H × W × D, материал, төрт кромка, поза, рөл, текстура бағыты. Барлық UI мәтіні i18n.
- [ ] `components/Configurator.tsx`: cabinet Properties-ті нақты үш PRO100 табына және өзіміздің төртінші өндіріс табына жинау; бұрынғы функциялар сақталсын, өлшемдер General ішінде.
- [ ] `components/DrillEditor.tsx`: board таңдалғанда `BoardSpec.drilling` және cutouts-ты қолмен жазу; cabinet drillEdits жолын сақтау. `tests/boardDrillEditor.test.tsx` не store-level тест.
- [ ] Canonical board-тың cut/nesting/quote/DXF-ке жетуін интеграциялық тестпен бекіту; 3D сол Panel[]-дан оқиды.
- [ ] e2e сценарий script-ын қосу; dev/build/e2e-ні оркестр жүргізеді.
- [ ] Әр маңызды тестке cp мутация; әр коммит алдында `npm test -- --maxWorkers=2` және `npm run typecheck` жасыл; қазақша есеп пен шағын conventional коммиттер.
