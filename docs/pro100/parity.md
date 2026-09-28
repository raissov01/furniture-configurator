# PRO100 парити-кестесі

> Кодпен қайта тексерілгені: 2026-09-28. Бастапқы дереккөз: PRO100 v7.08x64-тің `PRO100.rus` ресурс DLL-інен
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

69 функция талданды (60 диалог терезесі + Novy Raskroy/Kray сияқты серіктес
құралдар негізінде бөлінген нақты мүмкіндіктер, генерик виджеттер —
`TFRAMEFLOAT`, `TFRAMEBUTTON` секілді — мен таза жүйелік диалогтар —
`TABOUTFORM`, `TGPUFORM`, `TWELCOMEFORM` — есепке кірмеді):

| Күй | Саны | % |
|---|---|---|
| ✅ толық бар | 55 | 79,7% |
| ⚠ ішінара | 10 | 14,5% |
| ❌ жоқ | 4 | 5,8% |
| **Бар + ішінара** | **65** | **94,2%** |

Санақта 69 салыстырылатын жол және 2 N/A жол бар (мәтін жазбасы жеке жолға қосылды). Негізгі UI канондық v4
`root` ағашын сақтайды (`parseProjectV4`, `store/configurator.ts`); бұрынғы
корпус контролдары үшін `cabinets`/`placements` тек туынды адаптер.
Structure/Layers докы Workspace-ке жалғанған: топтау, тарату, атын өзгерту,
жасыру/құлыптау, сүйреп ата-түйінді ауыстыру және undo/redo бар. Еркін тақтаны
қосу, Properties-те өңдеу, кітапханаға сақтау/қою және «Замена» негізгі редакторда.
Find, Price, Dimensions, Info және Import панельдері классикалық Workspace докына қосылған. Import панелі тікбұрышты DXF бөлме жоспарының W/D өлшемін енгізеді; 3DS/OBJ жүктеуі Workspace мәзірі мен батырмасына жалғанған. DXF панель контурының импорты әзірге өзекте ғана.
§2.5-тегі присадканың төрт жолы біздің өнімде бар, бірақ PRO100 жағындағы
қолдауы ресурс жолдарынан біржақты анықталмайды.

### Workspace және PRO100.layout панельдері

PRO100.layout тізімінде Scene-нен бөлек 14 панель бар. Біздің редактордағы нақты қолжетімділік:

| PRO100 панелі | Қазіргі орны/күйі |
|---|---|
| Библиотека, Структура проекта, Замена, Слои | Негізгі Workspace-тағы TreeDock; классикалық режимде Структура қалқымалы терезеде ашылады. |
| Прайс-лист, Найти, Информация, Размеры | Классикалық Workspace-тағы DockHost арқылы ашылады. |
| Текст | Жазба қосу құралы және қасиет редакторы бар; жеке док панелі жоқ. |
| Kray, Свет | RenderPanel ішінде рендер мен жарық баптауы бар; жеке док панелі жоқ. |
| Mesh | Контур көрінісі бар; PRO100 үлгісіндегі жеке Mesh панелі жоқ. |
| Скрыть | Structure ағашында түйінді жасыру бар; жеке док панелі жоқ. |
| Токарный станок | Токарлық профиль мен радиусты иілім `solid.fabrication` арқылы жасалады; бөлек деталировка, баға және иілім DXF бар. |

Import — осы 14 атаудың ішінде жоқ қосымша панель. Ол негізгі Workspace DockHost-ында ашылады және қазір төрт түзу қабырғалы DXF бөлме жоспарын енгізеді.

## 2. Тарау-тарау кесте

Белгілер: ✅ бар · ⚠ ішінара · ❌ жоқ · ➖ N/A (философия басқа,
парити мағынасыз).

### 2.1 Редактор мен нысандар

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Ерікті тіктөртбұрышты тақта, кез келген жерге (`pro100_ru` №3 «Прямоугольник», `TFLATFORM`, `TCUBESFORM`) | ✅ бар | `src/core/tree.ts` `BoardNode`; `components/BoardProperties.tsx` | Еркін тақта UI-дан қосылып, Properties арқылы өңделеді; `Panel[]` өндіріс есебіне түседі. |
| Мәтін/жазба қою (`PRO100.layout`: «Текст») | ✅ бар | `src/core/tree.ts` `AnnotationNode`; `src/core/annotations.ts`; `components/Scene.tsx`; `components/RoomPlan.tsx` | v4 жобамен сақталады, 3D мен бөлме жоспарында көрінеді, өндірістік `Panel[]` мен кесу тізіміне кірмейді. |
| Ерікті полигон/пішін (`TSHAPEEDFORM`) | ❌ жоқ | — | Полигонды өндірістік панель ретінде модельдеу жоқ. |
| Токарлық/иілген деталь (`TEDITLATHEFORM`) | ✅ бар | `src/core/specialParts.ts` `specialPartRows`; `components/SpecialPartProperties.tsx`; `components/Scene.tsx` | Алты дайын токарлық профиль, параметрлік иілім, бөлек деталировка/баға, иілім развёрткасының DXF-і бар. |
| Ұя салу/топтастыру, «группа» (`pro100_ru` №11; `TSTRUCTUREFORM`) | ✅ бар | `components/panels/StructurePanel.tsx`; `src/core/treeEditing.ts` `groupNodes` | Workspace ағашында топтау/тарату, ата-түйінді ауыстыру және бір қадамдық undo бар. |
| Объектіні дәл X/Y/Z + бұрылыспен жылжыту (`TMOVEFORM`/`TROTATEFORM`) | ⚠ ішінара | `components/BoardProperties.tsx`; `src/core/exactMm.ts`; `components/Scene.tsx` | Еркін тақтаның X/Y/Z орны мен H/W/D өлшемі абсолют немесе салыстырмалы +/- мм арқылы енгізіледі; топ пен декордың бөлек Properties орны әлі жоқ. |
| Масштабтау батырмасы (`TSCALEFRAME`) | ✅ бар | `src/core/treeScale.ts` `scaleTreeNode`; `components/panels/StructurePanel.tsx` | Бір нысан/топ біркелкі не X/Y/Z бойынша бүтін мм-ге масштабталады; параметрлік шкафтың H × W × D конфигі өзгереді. Станок координатасы бар тақтаны қауіпсіздік үшін өлшемдеп масштабтау қабылданбайды. |
| Айна көшірме (`pro100_ru` №294 «Зеркало») | ✅ бар | `src/core/mirror.ts` `mirrorCabinet`; `store/configurator.ts` `mirrorCabinet` | Корпус конфигі мен фасад бағыты айналады. |
| Объектілерді туралау (`pro100_ru` №44-47, №161-164, №200-205 «Выровнять по…») | ✅ бар | `src/core/treeArrange.ts` `arrangeTreeSelection`; `components/panels/StructurePanel.tsx` | Көптік таңдауда X/Y/Z бойынша бастау, орта, аяқ және тең тарату батырмалары/хоткейлері бар; бір undo. |
| Тор/привязкамен сүйреу (`pro100_ru` №557 «Сетка») | ⚠ ішінара | `src/core/snap.ts`; `components/Scene.tsx`; `components/panels/StructurePanel.tsx` | Еркін тақтаның 3D сүйреуі тор/бет/жиек/центрге жабысады, тор мен шек UI-да бапталады; 90°-тан тыс бұрылған түйінге және визуал snap сызығына әлі қолдау жоқ. |
| Сызықтық массив | ✅ бар | `src/core/array.ts` `arrayNodes`; `components/panels/StructurePanel.tsx` | Таңдалған түйіннің N көшірмесі X/Y/Z қадамымен жасалады, бір undo. |
| Қабат (слои) басқару, қосу/өшіру/атын өзгерту/түс (`TLAYERSFORM`/`TLAYERSFRAME`, №360-365) | ✅ бар | `components/panels/TreeDock.tsx`; `src/core/layers.ts` `createLayer` | Workspace-та қабат жасау/тағайындау, аты/түсі, көрсету/құлып және сақтау бар. Түйін/ата-топ күйімен бірге есептеледі. |
| Қасиетті көшіру/қою (№300-301 «Копировать»/«Вставить») | ✅ бар | `src/core/treeProperties.ts` `pasteNodeProperties`; `components/panels/StructurePanel.tsx` | Материал, кромка және өлшем топтары бір типтегі бірнеше нысанға бір undo қадамында қойылады. Шкаф кромкасы жеке қасиет емес, жоба баптауы. |
| Іздеу (`TFINDERFORM`, №308 «Найти») | ✅ бар | `components/panels/FindPanel.tsx` `FindPanel`; `components/dock/WorkspaceDock.tsx` | Негізгі Workspace докында панель атауы, материалы не өлшемі бойынша іздейді; нәтижені таңдағанда 3D таңдауы жаңарады. |

### 2.2 Материал мен текстура

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Материал/декор кітапханасы, таңдау терезесі (№99 «Выбрать материал») | ✅ бар | `src/core/decors.ts` `DECOR_LIBRARY`, `searchDecors`; `components/DecorPicker.tsx` `DecorPicker` | Декор таңдау қолданыста. |
| Материал қасиеттері: жылтыр/шағылыс/бедер/жарқыл/AO (`TMATERIALLIGHTPROPFRAME`, №131-136 «свечение, отражение, рельеф, венец, блики, AO») | ⚠ ішінара | `src/core/types.ts` `Material.pbr`; `components/VisualSettingsPanel.tsx` | Roughness, metalness, reflection, normal map және opacity бапталады; жарқыл мен AO жоқ. |
| Текстура бағыты, бұрылмау ережесі | ✅ бар | `src/core/types.ts` `Material.hasGrain`; `src/core/nesting.ts` `nestPanels` | Текстурасы бар панель 90° бұрылмайды. |
| Материалды жобада жаппай ауыстыру (`TTEXTURESUBSTITUTEFORM`) | ✅ бар | `src/core/replaceMaterial.ts` `applyMaterialReplace`; `components/panels/TreeDock.tsx` `ReplacePanel` | «Замена» негізгі редакторда шкаф пен еркін тақта материалын бір undo қадамымен ауыстырады. |
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
| DXF импорты, панель контурын сырттан алу (`TDXFFORM`) | ⚠ ішінара | `src/core/import/dxfBoard.ts` `importDxfBoard`; `components/dock/WorkspaceDock.tsx` | Тікбұрышты панель контуры өзекте оқылады, бірақ Workspace Import панелі қазір тек тікбұрышты бөлме жоспарын енгізеді. |
| DXF экспорты, әр панельге | ✅ бар | `src/core/export/dxf.ts` `cabinetToDxfFiles` | Әр панельге DXF шығарады. |
| 3D модель экспорты OBJ (№55-57 «Экспорт в obj») | ⚠ ішінара | `lib/ar.ts` `sceneToGlb`; `components/ExportMenu.tsx` `ExportMenu` | GLB ішкі AR экспорты бар; пайдаланушыға OBJ жүктеу жоқ. |
| 3D модель импорты, `.3ds`/`.obj` (`import3D.plg`, №114) | ✅ бар | `lib/meshImport.ts` `importedMesh`; `components/Workspace.tsx`; `components/Scene.tsx` | TDSLoader/OBJLoader mesh-ті көрініске қояды; бірлік таңдауы, көлем шегі және жүктелген 3DS текстуралары бар. Декор өндіріс экспортына кірмейді. |
| XLSX деталировка | ✅ бар | `src/core/export/xlsx.ts` `cutListToXlsx` | Деталировка XLSX шығарылады. |
| CSV, сыртқы оптимизаторға | ✅ бар | `src/core/export/csv.ts` `cutListToCsv` | Үшінші тарап оптимизаторына CSV бар. |
| PDF сборка сызбасы + деталировка | ✅ бар | `src/core/export/pdf.ts` `assemblyDrawingPdf` | Жинау сызбасы мен деталировка PDF бар. |
| BXF арқылы PRO100/БАЗИС алмасуы (`import.bxf2.plg`) | ❌ жоқ | [BXF шешімі](../export/bxf.md) | Blum BXF схемасын ашық жарияламайды; БАЗИС-тің құжатталған импортында `.bxf2` қолдау таппайды. БАЗИС скрипті мен CSV/DXF экспорты — бөлек бағыт. |

### 2.7 3D пен рендер

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Негізгі 3D көрініс, зум/бұру | ✅ бар | `components/Scene.tsx` `Scene`, `OrbitControls` | Негізгі 3D сахна жұмыс істейді. |
| Камера preset-тері (№244-250: Перспектива/Аксонометрия/Вид сверху/спереди/справа/сзади/слева — 7 бағыт, соның ішінде ШЫН ортографиялық) | ✅ бар | `components/Workspace.tsx` `VIEW_TABS`; `components/Scene.tsx` `OrthographicCamera` | Перспектива, аксонометрия, жоспар және төрт қабырға көрінісі бар. |
| Жарық көзін қолмен қою/баптау (`TLIGHTSFORM`, `TSPOTLIGHTFRAME`, `TSUNLIGHTFRAME`, №149-156) | ✅ бар | `src/core/visual.ts` `SceneLightSchema`; `components/VisualSettingsPanel.tsx`; `components/Scene.tsx` | Point/spot/sun жобаға сақталады; RenderPanel-де қарқын, түс, орын/бағыт өзгертіледі. |
| Фотореалистік рендер (Kray raytracer + `OpenImageDenoise`, `pro100_list.txt: plugins/export.kray/kray/*`) | ⚠ ішінара | `components/RenderPanel.tsx` `RenderPanel` | ИИ-сурет рендері бар; физикалық Kray ray tracing баламасы емес. |
| Панорама/360° рендер (№51 «Панорама...») | ⚠ браузер тексерісі күтілуде | `lib/panorama.ts`; `components/RenderPanel.tsx` | Алты бөлек 90° WebGL көріністен 2:1 equirectangular PNG жасалады; Chrome e2e оркестрде. |
| Көрсету режимдері: набросок/контур/жартылай мөлдір/фотореализм/сглаживание (№401-407) | ⚠ ішінара | `store/configurator.ts` `viewMode`; `components/Workspace.tsx` `setViewMode` | Тұтас, жартылай мөлдір, контур бар; sketch/фотореал режимі толық жоқ. |
| Жарылған көрініс (№437 «Взрыв») | ✅ бар | `store/configurator.ts` `exploded`; `components/PanelMesh.tsx` `exploded` | Жарылған көрініс слайдері бар. |
| AR, телефон камерасымен бөлмеге қою | ✅ бар | `components/ArButton.tsx` `ArButton`; `lib/ar.ts` `sceneToGlb` | Телефондағы AR үшін GLB жасалады. |
| VR, WebXR (Quest шлемі) | ✅ бар | `components/VrButton.tsx` `VrButton`; `lib/xr.ts` `getXrStore` | WebXR көрінісі бар. |
| Адам силуэті, масштаб үшін | ✅ бар | `src/core/silhouette.ts` `silhouetteSvg`; `components/Scene.tsx` `Silhouette` | Масштаб үшін адам силуэті бар. |

### 2.8 Кітапхана мен шаблондар

| PRO100 функциясы | Бізде | Файл/компонент | Ескерту |
|---|---|---|---|
| Дайын шкаф/модуль шаблондары | ✅ бар | `src/core/templates.ts` `SEED_TEMPLATES`, `templateToCabinet` | Нақты runtime тізімінде 35 параметрлік үлгі. |
| Материал кітапханасы қалталы құрылымда (`pro100_list.txt: PRO100v7.08x64/Библиотека/{Мебель,Материалы}`) | ✅ бар | `components/panels/LibraryPanel.tsx` `LibraryPanel`, `components/panels/PersonalLibraryPanel.tsx` | Демо каталог және жеке санат/іздеу/preview бірге; жеке элемент JSON импорт/экспорты бар. |
| Сборка/топты кітапханаға сақтау (`.meb`, №15 «элемент библиотеки PRO100») | ✅ балама | `src/core/library.ts` `createLibraryItem`, `insertLibraryItem` | PRO100 `.meb` емес: тексерілетін v1 JSON ағаш бұтағы; қоюда ID жаңарып, Panel[] қайта есептеледі. |
| Шебердің өз (аккаунт) кітапханасы | ✅ бар | `app/api/library/route.ts`, `lib/server/library.ts` `listLibraryItems`, `lib/libraryLocal.ts` | Жергілікті көшірме мен аккаунтқа байланған SQLite жазбалары. Vercel cloudOff режимінде API 503. |
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
| Клиент комментарийі, үлгіге тіркелген пікір (PHASE-2 C3) | ✅ кодпен | `lib/server/comments.ts` `addClientComment`; `components/ClientComments.tsx`; `components/CommentsInbox.tsx` | `/view?c=`-те жалпы не нысан пікірін қалдырады; дизайнер жауап береді. Серверсіз ескі `#` сілтемеде пікір сақталмайды. |
| Рөлдер: owner/designer/shop/client (PHASE-2 B3) | ⚠ ішінара | `lib/permissions.ts`; `lib/server/auth.ts`; `components/AccountPanel.tsx` | Серверлік матрица, сақталатын owner/designer/shop рөлі және client share рұқсаты бар. Жазылым/төлем бөлек; shop редактор UI-ының толық read-only қабаты әлі керек. |

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
§2.6-дағы BXF алмасуы **❌** деп белгіленді; БАЗИСке арналған скрипт пен CSV/DXF — одан бөлек мүмкіндік. [Іске асыру шешімі](../export/bxf.md).

## 4. Қалған басым олқылықтар

Маңыздылығы бойынша (цехтың күнделікті жұмысына тигізетін әсеріне қарай):

1. **Күрделі бұрылыстағы сүйреу және snap сызықтары жоқ** (§2.1):
   еркін тақта 90°-қа еселі әлем бұрышында сүйреледі; өзге бұрышта
   бүтін мм AABB-ны үнсіз дөңгелектеуге болмайды.
2. **Материал жарығы мен бедерінің кей қасиеті жоқ** (§2.2):
   PBR редакторы roughness, metalness, reflection, normal map, opacity береді;
   жарқыл мен AO басқаруы әлі жоқ.
3. **DXF панель контуры Workspace Import панеліне жалғанбаған** (§2.6):
   өзек парсері бар, ал Import панелі қазір тікбұрышты бөлме жоспарын енгізеді.
   3DS/OBJ жүктеуі Workspace-тегі «Импорт → 3DS/OBJ» әрекетінде бар.
4. **Шпон өрнегін көрші детальдар арасында сәйкестендіру жоқ** (§2.2, §2.4):
   раскрой дән бағытын сақтайды, бірақ сурет жалғастығын есептемейді.
5. **Рөлдер мен жоба тарихы ішінара** (§2.9): серверлік рұқсат матрицасы
   бар; shop рөлінің жергілікті UI қабаты мен серверлік нұсқа тарихы
   толық емес. `components/HistoryPanel.tsx` локал snapshot көрсетеді.
6. **PRO100-дың барлық 14 панелі жеке қалқымалы терезе емес**:
   Find, Price, Dimensions, Info, Import редактор докында; Structure/Layers/Library/Replace ағаш докында. Мәтін құрал ретінде қосылды. Kray, Mesh, Light, Hide және Lathe-тің PRO100 үлгісіндегі жеке панельдері толық қамтылмаған.
