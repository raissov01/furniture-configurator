# 01-shop-drill — интеграция есебі, 2026-09-24

Бұтақ: `codex/0924-shop-drill`; commits: `5fcd529`, `278df7b`, `68729d0`; worktree: `.worktrees/shop-drill`; бастау: `dcae477`.
Merge/push/deploy, build/dev/e2e жасалған жоқ — root интеграцияда орындайды.

## Нәтиже

- 12 цех сұрағы ресми Hettich, Blum, Häfele, BOYARD каталогтарымен салыстырылды: `docs/audit/shop-drilling-standards.md`. Жалпы стандарт табылмаған сан әдепкі seed-де сақталды, цехқа тәуелді деп айқын белгіленді.
- `ShopProfile` v7→v8: сақталған бағалар/каталог/override көшеді. `ConstructionSettings` пен екі Zod схемасына drilling параметрлері қосылды. Оларды Shop Settings → «Присадка» табы, i18n kk/en/uz, түсіндірме мен Reset басқарады.
- Генератор сөре бағаны, конфирмат, минификс, hinge mount, runner тесіктері мен тік ығысуы, аяқ және ящик фасад бұрандасы баптауларын оқиды. Аяқтың 3D hardware орны және тесігі бір setting-пен жылжиды. Толық seed drill нәтижесі бұрынғы baseline SHA256 fixture-мен дәл тең.
- O3: `Panel.drilling` канондық рез координатасында қалады. CNC CSV outer тесіктерді таңдалған `outerFlipAxis` бойынша айналдырады, README осьті жазады. DXF outer drill/groove/milling-ді де айналдырады. Негізгі `OUTLINE`/`CUTOUT` — кесу кадры; `OUTLINE_OUTER_REFERENCE`/`CUTOUT_OUTER_REFERENCE` сыртқы операцияның айна кадры. `face:'outer'` жеке DXF-та контур/ойма түгел айналады. Bevel, cutout, ARC бұрыштары тексерілді. Бір деталь = бір DXF келісімі сақталды.
- Қолданушы e2e сценарийі: `NODE_OPTIONS=--max-old-space-size=2048 node scripts/e2e-shop-drill.mjs http://localhost:3093`. Ол бөлек Chrome profile ашады, `/configurator` бетіне кіреді, shelf front offset-ті 37→50 ауыстырады, localStorage, reload, Reset тексереді; screw cup нақты Ø/depth берілмейінше таңдалмайтынын және depth Reset оны cup-only күйіне қайтаратынын тексереді. Browser-ді өзі жабады. Бұл сценарийді root dev/build аяқталған соң іске қосуы керек.

## 12 цех сұрағы: стандарт / дерек / өріс / default

Толық ресми каталог сілтемелері мен шектері: [`docs/audit/shop-drilling-standards.md`](../docs/audit/shop-drilling-standards.md). ✅ — баптау қолжетімді; ⚠ — нақты артикул не өндірістік guard әлі керек.

| № | Тексерілген дерек | ShopProfile өрісі және default | Күйі |
|---|---|---|---|
| 1 | System 32 қадам 32; бірінші datum жалпы стандарт емес | `settings.shelfPinDatum=32` | ✅ цех таңдайды |
| 2 | Hettich алдыңғы 37; артқы 37/50 жалпы стандарт емес | `shelfPinFrontOffset=37`, `shelfPinBackOffset=37` | ⚠ R3 hinge plate collision guard жоқ |
| 3 | Конфирмат face Ø7/8, зенковка артикулға тәуелді | `confirmatFaceDiameter=8`, `confirmatCountersinkDiameter=0` | ⚠ конус depth/angle жоқ, оң зенковка қате береді |
| 4 | Ұзындықтан pilot depth бірмәнді шықпайды | `confirmatScrewLength=50`, `confirmatEdgeDepth=35` | ✅ екеуі бөлек, артикул қажет |
| 5 | Häfele Ø5 штифт нұсқасы; Ø8 футорка өз тереңдігін талап етеді | `minifixBoltMount=screw-5`, `minifixSleeveDepth=null` | ✅ футорка depth жоқта тоқтайды |
| 6 | Blum INSERTA 45/9.5/Ø8; Blum p160 Ø2.8 — алюминий рама бекіткіші, cup screw емес | `hingeCupMount=cup-only`, `hingeFixingSpacing=45`, `hingeFixingOffset=9.5`, screw pilot Ø/depth `null`, press Ø8/depth `null` | ⚠ screw Ø/depth пен press depth артикулдан міндетті |
| 7 | K=22 әмбебап емес, hinge артикулына тәуелді | **Бұрыннан бар** `ShopProfile.hingeSystems[].cupFromEdge`, Hinges табында editable; seed мәні 22 | ✅ жаңа global K қажет емес |
| 8 | Blum Tandem/Boyard ролик шаблондары әр артикулда бөлек | `runner{Roller,Ball,Tandem}HoleOffsets=[37]/[37,101]/[83,147,211,243]`, vertical offsets 0 | ⚠ R5 roller default бір тесік |
| 9 | Аяқтың 104/100 — бір qdesign үлгісі, стандарт емес | `legCentreFromFront=104` | ✅ аяқ mesh/drill бірге жылжиды |
| 10 | Ящик фасады 80 — бір qdesign үлгісі | `drawerFacadeScrewEndOffset=80` | ✅ тар фасадта legacy clamp бар |
| 11 | Екі минификстің орта/шет орны жалпы стандарт емес | `minifixPairPlacement=center`, `minifixPairSpacing=32`, `minifixPairEndOffset=60` (бұрынғы мән) | ✅ placement таңдалады |
| 12 | Outer аудару осі станок/оператор таңдауы | `outerFlipAxis=length` | ✅ CNC/DXF; CAM reference қабатын растау керек |

**Цех енді толтыратындары:** ⚠ нақты фурнитура артикулдарын таңдап, screw-on hinge pilot Ø мен соқыр depth, INSERTA Ø8 depth, Ø8 футорка depth енгізу; ⚠ roller/ball/Tandem нақты тесіктері мен тік орындарын енгізу; ⚠ shelf datum/алдыңғы-артқы қатар және hinge plate коллизиясын нақты шаблонмен тексеру; ⚠ confirmat face/pilot/зенковка операциясын нақты артикулмен бекіту; ⚠ аяқ, фасад бұрандасы, минификс жұбы және outer flip осін станокта растау.

## Дерек және өндірістік шек

- **R3/B1 толық жабылмады.** Сөре алдыңғы/артқы бағанын баптау бар, бірақ hinge plate-пен коллизияны автоматты анықтайтын production guard жоқ. Default seed бұрынғы 37/37 күйінде, коллизия сақталуы мүмкін.
- **R5/B2 толық жабылмады.** Roller default `[37]` әлі бір тесік. Цех нақты артикул сызбасын беріп, бірнеше offset/тік ығысуды енгізе алады; артикулсыз «дұрыс» pattern бекітілмеді.
- **O7 (направляющая тік орны):** roller/ball/Tandem жүйелерінің тік ығысуы жеке бапталады, default 0 бұрынғы шығысты сақтайды. Әмбебап тік ығысу стандарты табылмаған; нақты артикулдың сызбасын цех енгізуі тиіс, сондықтан физикалық бекіту схемасы толық жабылған жоқ. System 32 сөре қатарына қатысты, O7-ні өздігінен жаппайды.
- **O8:** Blum INSERTA сызбасындағы 45 pitch → ±22.5 және 9.5 offset `roundCoord` (`src/core/drilling.ts:80`) 0.1 мм дәлдігімен сақталады. Screw-on cup пилотының Ø және depth мәніне ресми негіз табылмады: екеуі де `null`, цех енгізбейінше screw режимі ашылмайды. Blum p160 Ø2.8 басқа aluminium-frame bracket-ке тиесілі. `cup-only` бұрынғы default. `press-fit` Ø8 depth нақты артикулдан енгізілуі тиіс, Blum 11.7 — минимум фасад қалыңдығы, drill depth емес. `sleeve-8` depth Ø5×13-тен көшірілмейді. Үш соқыр тесіктің depth-і материал қалыңдығынан аз болуы тиіс. Ø10 зенковканың конус тереңдігі/бұрышы жоқ: `confirmatCountersinkDiameter>0` UI-да қабылданбайды, import арқылы келсе генерация тоқтайды. `confirmatScrewLength` анықтамалық артикул дерегі, pilot depth-ті автоматты өзгертпейді.
- **O9:** минификс жұбы center/end placement-пен орын ауыстырады; default ±16 сақталды.
- **O3 CAM шегі:** `*_OUTER_REFERENCE` қабаттары қайта кесуге арналмаған. Нақты станокта reference қабатын cut operation-нан бөлуін оператор растауы керек. Flat `drillingToCsv` канондық жалпы есеп болып қалды; CNC өндірістік bundle мен DXF ғана машиналық flip қолданады.
- Generated `Panel.drilling` цех өзі енгізген Ø2.8 және бөлшек x/y-ді қабылдайды, CNC/DXF экспорт соларды оқиды. `ProjectFileV4` қолмен жазылған `BoardSpec.drilling`-дегі x/y/diameter-ді бүтін мм деп қабылдайды, `DrillEditor` те бүтін координатаны қолданады; generated және manual шекарасы бөлек. `tests/projectV4.test.ts` Ø2.8/22.5 reject-ті бекітеді. Бұл шектеуді жоймайынша еркін тақтада сондай screw пилотын қолмен сақтауға болмайды.
- **Геометрия guard:** shelf front/back бағаны, runner координаттары, hinge fixing және соқыр тереңдіктер нақты cut panel өлшемі/қалыңдығымен тексеріледі; тыс мән `ConfigValidationError` ішінде setting аты мен координаталық аралық береді. Минификс жұбы/аяқ сыймайтын custom мәндер де қате береді.
- **Минификс boundary fix:** `kitchen-base-drawers-600` + `minifixPairPlacement='ends'`, `minifixPairEndOffset=0` бұрын 60 face hole-ды панель шетінен шығарып, генерацияны тоқтатпайтын. Жаңа pair setting қолданылса wall cam, side bolt, drawer bottom cam/bolt толық Ø радиусымен cut panel ішінде тексеріледі; екі Ø15 cam ұясы қабаттаспауы үшін арасы кемінде 15 мм. `endOffset=0/1/7` және `spacing=0/1/7/8` қате береді; жарамды `endOffset=8/50`, `spacing=15/50` барлық minifix face тесіктерін рез панельде сақтайды. Әдепкі seed өзгерген жоқ.
- ❌ **Legacy coord қарызы:** `wardrobe-mansard-1200` template + әдепкі `ShopProfile.settings` → `side-left` панелінің confirmat face Ø8 центрі x=2408 мм, ал `cutLength=2400` мм (толық Ø үшін рұқсат x=4…2396). Жаңа guard-ты default-ке қолданғанда mansard/overlay mount байланысты 19 ескі тест құлады; дәлел: `0924-shop-drill-followup-full-test.log` (19 FAIL/1584 PASS). Seed exact equivalence үшін физикалық нүкте өзгертілген жоқ; guard тек жаңа Ø override-ына жүреді. Бұдан барлық legacy CNC файлы қауіпсіз деген қорытынды шықпайды. Мансарда/overlay coordinate түпкі себебін бөлек аудиттеп түзету қажет.

## Тексеру

- TDD RED→GREEN: профиль көшуі, seed fixture, drill параметрлері, CNC/DXF mirror, күрделі контур тесттері. DXF бірінші guard әрекеті мансардтың бұрынғы экспортын тоқтатты (алғашқы full suite: 1613 PASS/2 FAIL); екінші әрекетте dual-frame енгізіліп, full suite жасыл болды. Басқа task коды өзгертілмеді.
- cp/restore мутациялары: `shelfPinFrontOffset` default ауысқанда seed fixture құлады; v8 migration өшірілсе migration тесті құлады; mirrored contour түрлендіруі өшірілсе trapezoid test құлады. Сақтау/қалпына келтіру логтары: `0924-shop-drill-seed-mutation.log`, `0924-shop-drill-migration-mutation.log`, `0924-shop-drill-frame-mutation.log`. Бұрынғы guard тест мутациясы да жасалған, бірақ соңғы dual-frame кодына қатысы жоқ.
- Толық `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=2`: **134 файл, 1617 PASS** (commit алдындағы `0924-shop-drill-commit-test.log`). `npm run typecheck` PASS (`0924-shop-drill-commit-typecheck.log`). `git diff --check` және `node --check scripts/e2e-shop-drill.mjs` PASS.
- Кейінгі review түзетуінде screw pilot Ø/depth `null` міндетті етілді, жаңа соқыр тереңдік пен cut-panel координат шектері, leg offset=0 guard-ы қосылды. Үш cp/restore мутация дәлелі: bounds guard өшсе out-of-panel regression RED (`0924-shop-drill-bounds-mutation.log`); blind depth шегі өшсе depth100 regression RED (`0924-shop-drill-blind-depth-mutation.log`); `null` screw Ø орнына ойдан Ø2.8 fallback енгізілсе missing-input regression RED (`0924-shop-drill-nullable-screw-mutation.log`, 1 FAIL/20 PASS). Әр source қалпына келтірілді; кейінгі focused 21/21 GREEN (`0924-shop-drill-nullable-screw-restored.log`), жұмыс бұтағы таза. Соңғы толық тексеру: **134 файл, 1618 PASS** (`0924-shop-drill-followup-final-test.log`); typecheck PASS (`0924-shop-drill-followup-final-typecheck2.log`); e2e script syntax және diff check PASS. Browser e2e әлі root міндетінде.
- Минификс TDD: `minifixPairEndOffset=0` RED (`0924-shop-drill-minifix-red.log`), fix кейін focused 22/22 GREEN. Екі cp/restore мутациясы minifix cut-face bounds және cam overlap guard-тарын бөлек өшіргенде осы regression RED берді (`0924-shop-drill-minifix-bounds-mutation.log`, `0924-shop-drill-minifix-overlap-mutation.log`); қайтарғаннан кейін 22/22 GREEN (`0924-shop-drill-minifix-restored.log`). Соңғы толық suite: **134 файл, 1619 PASS** (`0924-shop-drill-minifix-full-test.log`), typecheck PASS (`0924-shop-drill-minifix-typecheck.log`). Browser e2e әлі root міндетінде.

## Интеграцияға назар

`src/core/types.ts`, `src/core/shop.ts`, `src/core/drilling.ts`, `src/core/export/dxf.ts`, `components/CutPage.tsx`, `components/ShopSettings.tsx`, `lib/locales/{kk,en,uz}.ts` өзгерді. Ортақ `scripts/e2e.mjs`, `store/configurator.ts`, `lib/i18n.ts` өзгерген жоқ. Root merge соңында жаңа e2e сценарийін run жасасын, әсіресе reload және Reset DOM таңдағышын көрсін.

## Root интеграциясы

- ✅ Тәуелсіз roles agent және root ревьюі; source mismatch, cut bounds, minifix overlap findings түзетілді.
- ✅ `1bfc41f` merge → `codex/0924`; kk/en/uz конфликттері екі тармақтың мәтіндерін сақтап шешілді.
- ✅ Интеграцияда 141 файл / 1644 PASS + typecheck (`0924-wave1-merge-shop-test.log`, `0924-wave1-merge-shop-typecheck.log`).
- ⚠ Build/e2e ағаш тармағы біріктірілген соң root-та орындалады.

## Resume интеграциясының браузер дәлелі

- ✅ `31420fc` интеграциясы: 162 файл / 1774 тест PASS; typecheck және webpack build PASS.
- ✅ Осы тапсырманың standalone browser сценарийі PASS (exit 0); қорытынды gate және қалған шектеулер `0924-01-wave1-report.md` ішінде.

- ⚠ Негізгі 22 e2e жиынтығы толық жасыл болмады; толқын толық бітті деп белгіленбейді. Жеке сценарий PASS жалпы regression gate-ін алмастырмайды. Үш әрекет шегі және қалған жұмыс толқын есебінде.

- ✅ Соңғы `7ed6914` кодымен жеке browser сценарийі қайта PASS (exit 0), лог `0924-final-e2e-shop.log`. Барлық іске қосу кезекпен, бір браузермен орындалды.
