# КП/ТЗ: 27 ішінара тармақты қайта тексеру

28.09.2026. Бастапқы тізім: `.codex-runs/kp-status-0927.md`; осы есептің негізі — `codex/0927-int` үстіне `codex/0924` біріктірілген код және H-08 жұмысы. ✅ — талаптың осы бөлігі іске асты; 🟡 — елеулі бөлігі қалып тұр; ❌ — талаптың өзі орындалмады. Белгі тек код пен аталған тексеріс үшін жарамды, цехтағы сынақ кесуді алмастырмайды. Басқа кезектегі жұмыстарды осы бұтақ өзіне телімейді.

| КП тармағы | Қазір | Дәлел және қалған шек |
|---|:---:|---|
| 4.1.2 Телефон мен планшет | 🟡 | `app/mobile/*` бар; F02/F04/F09-та 390 px экрандағы 3D өрістер қабаттасқан. Толық құрылғы матрицасы тексерілмеді. |
| 4.1.3 Үш тіл | 🟡 | `lib/locales/{kk,uz,en}.ts`, классикалық мәзірде тіл ауыстыру бар; F29 толық мәтін аудиті аяқталмаған. |
| 4.1.6 Бір дерек көзі | 🟡 | `flattenTree` және `Panel[]` негізгі ағын; F15/F18 көп шкаф экспорты мен F09 еркін тақтаның PDF қамтылуы бөлек аудитте. |
| 4.2.4 32 мм присадка | 🟡 | `src/core/drilling.ts`, `src/core/shop.ts`; F06 металл жәшік және 12 цех сұрағы ашық. Цех үлгісінсіз ✅ деуге болмайды. |
| 4.3.1 PRO100 терезе макеті | 🟡 | `components/Workspace.tsx`, `app/globals.css`, `docs/pro100/layout-compare/` және H-08 Chrome кадрлары: мәтіндік көрініс қойындылары, топ бөлгіштері, 12 сол жақ әрекет, fieldset, көк таңдау. Каталог пен reports әлі бөлек. |
| 4.3.3 14 панель | 🟡 | `components/panels/*` ішінде көп панель бар; кейі негізгі Workspace орнына демода ғана. |
| 4.3.4 Еркін редактор | 🟡 | `src/core/tree.ts`, `components/GroupProperties.tsx`, `components/SolidProperties.tsx`, `components/ExactTransformFields.tsx`; қолмен тақта/топ/solid бар. PDF қамтуы мен mirror бөлек кезекте. |
| 4.3.5 Дәл X/Y/Z және бұру | ✅ | `store/configurator.ts:setNodeTransform`, `ExactTransformFields`, күй жолағы; `tests/exactNodeTransform.test.ts` топ пен solid үшін бір қадамдық undo және project roundtrip тексереді. |
| 4.3.6 Туралау, тор, масштабтау | 🟡 | `src/core/treeArrange.ts`, `src/core/snap.ts:snapRotatedEdges`, `tests/rotatedSnap.test.ts`: қисайған жиекке snap бар; жеке scale құралы жоқ. |
| 4.4.1 Материал қасиеттері | ✅ | `Material.pbr` ішінде roughness, metalness, reflection, normal, opacity, sheen, clearcoat, AO; `components/VisualSettingsPanel.tsx:MaterialAppearanceEditor`, `PanelMesh`; `tests/visualPbr.test.ts` v4 сақтауын тексереді. |
| 4.4.6 360° панорама | ✅ | `lib/panorama.ts`, классикалық «Файл → Экспорт» және RenderPanel; `scripts/e2e-h08.mjs` жергілікті Chrome-де PNG жүктеуін, dev-серверде preview суретін тексерді. `docs/guide/screenshots/panorama-preview.png`. |
| 4.4.8 Еркін полигон | 🟡 | `src/core/polygon.ts` өзегі бар; 04-wave4 UI жұмысын күтеді. |
| 4.4.9 3D импорт | 🟡 | `src/core/import/solid.ts` OBJ/GLB өзегі бар; UI 04-wave4, `.3ds` 07 кезегінде. |
| 4.4.10 DXF импорт | 🟡 | `src/core/import/dxf.ts`, `dxfBoard.ts`; редакторға шығару 04-wave4. |
| 4.5.1 Толық присадка | 🟡 | `src/core/drilling.ts`, `components/DrillEditor.tsx`; F05/F06 және цех параметрлері ашық. |
| 4.5.3 Қолмен тесік | 🟡 | `src/core/drillEdits.ts`, `DrillEditor`; F17 теріс енгізу тексерісіндегі шетке тым жақын/қайталанған тесік мәселелері. |
| 4.5.5 Бұрыш/қиғаш төбе | 🟡 | `lib/cornerTransition.ts`, `components/CustomParts.tsx`; F08 өндіріске әсер ететін форма/материал/экспорт ақаулары. |
| 4.5.6 Жәшік жүйелері | 🟡 | `src/core/drawerSystems.ts`; F06 металл жәшік тесігі мен биіктігі бойынша цех аудитін күтеді. |
| 4.5.7 Раскрой мен шпон | 🟡 | `src/core/nesting.ts` гильотина/қалдық; шпонның үздіксіз суреті мен UI 04-wave4. |
| 4.5.11 Цех экспорттары/Базис | 🟡 | `app/cut`, `lib/panelCncExport.ts`, `docs/basis/import.md`; Базис импорты 05-own-catalog, F18 көп корпус/QR түзетуі бөлек. |
| 4.6 Телефон.2 Скан жоспар | 🟡 | Қолмен өлшеу `src/core/measure` → Room бар, камералық жоспар сканы 03g0 кезегінде. |
| 4.6 Телефон.3 QR, присадка, офлайн | 🟡 | `app/mobile/scan`, `app/cut`, service worker бар; F18 QR тұтастығы мен офлайн end-to-end тексерісі керек. |
| 4.6 Қалған.1 Рөлдер | 🟡 | `lib/permissions.ts`; F23 цех read-only UI аудиті ашық. |
| 4.6 Қалған.4 AR/серуен | 🟡 | `lib/ar.ts`, `components/Scene.tsx`; F13 классикалық кіру және E/ортографиялық камера ақауы бөлек түзетуде. |
| 4.6 Қалған.5 Толық аударма | 🟡 | Үш локаль сөздігі бар; F29 толық тексерісін күтеді. |
| 4.6 Қалған.6 Домен/SSL/бэкап | 🟡 | `docker/stack.yml`, `docs/deploy/systemd/aismebel-backup.timer`; нақты прод домені мен күнделікті DB backup іске қосылуы расталмаған. |
| 4.6 Қалған.7 Нұсқаулық/оқыту | 🟡 | `docs/guide/kk.md`, `ru.md` жергілікті Chrome кадрларымен жаңартылды; адамға оқыту өткізілген жоқ. |

Бастапқы есепте 🟡 ретінде берілген 27 тармақтың осы кестеде 27-сі бар. MCP жергілікті сервері (`docs/mcp/README.md`) біріктірілген кодта бар, бірақ сыртқы Claude/ChatGPT коннекторы жоқ; бұл бастапқы есептегі ❌ тармақтардың өзгерісі. Нарық медианасы (`src/core/marketPrices.ts`) бар; цехтың жеке бағасы бөлек қалады. Қаржы есебінің өзегі `src/core/pricing.ts:financeTotals`, жеке қаржы панелі жоқ. Бұл қосымша деректер КП талаптарының толық қабылданғанын білдірмейді.
