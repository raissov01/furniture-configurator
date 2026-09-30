# P01 — integration тармағының бастапқы аудиті

Күні: 2026-09-30. Ауқым: веб-редактор және оның өндірістік есептеу тізбегі.

## 1. Нысана және оқшаулау

Аудит нысанасы — `claude/integration-0928`, **`c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d`**.
Бөлек worktree: `/home/midoriya/furniture-configurator/.worktrees/h-19-p01-integration-audit`.
Есеп бұтағы: `codex/p01-audit`; оның бастапқы HEAD-і нысанаға дәл тең.

Бастапқы негізгі ағаштағы командалар:

```text
git branch --show-current
codex/0924
git rev-parse HEAD
fdc31a8a5f1e244926ffc5aac3f4d74e315146b4
git status --short
?? .serena/
```

Бұл ағашқа аудит жасалған жоқ. Ондағы commit жасалмаған файлдарға тимедім.
Тапсырманың арнайы runner ескертпесі бөлек worktree құруды және тек екі есепті
`codex/p01-audit` бұтағында commit/push жасауды рұқсат етеді. Сол нақты ескерту
жалпы пулдың merge/бұтақ ережесінен басым қолданылды: нысанаға `codex/0924`
біріктірілген жоқ. Негізгі және иесінің ағашына checkout/reset/clean/stash,
commit/merge/push жасалған жоқ; deploy жоқ.

Аудит worktree-індегі бастапқы нәтижелер:

```text
git branch --show-current
codex/p01-audit
git rev-parse HEAD
c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d
git status --short
[бос]
git rev-parse origin/claude/integration-0928 claude/integration-0928
c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d
c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d
git ls-remote origin refs/heads/claude/integration-0928 refs/heads/codex/p01-audit
c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d refs/heads/claude/integration-0928
```

Нысана **расталды**, BLOCKED емес. Кейінгі docs commit өнім кодын өзгертпейді;
осы есептегі барлық код жолдары жоғарыдағы бастапқы SHA-ға тиесілі.

## 2. Әдіс және шектеулер

- Толық оқылды: негізгі ағаштағы `.codex-runs/queue/_common.md`, нысанадағы
  `CLAUDE.md`, `package.json`, `README.md`, `vitest.config.ts`.
  Тіркелген файлдар іздеуінде нысанада `AGENTS.md` және ішкі `CLAUDE.md` табылмады;
  пайдаланушы берген AGENTS нұсқауы да қолданылды.
- Архитектураны анықтау үшін `PHASE-2.md`, еркін редактор дизайн құжатының ағаш/
  flatten бөлімдері, `docs/pro100/parity.md`, `docs/pro100/ui-design.md` және
  алдыңғы review/F05/F07/F08 есептерінің қатысты бөліктері қаралды.
  `graphify-out/GRAPH_REPORT.md` нысанада жоқ. Ескі есептердің «өтті» дегендері
  жаңа тексерістің орнына қолданылған жоқ.
- `src/core`, `store`, `lib`, `components`, `app`, `tests` құрылымы мен қатысты
  функциялар зерттелді. Сұралған бес файлдың **бәрі бар**:
  `src/core/generateCabinet.ts`, `src/core/drilling.ts`, `src/core/cutList.ts`,
  `store/configurator.ts`, `lib/usePanels.ts`.
- Өнім коды, тесттер, тәуелділіктер, lockfile және конфигурация өзгертілмеді.
  Қосымша диагностикалық сценарий `/tmp/p01-audit-probe.ts` ішінде орындалды;
  оның бақыланған нәтижелері төменде сақталды. Өнім кодына мутация жасалмады:
  бұл түзету/TDD тапсырмасы емес, тек аудит.
- `node_modules` пайдаланушы нұсқаған салыстырмалы symlink арқылы ортақ орнатылымға
  жалғанды. Орнатылған негізгі нұсқалар manifest-пен сәйкес: Next 16.3.1,
  TypeScript 7.0.2, Vitest 4.1.11, React 19.2.8, three 0.185.1. Таза install
  арқылы lockfile қайталануы тексерілмеді.
- Командаларға кілттер мен сыртқы дерекқор айнымалылары берілмеді (`env -i`).
  `.env`, сертификаттар және signing файлдары оқылған жоқ. Ақылы AI шақырылмады,
  сыртқы қолданба/дерекқорға жазылмады. Рұқсат етілген remote өзгеріс — тек есеп бұтағы.
- Android/iOS, AR, MCP, deploy дамытылмады және аудит тұжырымына кірмейді.
  Толық `npm test` өз script-і бойынша осы бағыттардың кейбір жергілікті тесттерін
  де қамтиды; бұл оларды толық тексерілді дегенді білдірмейді.
- Браузер/3D GPU әрекеті тексерілмеді. Сервер және браузер ашылмады.
  `scripts/e2e.mjs` қаралды: BASE әдепкі localhost, бірақ бар CDP браузеріне
  қосылады, cookie/localStorage тазалайды, аккаунт/бұлтқа жазатын сценарийлері бар.
  Оқшауланған профиль/жергілікті серверсіз іске қосылған жоқ: **NOT_RUN**.
  `playwright.config.ts` жоқ; script — өз CDP қабығы.

## 3. Нақты дерек ағыны

| Кезең | Нақты файл және функция | Байланыс |
|---|---|---|
| Енгізу | `components/Configurator.tsx:1038`, `PropertiesDialog.tsx`; `KitchenWizard.tsx:150` | Өлшемдер `edit`, wizard `loadKitchen/loadFurniture` әрекеттеріне беріледі. Properties-та жеке draft/apply шекарасы бар. |
| State | `store/configurator.ts:877` `edit`; `:508` `legacyEdit`; `store/treeAdapters.ts` | Негізгі дерек — `root`, `layers`, project materials/settings, `autoJoints`. `cabinets/placements` — ағаштан алынатын адаптерлер. |
| Генерация | `src/core/flatten.ts:137` `flattenTree`, `:176` `generateCabinet`, `:177` `generateHardware` | Бірдей config/catalog/settings арқылы панельдер, бұрғылау және жеке фурнитура жасалады; hidden түйін/қабаттар өткізілмейді. |
| Өлшем/кромка | `src/core/edges.ts:191` `calculateCutDimensions`; `generateCabinet.ts:82` | Finished және cut бөлек; кромка шегерімі өзекте. Еркін board та осы ережені қолданады. |
| Присадка | `src/core/drilling.ts:244/332/401/598` | `confirmatJoint`, `shelfPinHoles`, `hingeHoles`, `runnerHoles` панельдің `drilling` тізімін құрады; `generateCabinet.ts:1876` қол түзетулерін қолданады. |
| 3D | `lib/useTreeSceneItems.ts:22`, `lib/treeSceneItems.ts:98`, `Scene.tsx`, `PanelMesh.tsx:695` | `FlatScene` → scene items → finished өлшемді mesh. Жарамсыз state-та толық соңғы жарамды preview сақталады. |
| Өндіріс | `lib/useProjectProduction.ts:10`, `lib/projectProduction.ts:13` | Ағымдағы ағашты қатаң flatten; қатеде бос scene + error. `mergeProjectPanels` жобалық ID-лерді ажыратады; hardware/module widths сол scene-нен. |
| Деталировка | `Workspace.tsx:539`, `CutListTable.tsx:31`, `src/core/cutList.ts:67` | `production.panels` → `formatCutList` → finished/cut бағандары; станокқа cut. |
| Раскрой | `QuoteView.tsx:109`, `CutPage.tsx:158/177`, `src/core/nesting.ts:386` | Сол өндірістік панельдер → `nestPanels`; cutPlan/SVG/DXF downstream. `/cut` state-ті қайта flatten етеді. |
| Смета | `QuoteView.tsx:120`, `src/core/pricing.ts:319` `priceProject` | panels + nesting + shop + hardware + widths + price overrides + manual/special items. Бұранда/ілгек сияқты фурнитураның бір бөлігі `countHardware(panels)` арқылы шығады. |
| Экспорт | `ExportMenu.tsx:33`, `lib/shopExport.ts` `runShopExport`, `src/core/export/*` | CSV/XLSX/DXF/PDF сол панельдердің берілген scope-ын оқиды; cut/drilling бөлек деректер. |
| Сақтау | `store/configurator.ts:1254` `exportProject`, `:1276` `loadProject`; `src/core/projectV4.ts:280` | v4 root/config сақталады; панельдер сақталмайды, қайта жасалады. v1–v3 миграциясы бар. |
| AI | `KitchenWizard.tsx:115` → `app/api/generate/route.ts:56`; `AiPanel.tsx:109/147` | Мәтіннен generator options/brief алынады, өлшемді LLM емес, core жасайды. Offline `ruleVariants` жолы да бар. |

**Бір revision туралы қорытынды.** Нақты бір `Panel[]` instance барлық жерге
ортақ емес: `Workspace.tsx:324–326` белсенді корпус үшін `usePanels`, 3D үшін
`useTreeSceneItems`, өндіріс үшін `useProjectProduction` шақырады. Соңғы екеуі
бір ағаш/catalog/settings/layers/autoJoints кірісін, бір `flattenTree` функциясын
пайдаланады; өндірістік формула UI-де бөлек қайта жазылмаған. README мен
`usePanels.ts`-тегі «жалғыз шақыру орны» түсіндірмесі қазіргі ағаш архитектурасын
толық сипаттамайды. Орындалған адаптер/өндіріс теңдік тесттері сәйкес нәтиже берді;
React кадрларының уақыттық сәйкестігі браузерде өлшенбеді.

**Қате state.** `useTreeSceneItems.ts:14–31` соңғы жарамды preview-ды ұстайды;
`useProjectProduction.ts:18–31` оны есепке көшірмейді. `productionAvailability`
және `Workspace.tsx:446` қате state/draft кезінде деталировка/экспортты жабады.
`QuoteView` `Workspace.tsx:1038` арқылы production error кезінде көрсетілмейді.
`treeSceneItems.test.ts` жарамсыз board материалында preview сақталатынын,
`productionAvailability.test.ts` error және draft бұғаттарын тексереді.
UI-дің барлық басу жолдарына e2e дәлел жоқ; осы шектеу сақталады.

## 4. Функциялар мәртебесі

VERIFIED тек төмендегі орындалған сценарийлерге қатысты, бүкіл функцияның
барлық нұсқасына кепіл емес. PARTIAL — нақты функционалдық шектеу;
NOT_TESTED — код бар, пайдаланушы сценарийі орындалмаған.

| Бағыт | Мәртебе | Орындалған сценарий / нақты шектеу |
|---|---|---|
| Параметрлік корпус | VERIFIED | `snapshot.test.ts`: 2000 (H) × 600 (W) × 450 (D), 4 сөре, 2 фасад → 11 панель / 6 позиция. `carcass.test.ts`: екі құрастыру әдісі, overlay/groove тереңдігі. |
| 3D таңдау және өлшем өзгерту | NOT_TESTED | Браузерде таңдау/drag орындалмады. `treeSceneItems.test.ts` pose/hidden/locked адаптерін тексерді; store resize probe төменде өтті. Бұл WebGL/e2e орнына жүрмейді. |
| Undo/redo | PARTIAL | Өлшем → бұрғылау/штанга → undo/redo қайта қалпына келеді. AutoJoint store тесттері байланыстарды қайтарады. Бірақ autoJoints жоқ жобаның `editShop` өндірістік баптауы тарихқа кірмейді (§6). |
| Материал және кромка | VERIFIED | `edges.test.ts`: 600 мм және екі 2 мм кромка → 596 мм; 0.4 мм шегерілмейді; белгісіз кромка қате. `configuratorV4.test.ts`: импорттың қалыңдығы/баптауы сақталады. |
| Деталировка | VERIFIED | Snapshot cut өлшемдері; `projectProduction.test.ts`: екі корпус + board = 23 панель, 23 бірегей ID; hidden/solid өндірістік тізімге кірмейді. |
| Присадка | VERIFIED | `drilling.test.ts`: face/edge сәйкестігі, 32 мм тор, 37 мм offset, ілгек чашкасы. Probe: биіктік өскенде тесіктер 132 → 138 → undo 132. Нақты станокта кесу тексерілмеді. |
| Раскрой | VERIFIED | `nesting.test.ts`: overlap жоқ, usable bounds, grain, guillotine, kerf/trim, unplaced, детерминизм. Project production тесті legacy/tree нәтижелерін салыстырады. |
| Смета | VERIFIED | `pricing.test.ts`: бүтін тиын, парақ саны, аппарат саны, әр жолдың панельге бөлінуі; `projectProduction.test.ts` tree/legacy сметасын салыстырады. Toolbar transient шектеуі §7-де. |
| Экспорт | PARTIAL | CSV/XLSX/DXF: 23 панель сценарийі нақты writer-лерден өтті; XLSX/ZIP мазмұны ашылып тексеріледі. `freeBoardPdf.test.ts`: cabinet+board PDF 4 бет, cut және drill координаттары бар. PDF тек board-тан тұратын жобаны қолдамайды: `shopExport.ts:89` cabinet талап етеді; project PDF проекциясы бір таңдалған корпусқа, қалғаны supplementary деталировкаға арналған. Браузер download орындалмады. |
| Save/load | VERIFIED | `projectV4Roundtrip.test.ts`: v3→v4→JSON→v4, ID/root/room/layers/settings/info/price overrides тең. Probe: толық қайта жасалған scene JSON тең. AutoJoint roundtrip қол және авто тесіктер байланысын тексереді. |
| AI генерация | NOT_TESTED | Нақты провайдер жауабы/ақылы сұрау орындалмады. `briefRules.test.ts` offline мәтін→3 вариант→`generateCabinet` жолын тексереді; `stageGenerateRoute.test.ts` атауына қарамастан HTTP route емес, sanitizer unit-тесті. `aiAccess.test.ts` OpenAI-ды mock етеді. |

Ізделген бағыттардың ешқайсысын түгел MISSING деуге дәлел жоқ.

## 5. Командалар және орындалған нәтижелер

Барлық тексеру аудит worktree-інде орындалды. Shell ортасының ортақ префиксі:

```sh
env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 NODE_OPTIONS=--max-old-space-size=2048
```

| Нақты команда (ортақ префикстен кейін) | Exit | Нәтиже |
|---|---:|---|
| `npm test -- --maxWorkers=2 > /tmp/p01-audit-test.log 2>&1` | 0 | **PASS**: 523 файл өтті, 4 файл skip; 3427 тест өтті, 6 skip; 316.71 с. Script — `vitest run`. |
| `npm run typecheck > /tmp/p01-audit-typecheck.log 2>&1` | 0 | **PASS**: `tsc --noEmit`, диагностика жоқ. |
| `NEXT_TELEMETRY_DISABLED=1 npm run build > /tmp/p01-audit-build.log 2>&1` | 1 | **BLOCKED (орта)**: Turbopack `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Компиляцияға жетпеді; өнім кодының build қатесі деп көрсетілмейді. |
| `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack > /tmp/p01-audit-build-webpack.log 2>&1` | 1 | **BLOCKED (орта)**: `app/layout.tsx` Google Fonts-тан Golos Text, JetBrains Mono, PT Sans Narrow жүктей алмады (`ETIMEDOUT`/`ENETUNREACH`); `Build failed because of webpack errors`. |
| `npm run test:e2e` | — | **NOT_RUN**: browser/жергілікті сервер оқшаулауы бұл аудитте дайындалмады; автоматты іске қосу бар CDP профилінің дерегін тазалар еді. |

Build командаларында `NEXT_TELEMETRY_DISABLED=1` орта айнымалысы `env -i`-ге
қалған айнымалылармен бірге берілді. Webpack — конфигурацияны өзгерту емес,
бар Next CLI параметрімен бөлек тексеріс; ол әдепкі Turbopack нәтижесін алмастырмайды. Екі build те аяқталмағандықтан production build
жарамдылығы расталған жоқ. Қаріптерді алмастыру/жүктеп енгізу немесе конфигурацияны
өзгерту жасалмады; желісі шектелген таза ортада build сыртқы font fetch-ке тәуелді
екені `app/layout.tsx:2/21/28` арқылы расталады.

Skip себептері: `jobsPlatform`, `postgresMigration`, `postgresPlatform`,
`postgresWorkerStartup` — `DATABASE_URL` берілмеген; `launchBackup` ішіндегі бір
PostgreSQL restore сценарийі — `PG_LAUNCH_SOURCE_URL/PG_LAUNCH_RESTORE_URL` жоқ.
Бұл тесттер FAILED емес және оларды сыртқы дерекқормен іске қосуға тырыспадым.
Тест логындағы әдейі бұзылған JSON туралы stderr жолдары passed negative
сценарийлерге жатады; олар suite failure ретінде саналмады.

Қосымша store probe (`./node_modules/.bin/tsx /tmp/p01-audit-probe.ts`, exit **0**):

| Сценарий | Бастапқы | Өзгерген | Undo / redo |
|---|---|---|---|
| Эталон H: 2000 → 2400 мм | фасад ұзындығы 1994 мм; 132 тесік | 2394 мм; 138 тесік | undo: 1994 / 132; redo: 2394 / 138 |
| `wardrobe-rod-1000`, W: 1000 → 1200 мм | штанга 968 мм, X=500 | 1168 мм, X=600 | undo: 968 мм, X=500 |
| `frontGap`: 3 → 4 мм, autoJoints=[] | фасад 1994 мм; past=0 | фасад 1992 мм; past=0 | undo: **1992 мм болып қалады**, gap=4 |
| Өзгертілген v4 жобаны JSON арқылы қайта ашу | flattenTree нәтижесі | қайта flattenTree | толық scene JSON тең (`true`) |

Алғашқы probe-де жасанды browser stub-та `sessionStorage` жоқ болып,
ескерту шықты; stub толықтырылып, жоғарыдағы таза нәтиже қайта алынды.
Бұл өнімнің browser ақауы деп тіркелген жоқ.

## 6. Дәлелденген интеграциялық мәселе

### P01-01 — автоматты буынсыз жобада өндірістік баптаудың undo қадамы жоқ

**Файл:жол:** `store/configurator.ts:1499` → `:1507`; undo `:2025`.

**Сценарий:** `referenceProject` жүктеу, таза `past/future`, autoJoints=[];
`editShop({settings: {...shop.settings, frontGap: 4}})`, кейін `undo()`.

**Expected:** ағымдағы жобаның өндірістік геометриясын өзгерткен әрекет бір
undo қадамын жасайды. Бір undo effective gap=3 және фасад ұзындығы 1994 мм-ді
қайтарады; redo gap=4 және 1992 мм-ді қалпына келтіреді. Global shop профилінің
өзгерісін жою міндет емес — алдыңғы effective мәндерді project override ретінде
сақтау механизмі кодта autoJoint жобалары үшін бұрыннан бар.

**Actual:** `changesJointInputs && s.autoJoints.length > 0` шарты false;
`past.length` 0 болып қалады, фасад 1992 мм болады; undo ештеңе қайтармайды.
`projectSettings` пен local save жаңа мәнді сақтап үлгереді.

**Әсері:** параметрлік шкафтың фасад/cut геометриясын өзгертетін баптау тарихтан
тыс қалады. Пайдаланушы әдеттегі Ctrl+Z арқылы бұрынғы өндірістік күйге қайта
алмайды. Бұл сценарийде қалыпты габарит undo дұрыс жұмыс істейді, мәселе бүкіл
history жүйесіне жалпыланбайды.

Probe қадамын қайталау үшін store-ға in-memory localStorage/sessionStorage
беріп, `referenceProject` (`tests/fixtures.ts`) жүктеу жеткілікті. Фасадты
`flattenTree(root, catalog, projectSettings ?? shop.settings, layers, autoJoints)`
нәтижесінен өлшеу керек; тек state өрісін қараумен шектелмеу керек.

Бес мәселе санын толтыру үшін дәлелсіз ақаулар қосылған жоқ.

## 7. Болжамдар және әлі тексерілмеген тәуекелдер

1. **Toolbar бағасының аралас revision қаупі.** `Workspace.tsx:557–569` тек
   panels-ті `useDeferredValue` арқылы кешіктіреді; hardware/moduleWidths/catalog/
   shop ағымдағы render-ден келеді. `approvalPrice` осы аралас аргументтерді
   алады. Бұл өтпелі қате баға көрсетуі мүмкін; браузер кадры/сома өлшенбеген,
   сондықтан дәлелденген пайдаланушы ақауына қосылмады. `QuoteView`-дегі
   синхронды есептің тұрақты қате екеніне дәлел жоқ.
2. **AI preview жобалық settings-ті ескермеуі мүмкін.** `AiPanel.tsx:126`
   `generateCabinet(cabinet, catalog)` шақырады, ал негізгі өндіріс project
   settings береді. Әдепкі емес цех параметрлерімен UI preview/apply сәйкестігі
   орындалып тексерілмеді.
3. Бір генераторды бірнеше hook шақыруы өнімділікке ықпал етуі мүмкін.
   Бұл бөлек өндірістік формула бар деген дәлел емес; browser profile алынбады.
4. Қолданыстағы өндіріс константаларының физикалық станок/нақты фурнитурамен
   жарамдылығы осы код аудитімен қайта сертификатталған жоқ. Құжаттағы бұрынғы
   цех сұрақтары жабылды деп есептелмейді; жаңа константа ұсынылмайды.

## 8. Сақтау керек жұмыс істейтін бөліктер

- `generateCabinet`, `edges`, `sections`, `drilling`: finished/cut айырмасын
  сақтайтын және эталон snapshot-пен қорғалған таза TypeScript өзегі.
- V4 tree + `flattenTree` + `projectProduction`: кабинет/еркін board, hidden
  қабат, decorative solid шекарасы және экспорттағы ID ажырату.
- Жарамсыз кірісті production-ға өткізбейтін қатаң hook және жеке preview fallback.
- Guillotine nesting және invariant тесттері; cut жоспар/экспорт тізбегі.
- Панельдерге қадағаланатын бүтін тиын сметасы; CSV/XLSX/DXF/PDF writer-лері.
- V1–V3→V4 миграциясы, толық roundtrip және autoJoint қайта есептеу тесттері.

Толық rewrite ұсынуға негіз жоқ. Расталған мәселе store-дың тар шартында.

## 9. Келесі БІР шағын тапсырма

**Мақсат:** autoJoints жоқ жобада `editShop` арқылы өндірістік settings/material/
edge inputs өзгергенде бір қайтымды project history қадамын сақтау.

**Ықтимал файлдар:** `store/configurator.ts`, `tests/configuratorIntegration.test.ts`
немесе жеке `tests/configuratorShopUndo.test.ts`; бар autoJoint history тесттері
регрессия үшін ғана іске қосылады.

**Қабылдау тесті:** алдымен жоғарыдағы frontGap=3→4 сценарийін қызыл тестпен бекіту.
Одан кейін edit → фасад 1992 мм, бір history қадамы; undo → 1994 мм және бастапқы
cut/drilling; redo → 1992 мм. Save/load effective баптауды сақтасын. Баға ғана
өзгерген global shop әрекеті өндірістік history-ге орынсыз кірмесін. AutoJoint
бар жобаның бұрынғы бір-қадамдық undo/redo тесттері өзгеріссіз өтсін.

**Шекаралар:** global shop бағаларын undo арқылы кері айналдырмау; өндіріс
формулалары мен константаларын, §6 еңбек ақысын, V4 схемасын, UI дизайнын,
генератор/экспорт API-ын өзгертпеу. Тәуелділік қоспау. Осы аудит аясында түзету
басталған жоқ.
