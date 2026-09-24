# PRO100 парити-кестесі

> Кодпен қайта тексерілгені: 2026-09-24. Бастапқы дереккөз: PRO100 v7.08x64-тің `PRO100.rus` ресурс DLL-інен
> алынған 592 интерфейс жолы (`pro100_ru.txt`), 60-тан астам Delphi диалог
> класының аты (`pro100_strings.txt`) және архивтегі 29 953 файл жолы
> (`pro100_list.txt`, соның ішінде `plugins/`, `Библиотека/`, бөлек
> «Novy Raskroy» бағдарламасы). Бұл — PRO100-дың бумасында НЕ БАР екенінің
> тізімі, PRO100-ды іске қосып сынау емес. Сол себепті DLL-де сөздің
> табылмауы PRO100-да функция мүлде жоқ деген дәлел болмайды.
>
> Кестедегі **✅** — біздің кодта осы жолға сәйкес жұмыс істейтін мүмкіндік
> барын білдіреді; әр жолда файл мен нақты символ көрсетілді. **⚠** — өзекте
> немесе демо бетінде бар, бірақ негізгі `Workspace` ағыны толық емес.
> PRO100-мен файл пішімі/UX жағынан толық үйлесімділік жеке тексерілмеген.

## 1. Қысқаша қорытынды

68 функция талданды (60 диалог терезесі + Novy Raskroy/Kray сияқты серіктес
құралдар негізінде бөлінген нақты мүмкіндіктер, генерик виджеттер —
`TFRAMEFLOAT`, `TFRAMEBUTTON` секілді — мен таза жүйелік диалогтар —
`TABOUTFORM`, `TGPUFORM`, `TWELCOMEFORM` — есепке кірмеді):

| Күй | Саны | % |
|---|---|---|
| ✅ толық бар | 39 | 57% |
| ⚠ ішінара | 17 | 25% |
| ❌ жоқ | 12 | 18% |
| **Бар + ішінара** | **56** | **82%** |

Санақта 68 салыстырылатын жол және 2 N/A жол сақталды. Өзек v4 `root`
форматын оқиды (`src/core/projectV4.ts` `parseProjectV4`), ал негізгі UI
әлі v3 `cabinets` + `placements` пайдаланады (`store/configurator.ts`
`exportProject`). Сондықтан еркін тақта/топ функциялары **⚠** күйінде.
Қабат, «Замена/Найти», төрт док панелі және кітапхана негізінен демо
маршруттарда; 3D присадка мен жеті камера көрінісі негізгі `Workspace`-ке
жалғанған. §2.5-тегі присадканың төрт жолы біздің өнімде бар, бірақ PRO100
жағындағы қолдауы ресурс жолдарынан біржақты анықталмайды.

## 2. Тарау-тарау кесте

Белгілер: ✅ бар · ⚠ ішінара · ❌ жоқ · ➖ N/A (философия басқа,
парити мағынасыз).

### 2.1 Редактор мен нысандар

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Ерікті тіктөртбұрышты тақта, кез келген жерге (`pro100_ru` №3 «Прямоугольник», `TFLATFORM`, `TCUBESFORM`) | ⚠ өзекте | `src/core/tree.ts` `BoardNode`; `src/core/flatten.ts` `flattenTree` | Еркін тақта Panel-ге айналады; оны қолмен қосатын Workspace UI әлі жоқ. |
| Ерікті полигон/пішін (`TSHAPEEDFORM`) | ❌ жоқ | — | Полигонды өндірістік панель ретінде модельдеу жоқ. |
| Токарлық/иілген деталь (`TEDITLATHEFORM`) | ❌ жоқ | — | Иілген/токарлық деталь спекке кірмеген. |
| Ұя салу/топтастыру, «группа» (`pro100_ru` №11; `TSTRUCTUREFORM`) | ⚠ өзекте | `src/core/tree.ts` `GroupNode`, `walkTree` | Терең топтау моделі бар, бірақ Workspace v3 cabinets/placements қолданады. |
| Объектіні дәл X/Y/Z + бұрылыспен жылжыту (`TMOVEFORM`/`TROTATEFORM`) | ⚠ ішінара | `src/core/room.ts` `placementPose`; `components/Scene.tsx` `CabinetGroup` | Қабырға/offset/elevation/rotate бар; еркін X/Y/Z сан енгізуі жоқ. |
| Масштабтау батырмасы (`TSCALEFRAME`) | ❌ жоқ | — | Параметрлік өлшем түзету бар, еркін нысанды масштабтау құралы жоқ. |
| Айна көшірме (`pro100_ru` №294 «Зеркало») | ✅ бар | `src/core/mirror.ts` `mirrorCabinet`; `store/configurator.ts` `mirrorCabinet` | Корпус конфигі мен фасад бағыты айналады. |
| Объектілерді туралау (`pro100_ru` №44-47, №161-164, №200-205 «Выровнять по…») | ⚠ өзекте | `src/core/align.ts` `alignBoxes`, `distributeBoxes` | Таза функция мен тест бар; Workspace таңдау/батырмасы әлі қосылмаған. |
| Тор/привязкамен сүйреу (`pro100_ru` №557 «Сетка») | ⚠ ішінара | `src/core/room.ts` `snapOffset`, `DRAG_MAGNET` | Қабырғадағы шкафқа 10 мм қадам/магнит бар; еркін board snap жоқ. |
| Қабат (слои) басқару, қосу/өшіру/атын өзгерту/түс (`TLAYERSFORM`/`TLAYERSFRAME`, №360-365) | ⚠ демода | `src/core/layers.ts` `createLayer`, `setLayerVisible`; `app/layers-demo/page.tsx` `LayersDemoPage` | Схема мен демо панель бар; негізгі Workspace-ке жалғанбаған. |
| Қасиетті көшіру/қою (№300-301 «Копировать»/«Вставить») | ❌ жоқ | — | Нысан қасиеттерін жеке көшіру/қою әрекеті табылмады. |
| Іздеу (`TFINDERFORM`, №308 «Найти») | ⚠ демода | `components/panels/FindPanel.tsx` `FindPanel`; `app/replace-find-demo/page.tsx` `FindPanel` | Жалпы іздеу демо бетінде; негізгі Workspace-те жоқ. |

### 2.2 Материал мен текстура

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Материал/декор кітапханасы, таңдау терезесі (№99 «Выбрать материал») | ✅ бар | `src/core/decors.ts` `DECOR_LIBRARY`, `searchDecors`; `components/DecorPicker.tsx` `DecorPicker` | Декор таңдау қолданыста. |
| Материал қасиеттері: жылтыр/шағылыс/бедер/жарқыл/AO (`TMATERIALLIGHTPROPFRAME`, №131-136 «свечение, отражение, рельеф, венец, блики, AO») | ⚠ ішінара | `src/core/types.ts` `DecorFinish`; `lib/materialLook.ts` `finishToMaterial` | Жылтыр/мат/сатин/тас/металл PBR көрінісі бар; толық жарық/бедер/AO қасиет редакторы жоқ. |
| Текстура бағыты, бұрылмау ережесі | ✅ бар | `src/core/types.ts` `Material.hasGrain`; `src/core/nesting.ts` `nestPanels` | Текстурасы бар панель 90° бұрылмайды. |
| Материалды жобада жаппай ауыстыру (`TTEXTURESUBSTITUTEFORM`) | ⚠ демода | `src/core/replaceMaterial.ts` `applyMaterialReplace`; `components/panels/ReplacePanel.tsx` `ReplacePanel` | Жаппай ауыстыру логикасы мен демо панель бар; Workspace-те жоқ. |
| Шпон/тегіс кескінді сәйкестендіру раскройда (Novy Raskroy `veneer.ini`, `pro100_list.txt: Novy Raskroy v7.45x32/veneer.ini`) | ❌ жоқ | — | Көрші панельдердің текстура суретін жұптау алгоритмі жоқ. |
| Кромка кітапханасы, декорға автобайлау | ✅ бар | `src/core/edges.ts` `resolveEdges`; `src/core/types.ts` `Material.defaultEdging` | Материалдың әдепкі кромка саясаты қолданылады. |
| Материалды клондау (№100 «Клонировать материал») | ✅ бар | `src/core/shop.ts` `cloneMaterial`; `components/ShopSettings.tsx` `MaterialActions` | Цех материалын бөлек id-пен көшіріп, UI-дан қосады. |

### 2.3 Өндірістік есептер

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Деталь тізімі (`pro100_ru` №71-73 «Наименование\|Длина\|Ширина\|Толщина\|Количество\|Материал») | ✅ бар | `src/core/cutList.ts` `CUT_LIST_COLUMNS`, `formatCutList`; `src/core/export/xlsx.ts` `cutListToXlsx` | Деталь өлшемі мен саны экспортталады. |
| Элементтер тізімі, фурнитура (№74-76) | ✅ бар | `src/core/export/hardwareList.ts` `hardwareList` | Фурнитура есебі бар. |
| Материал қажеттілігі есебі (№77-79) | ✅ бар | `src/core/materialUsage.ts` `projectUsage` | Парақ/кромка қажеттілігі есептеледі. |
| Смета/КП, ВСЕГО/К ОПЛАТЕ (№62-71) | ✅ бар | `src/core/pricing.ts` `priceProject`; `src/core/export/quotePdf.ts` `quotePdf` | КП мен смета бар. |
| Скидка/жеңілдік есептеу (№69-71 «СКИДКА», «СКИДКА ВСЕГО») | ✅ бар | `src/core/pricing.ts` `discountAmount`; `components/QuoteView.tsx` `DiscountInput` | Жолдық және жалпы пайыз/тиын жеңілдігі; ВСЕГО/СКИДКА/К ОПЛАТЕ көрсетіледі. |

### 2.4 Раскрой

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Гильотинді раскрой (`Novy Raskroy` бөлек бумасы, `pro100_list.txt: Novy Raskroy v7.45x32/rozkroj.exe`) | ✅ бар | `src/core/nesting.ts` `nestPanels` | Гильотинді бөлулер қолданылады. |
| Kerf/trimEdge/grain ескеру | ✅ бар | `src/core/constants.ts` `KERF`; `src/core/nesting.ts` `nestPanels` | Kerf, trimEdge, hasGrain ескеріледі. |
| Рез тізбегі, станоктың жұмыс жоспары | ✅ бар | `src/core/cutPlan.ts` `cutPlan`, `sheetCutPlan` | Ішкі рез реті есептеледі; PRO100 форматына сәйкестік тексерілмеген. |
| SVG/PDF раскрой картасы | ✅ бар | `src/core/export/nestingPdf.ts` `nestingPdf`; `components/CutPage.tsx` `CutPage` | Раскрой картасы бар. |
| Шпон/рисунок сәйкестендіру (§2.2-мен қайталанады, `veneer.ini`) | ❌ жоқ | — | §2.2-дегі текстура жұптау мәселесімен бірдей. |
| Бірнеше орналастыру стратегиясын қатар жүргізіп ең жақсысын таңдау | ✅ бар | `src/core/nesting.ts` `OptimizationLevel`, `nestPanels` | fast/standard/deep стратегиялары бар. |

### 2.5 Присадка

> Бұл тараудағы төрт жол өз өніміміздегі мүмкіндіктерді сипаттайды.
> Қолдағы 592 интерфейс жолында «сверл», «присадк», «конфирмат»,
> «шкант», «минификс», «евровинт», «чпу», «станок» сөздері табылмады.
> Плагиндер тізімінде `import.bxf2.plg` бар, бірақ осы деректер PRO100-дың
> присадканы өзі есептей ме, әлде басқа бағдарламаға бере ме дегенді
> анықтамайды. Оны жұмыс істейтін PRO100-да бөлек тексеру керек.

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| 32 мм жүйе бойынша авто-присадка (конфирмат/шкант/минификс/ілгек/направляюща) | ✅ бар | `src/core/drilling.ts` `confirmatJoint`, `shelfPinHoles`, `hingeHoles` | Өзіміздегі мүмкіндік; PRO100 қолдауы бұл деректермен анықталмаған. |
| Присадканы қолмен түзету | ✅ бар | `src/core/drillEdits.ts` `addDrill`, `removeDrill`; `components/DrillEditor.tsx` `DrillEditor` | Қолмен өзгеріс 3D көрініс пен экспортқа беріледі. |
| Ілгек/направляюща брендіне қарай координата профилі | ✅ бар | `src/core/fittings.ts` `defaultHingeSystems`; `src/core/drawerSystems.ts` `DRAWER_SYSTEMS`, `holeOffsets` | Бренд/жүйе профильдері дерек ретінде бар. |
| ЧПУ экспорты, әр деталь бір файл | ✅ бар | `src/core/export/cnc.ts` `cncFiles`; `src/core/export/dxf.ts` `cabinetToDxfFiles` | Әр детальға файл бар; PRO100 бойынша салыстыру шектеулі. |

✅ функцияның кодта болуын ғана білдіреді. `docs/audit/drilling-fix-plan.md`-тегі
12 цех сұрағы мен оларға тәуелді R3/R5/O3/O7/O8/O9 әлі ашық; бұл кесте
присадканың өндірістік жарамдылығын растамайды.

### 2.6 Экспорт

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| DXF импорты, панель контурын сырттан алу (`TDXFFORM`) | ❌ жоқ | `src/core/import/dxf.ts` `importDxfRoomPlan` | DXF 2D бөлме жоспары демода оқылады, панель контуры импортталмайды. |
| DXF экспорты, әр панельге | ✅ бар | `src/core/export/dxf.ts` `cabinetToDxfFiles` | Әр панельге DXF шығарады. |
| 3D модель экспорты OBJ (№55-57 «Экспорт в obj») | ⚠ ішінара | `lib/ar.ts` `sceneToGlb`; `components/ExportMenu.tsx` `ExportMenu` | GLB ішкі AR экспорты бар; пайдаланушыға OBJ жүктеу жоқ. |
| 3D модель импорты, `.3ds`/`.obj` (`import3D.plg`, №114) | ❌ жоқ | — | OBJ/3DS модельді сахнаға импорттау жоқ. |
| XLSX деталировка | ✅ бар | `src/core/export/xlsx.ts` `cutListToXlsx` | Деталировка XLSX шығарылады. |
| CSV, сыртқы оптимизаторға | ✅ бар | `src/core/export/csv.ts` `cutListToCsv` | Үшінші тарап оптимизаторына CSV бар. |
| PDF сборка сызбасы + деталировка | ✅ бар | `src/core/export/pdf.ts` `assemblyDrawingPdf` | Жинау сызбасы мен деталировка PDF бар. |
| Базиске экспорт/импорт көпірі (`import.bxf2.plg`) | ⚠ ішінара | `src/core/export/basis.ts` `basisFiles`, `basisPartsCsv` | Базиске CSV/DXF экспорт бар; осы жобада BXF2 import не екі бағытты көпір жоқ. |

### 2.7 3D пен рендер

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Негізгі 3D көрініс, зум/бұру | ✅ бар | `components/Scene.tsx` `Scene`, `OrbitControls` | Негізгі 3D сахна жұмыс істейді. |
| Камера preset-тері (№244-250: Перспектива/Аксонометрия/Вид сверху/спереди/справа/сзади/слева — 7 бағыт, соның ішінде ШЫН ортографиялық) | ✅ бар | `components/Workspace.tsx` `VIEW_TABS`; `components/Scene.tsx` `OrthographicCamera` | Перспектива, аксонометрия, жоспар және төрт қабырға көрінісі бар. |
| Жарық көзін қолмен қою/баптау (`TLIGHTSFORM`, `TSPOTLIGHTFRAME`, `TSUNLIGHTFRAME`, №149-156) | ❌ жоқ | — | Жарықты пайдаланушы қоятын/баптайтын UI жоқ. |
| Фотореалистік рендер (Kray raytracer + `OpenImageDenoise`, `pro100_list.txt: plugins/export.kray/kray/*`) | ⚠ ішінара | `components/RenderPanel.tsx` `RenderPanel` | ИИ-сурет рендері бар; физикалық Kray ray tracing баламасы емес. |
| Панорама/360° рендер (№51 «Панорама...») | ❌ жоқ | — | 360° панорама шығаруы табылмады. |
| Көрсету режимдері: набросок/контур/жартылай мөлдір/фотореализм/сглаживание (№401-407) | ⚠ ішінара | `store/configurator.ts` `viewMode`; `components/Workspace.tsx` `setViewMode` | Тұтас, жартылай мөлдір, контур бар; sketch/фотореал режимі толық жоқ. |
| Жарылған көрініс (№437 «Взрыв») | ✅ бар | `store/configurator.ts` `exploded`; `components/PanelMesh.tsx` `exploded` | Жарылған көрініс слайдері бар. |
| AR, телефон камерасымен бөлмеге қою | ✅ бар | `components/ArButton.tsx` `ArButton`; `lib/ar.ts` `sceneToGlb` | Телефондағы AR үшін GLB жасалады. |
| VR, WebXR (Quest шлемі) | ✅ бар | `components/VrButton.tsx` `VrButton`; `lib/xr.ts` `getXrStore` | WebXR көрінісі бар. |
| Адам силуэті, масштаб үшін | ✅ бар | `src/core/silhouette.ts` `silhouetteSvg`; `components/Scene.tsx` `Silhouette` | Масштаб үшін адам силуэті бар. |

### 2.8 Кітапхана мен шаблондар

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Дайын шкаф/модуль шаблондары | ✅ бар | `src/core/templates.ts` `SEED_TEMPLATES`, `templateToCabinet` | Нақты runtime тізімінде 35 параметрлік үлгі. |
| Материал кітапханасы қалталы құрылымда (`pro100_list.txt: PRO100v7.08x64/Библиотека/{Мебель,Материалы}`) | ⚠ ішінара | `components/panels/libraryCatalogLogic.ts` `LIBRARY_TABS`; `components/panels/LibraryPanel.tsx` `LibraryPanel` | Мебель/Элементы/Материалы санаты демода бар; Workspace кітапханасы емес. |
| Сборка/топты кітапханаға сақтау (`.meb`, №15 «элемент библиотеки PRO100») | ❌ жоқ | — | Топты пайдаланушы кітапханасына сақтайтын API/UI жоқ. |
| Шебердің өз (аккаунт) кітапханасы | ⚠ ішінара | `components/AccountPanel.tsx` `AccountPanel`; `components/panels/LibraryPanel.tsx` `LibraryPanel` | Аккаунт жобаларды сақтайды, бірақ жеке топ/элемент кітапханасы жоқ. |
| Бірнеше прайс-парақ арасында ауысу (`TPRICESFORM`/`TSELECTPRICESFORM`, №49 «Отчёты PRO100») | ✅ бар | `src/core/priceLists.ts` `switchPriceList`, `createPriceList`; `components/ShopSettings.tsx` `PriceListManager` | ShopProfile v7 бірнеше атаулы прайсты сақтап, ауыстырады. |
| Дайын жиынтықтар (наборы: бұрыш, ас үй қатары) | ✅ бар | `src/core/sets.ts` `SEED_SETS`, `setToProject` | Жиынтықтар бар. |
| PRO100 номенклатурасын импорттау құралы | ✅ бар | `scripts/importPro100.mjs` `main`; `src/core/data/pro100Catalog.ts` `PRO100_LIBRARY` | Локал CLI архивтен атау/қалтаны импорттайды; дайын каталог демо панельде көрінеді. |

### 2.9 Жоба мен клиент

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Жобаны сақтау, нұсқа тарихы | ⚠ ішінара | `components/HistoryPanel.tsx` `HistoryPanel`; `lib/server/store.ts` `writeProject` | Локал snapshot тарихы бар; серверлік версия/diff жоқ. |
| Жоба метаданные: клиент/дизайнер/тапсырыс №/күні/ескерту (`TPROJECTINFOFORM`, №143-148 «Заказ, Дата, Клиент, Дизайнер, Примечание», №498-503) | ✅ бар | `src/core/types.ts` `ProjectInfo`; `src/core/schema.ts` `ProjectInfoSchema`; `components/ProjectPanel.tsx` `INFO_FIELDS` | Заказ/Дата/Клиент/Дизайнер/Примечание сақталып, PDF/КП-ға шығады. |
| Клиентке серверсіз URL-сілтеме арқылы бөлісу | ✅ бар | `src/core/share.ts` `shareLink`, `encodeProject` | Серверсіз URL токені бар. |
| Клиентке 6-таңбалы код арқылы ашу, прогулкамен | ✅ бар | `components/ShareCodeDialog.tsx` `ShareCodeDialog`; `components/CodeEntryPage.tsx` `CodeEntryPage` | Алты таңбалы кодпен қарау бар. |
| Клиент комментарийі, үлгіге тіркелген пікір (PHASE-2 C3) | ❌ жоқ | — | Клиент пікірін үлгіге тіркеу жоқ. |
| Рөлдер: owner/designer/shop/client (PHASE-2 B3) | ⚠ ішінара | `lib/server/auth.ts` `Account`; `components/AccountPanel.tsx` `AccountPanel` | Цех мүшесі/иесі бар, бірақ designer/shop/client рөлдік рұқсат жүйесі жоқ. |

### 2.10 Баптау

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Цех/бизнес профилі: материал/баға/зазор/фурнитура бір жерден | ✅ бар | `src/core/shop.ts` `ShopProfile`, `defaultShopProfile`; `components/ShopSettings.tsx` `ShopSettings` | Цех профилі бар. |
| Тіл ауыстыру | ✅ бар | `lib/i18n.ts` `LANGS`, `setLang`; `components/LangSwitch.tsx` `LangSwitch` | kk/ru/uz/en тілдері бар; PRO100 тілдерінің толық тізімі тексерілмеген. |
| Өлшем бірлігі баптауы (`TUNITSFRAME`) | ➖ N/A | — | Жоба CLAUDE.md §0.2 бойынша тек мм қолданады. |
| Экран/тема/сапа баптауы (№474-478 «Экран, Шрифт, Печать») | ✅ бар | `lib/appearance.ts` `applyTheme`, `canvasSettings`; `components/AppearanceSwitch.tsx` `AppearanceSwitch` | Тема мен 3D сапасы бапталады. |
| Файл/қалта орналасуы баптауы (№213-219 «шаблоны\проекты» т.б.) | ➖ N/A | — | Браузерде PRO100 тәрізді файл жолын қолмен баптау қолданылмайды. |

## 3. Біздің расталған мүмкіндіктер және салыстыру шегі

Біздің кодта параметрлік корпус генерациясы (`src/core/generateCabinet.ts`),
32 мм жүйесі бойынша присадка (`src/core/drilling.ts`), детальға жеке CNC/DXF
экспорты (`src/core/export/cnc.ts`, `src/core/export/dxf.ts`), AR мен WebXR
(`components/ArButton.tsx`, `components/VrButton.tsx`), URL не алты таңбалы
кодпен бөлісу (`src/core/share.ts`, `components/ShareCodeDialog.tsx`),
бөлмеде жүріп көру (`components/TouchJoystick.tsx`), тапсырмадан нұсқа ұсыну
(`src/core/brief.ts`, `src/core/briefRules.ts`) және сыймаған детальға кеңес
(`src/core/cutAdvice.ts`) бар. Бұлар нақты кодпен расталған. Бірақ DLL
мәтінінде атауы кездеспегені PRO100-да осы мүмкіндіктердің жоқ екенін
дәлелдемейді; салыстырмалы артықшылықты айту үшін PRO100-дың өзін іске
қосып тексеру қажет.

`src/core/export/basis.ts` Базиске CSV/DXF файлдарын дайындайды.
`PRO100v7.08x64/plugins/import.bxf2.plg` атауы PRO100 бумасында BXF2
импорт плагині барын ғана көрсетеді: оның бағытын, қолдайтын мәліметін
және біздің CSV/DXF-пен үйлесімін осы тізімнен білу мүмкін емес. Сондықтан
§2.6-дағы «көпір» тек өз жағымыздағы экспорт ретінде **⚠** белгіленді.

## 4. Ең маңызды 10 олқылық

Маңыздылығы бойынша (цехтың күнделікті жұмысына тигізетін әсеріне қарай):

1. **Еркін тақта мен топтың негізгі редакторда болмауы** (§2.1):
   `src/core/tree.ts` пен `src/core/flatten.ts` модельді іске асырады,
   бірақ `components/Workspace.tsx` әлі v3 шкаф/орналасу ағынын қолданады.
2. **Топты пайдаланушы кітапханасына сақтау жоқ** (§2.8): `GroupNode`
   моделінен `.meb` тәрізді жеке элемент кітапханасына сақтау жолы жоқ.
3. **Туралау/тарату және еркін тақтаға snap UI жоқ** (§2.1):
   `src/core/align.ts` функциялары бар; `src/core/room.ts` snap-і тек
   қабырғадағы шкафтың орнын түзетеді.
4. **Қабат, материалды жаппай ауыстыру және іздеу демо беттермен шектеледі**
   (§2.1–2.2): `app/layers-demo/page.tsx` пен
   `app/replace-find-demo/page.tsx` негізгі редакторға жалғанбаған.
5. **Материал жарығы мен бедерін толық баптау жоқ** (§2.2):
   `lib/materialLook.ts` дайын PBR көріністерін береді, бірақ жарық, бедер,
   AO қасиеттерінің толық редакторы жоқ.
6. **Жарық көзін пайдаланушы қоятын құрал жоқ** (§2.7): негізгі сахнадағы
   жарықты бөлек орналастыру/баптау UI-ы жоқ.
7. **DXF панель контурын, OBJ/3DS моделін импорттау жоқ** (§2.6):
   `src/core/import/dxf.ts` бөлменің 2D жоспарын оқиды, панельді емес.
8. **Шпон өрнегін көрші детальдар арасында сәйкестендіру жоқ** (§2.2, §2.4):
   раскрой дән бағытын сақтайды, бірақ сурет жалғастығын есептемейді.
9. **Рөлдер мен жоба тарихы ішінара** (§2.9): `lib/server/auth.ts`
   аккаунт мүшелігін қолдайды, `components/HistoryPanel.tsx` локал
   snapshot көрсетеді; designer/shop/client рұқсаттары және серверлік
   нұсқа тарихы жоқ.
10. **Дизайнерге арналған док панельдері редакторға жалғанбаған**:
    Structure/Price/Dimensions/Info `app/panels-demo/page.tsx` ішінде бар,
    `components/Workspace.tsx` ішінде жоқ.
