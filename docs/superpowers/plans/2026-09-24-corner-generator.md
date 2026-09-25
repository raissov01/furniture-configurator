# Бұрыштық модуль генераторы Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бұрыштық ас үй модулінің дәлелденген геометриясын өндіріс тізбегімен бір деректен шығару және қолдау жоқ артикулдарды айқын тоқтату.

**Architecture:** `CabinetConfig → generateCabinet → Panel[]` келісімі сақталады. Алдымен қолданыстағы тікбұрыш соқыр бұрыш пен трапеция қауіпсіздігі жетілдіріледі; L контуры үшін `Panel`-дің бөлек сыртқы контур метадерегі қажет. Жартылай дайын түр seed-ке немесе wizard-ке тіркелмейді.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js, R3F, Zustand.

**Spec:** `docs/superpowers/specs/2026-09-25-corner-generator.md`.

## Global Constraints

- Өлшемдер H × W × D, бүтін мм; ақша бүтін тиын.
- `src/core` React/three импорттамайды; `Panel[]` жалғыз өндірістік шындық.
- `CLAUDE.md` §4.3 кромка шегерімі; 0.4 мм таспа әдепкіде резден алынбайды.
- Артикулсыз bi-fold hinge тесік координаты мен бағасы ойдан шығарылмайды.
- Жұмыс `codex/0924` worktree-лерінде; push/деплой жоқ. Тест алдымен қызыл, мутация `cp` арқылы қайтарылады.
- Субагенттер Next build/dev/e2e жүргізбейді; root интеграцияда бір сервер/браузермен ғана жүргізеді.

---

### Task 1: Спек пен бастапқы күй

**Files:** `docs/superpowers/specs/2026-09-25-corner-generator.md`, осы жоспар, `.codex-runs/0924-03c-corner-generator-report.md`.

**Interfaces:** Базис атау дерегін геометрия стандарты деп қолданбайды; Blum 60° + 155°/170° ілмек схемасын дереккөзбен бекітеді.

- [x] Міндетті құжаттар, алдыңғы есептер, жұмыс ағашы және Claude бұтақтарын тексеру.
- [x] `codex/0924` үстінде 201 файл / 2128 тест пен typecheck бастапқы күйін алу.
- [x] Бес түрдің параметрі, панель/контур/арт/фасад/присадка/DXF/кромка шегін спекке жазу.
- [x] Спек пен жоспарды diff арқылы ревью жасап, тест/typecheck кейін шағын docs commit жасау.

### Task 2: Төменгі соқыр бұрыштың өндірістік жолы — lower agent

**Files:** `src/core/generateCabinet.ts`, `src/core/kitchen.ts`, `src/core/templatesKitchenExpansion.ts` не бөлек `src/core/templatesCorner.ts`, `tests/frontPanel.test.ts`, `tests/kitchen.test.ts`, `tests/flattenEquivalence.test.ts`, `tests/integration.test.ts` (нақты өзгеріс тестке қарай).

**Interfaces:** Қолданыстағы `CabinetConfig.frontPanel`, `generateCabinet`, `hingeHoles`, `confirmatJoint`, `generateKitchen` қолданылады; жаңа өндірістік тұрақты қосылмайды.

- [ ] Соқыр панель, фасад және корпус тірегінің физикалық орны мен drill координатын дәлелдейтін тест жазу; қазіргі ақауға FAIL көру.
- [ ] Төменгі бұрыштағы филлер мен көрші қатардың орын инвариантын тестілеу; қажет болса түбірлік себеппен түзету.
- [ ] Дәлелденген seed нұсқаларын ғана қосу; әр seed үшін деталировка, DXF, смета, `flattenEquivalence` және drill bounds тесті.
- [ ] Маңызды тесттің мутациясын `cp` арқылы қайтарып тіркеу; `npm test -- --maxWorkers=2`, typecheck жасыл; conventional қазақша commit.

### Task 3: Өтпелі трапеция қауіпсіздігі және үстіңгі модуль іргесі — upper agent

**Files:** `src/core/generateCabinet.ts`, `src/core/drilling.ts`, `src/core/cutList.ts`, `src/core/export/cnc.ts`, `src/core/pricing.ts`, `tests/corner.test.ts`, `tests/drillBounds.test.ts` (нақты өзгеріс тестке қарай).

**Interfaces:** Қолданыстағы `PanelBevel`/`isWidthBevel` және `generateCabinet` қолданылады. `corner.depthAtRight` L деп аталмайды. Нақты hinge SKU жоқ жерде front validation error сақталады.

- [ ] Өтпелі трапецияда drill нақты материал ішінде, DXF контур мен cut list ескертпесі сәйкес екенін тексеретін FAIL тест.
- [ ] Қате confirmat/shelf-pin және CNC bevel белгісінің түбірлік себебін тауып минимал түзету.
- [ ] Қиғаш жиек сметасын есептесе, оны физикалық гипотенуза мен shop edge policy-ге байлап тестілеу; дәлел жоқ жерде өндірістік guard қою.
- [ ] Мутацияны `cp` арқылы қайтару; `npm test -- --maxWorkers=2`, typecheck жасыл; conventional қазақша commit.

### Task 4: L және бес төбелі контурдың ортақ пішіні және қалған түрлер

**Files:** `src/core/types.ts`, `src/core/generateCabinet.ts`, `src/core/export/dxf.ts`, `components/PanelMesh.tsx`, `src/core/pricing.ts`, `src/core/projectV4.ts`, `tests/cornerL.test.ts`, `tests/dxf.test.ts`, `tests/flattenEquivalence.test.ts`.

**Interfaces:** Сыртқы L не бес төбелі контур рез координатасындағы жабық polyline ретінде `Panel`-де сақталады. 3D/DXF/кромка/присадка бір контурды оқиды; `cutouts` бұған пайдаланылмайды.

- [ ] Алдымен сыртқы polyline-ның JSON roundtrip, DXF, 3D көлемі, кромка және бұрғы материал шегі үшін FAIL тесттер.
- [ ] L төменгі және үстіңгі панельдерін сол контурмен шығару; екі қанаттың қабырға бойындағы енін және панель/фасад қиылыспауын тестілеу.
- [ ] Артикул таңдалмаған bi-fold фасадты validation error-мен тоқтату; кейін нақты SKU схемасы болса ғана `hingeHoles`/hardware-ге тіркеу.
- [ ] Алты seed-тің барлық production gate-тері жасыл болғандарын `SEED_TEMPLATES`-ке және kitchen wizard-ке енгізу, қазақша/орысша i18n, browser e2e сценарийі.

### Task 5: Интеграция және есеп — root

**Files:** Осы жоспар, `.codex-runs/0924-03c-corner-generator-report.md`; қажет болса интеграция конфликтілерінің файлдары.

- [ ] Екі agent diff/commit-ін тәуелсіз ревью; толық емес немесе дәлелсіз бөлікті merge жасамау.
- [ ] Root worktree-де барлық қабылданған өзгерісті біріктіріп, `npm test -- --maxWorkers=3` және typecheck.
- [ ] UI өзгерсе `NODE_OPTIONS=--max-old-space-size=2048 npm run build -- --webpack` және e2e; бұрынғы e2e 19/24 baseline-нан нашарламауын тексеру.
- [ ] Есепке ✅/⚠/❌, тест саны, мутация, build/e2e, қалған жұмыс пен өндірістік шешім сұрақтарын жазу.
- [ ] Соңғы diff, test/typecheck; `codex/0924`-ке `git merge --no-ff`; интеграцияда толық тест; worktree-ді remove ету.

## Scope ruling

Task 4 нақты артикулдық присадка мен L контур қозғалтқышын қажет етеді. Бұл кезекте оған өндірістік дәлел жетпесе, Task 2/3-тегі өз алдына тексерілген бөлік қана merge болады. Алты seed пен wizard-ті өтірік «дайын» деп жариялауға болмайды. Қалған әр тармақ есепте келесі кезек ретінде аталады.
