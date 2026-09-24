# 2-фаза: canonical v4 ағашы және Structure UI

## Шешім

`root: GroupNode` — сақталатын жалғыз сахна күйі. Қазіргі кабинет UI-ының
`cabinets`/`placements` сұраныстары тек root-тан есептелетін адаптер болады;
оларды жоба файлына не undo snapshot-іне екінші ақиқат ретінде жазбаймыз.
Орны қабырға арқылы өзгертілген ескі UI әрекеттері түйін transform-ына
аударылады. Production тізбек `flattenTree(root, ..., layers)` арқылы өтеді.
Жасырын түйін/қабат 3D-ден де, цех есебінен де бірдей алынады. Құлып
мутацияны тоқтатады, бірақ цех тізімінен ештеңе алып тастамайды.

PRO100 v7.08 screenshot-ында Structure dialog-ы Project/Selection қойындылары
бар шағын ағаш; корпус пен топ ұялы, checkbox және таңдау бар. Біз бар
`StructurePanel` док мазмұнын өсіреміз, екінші панель қоспаймыз. Properties
нақты screenshot-ына сай `General / Material / Reports` құжатын түзетеміз.

## Міндеттер

- [x] v4 модельге арналған таза tree edit операциялары мен TDD: rename,
  hide/lock, group/ungroup, reparent (cycle/lock қорғанысы), parent-relative
  позаны сақтау, қабат құлпы.
- [x] Store-ды root/layers canonical күйге көшіру; v1–v3/localStorage/cloud
  жүктеу `parseProjectV4`, v4 export. Ескі UI командалары root-ты түзетсін;
  undo/redo бір әрекетке бір snapshot. Migration/equivalence тесттері.
- [x] 3D/cut/pricing/drilling/DXF selector-ларын бір `FlatScene` дерек көзіне
  жалғау; UI деңгейіндегі эквиваленттік тест.
- [x] Бар Structure dock-ты негізгі Workspace-ке жалғап, tree action UI,
  3D selection sync және LayersPanel-ді негізгі UI-ға қосу; e2e сценарийін
  `scripts/e2e-structure-tree.mjs` файлына дайындау.
- [x] PRO100 Properties құжатын нақты 3 tab-қа түзету.
- [x] Толық Vitest (`NODE_OPTIONS=--max-old-space-size=2048 npm test --
  --maxWorkers=2`) және typecheck; маңызды тест мутациясы `cp` restore;
  diff review, шағын қазақша conventional commits, есеп.

## Интеграция шегі

Roles агенті project/share route-теріне auth guard қосады. Осы тармақтағы
parser өзгерісі guard-тарды алмастырмайды; root merge кезінде екі өзгеріс те
сақталады. Root build/dev/e2e орындайды, бұл worktree ол процестерді қоспайды.

## Resume интеграциясы

`8129fdc` UI → `a111fc2` Workspace wiring → `31420fc` main. Канондық
өндіріс пен бос жоба қорғаныстары сақталды. Түпкі интеграция unit163/1775
және typecheck PASS; webpack build PASS. Жеке Structure e2e PASS, бірақ негізгі 22 e2e жабылмады. Браузер дәлелі толқын есебінде
жеке жазылады. Тақта қосу/Properties редакторы 3-фазаға қалады.
