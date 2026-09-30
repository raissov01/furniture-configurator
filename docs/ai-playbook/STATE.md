# AisMebel — тексерілген ағымдағы күй

## 2026-09-30 · P01 бастапқы integration аудиті

Нысана: `claude/integration-0928` @ `c0b5448619f977d66e5dd2b6fa0e2c1e09a0a50d`.
Бөлек есеп бұтағы: `codex/p01-audit`. Өнім коды өзгерген жоқ.
Толық дәлелдер: [P01 есебі](reports/P01-integration-audit.md).

**Қорытынды:** параметрлік core, v4 tree, панельдерге негізделген өндірістік
тізбек бар және орындалған сценарийлермен тексерілді. Толық rewrite негізсіз.
Браузердегі end-to-end жарамдылық пен production build әлі расталған жоқ.

| Тексеру | Күйі |
|---|---|
| Нысана branch/SHA | Жергілікті ref, origin ref және `git ls-remote` бір SHA береді |
| `npm test -- --maxWorkers=2` | PASS, exit 0: 3427 passed / 6 skipped; 523 файл passed / 4 skipped |
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` | BLOCKED, exit 1: Turbopack сыртқа шығатын node_modules symlink-ын қабылдамайды |
| `npm run build -- --webpack` | BLOCKED, exit 1: Google Fonts fetch ETIMEDOUT/ENETUNREACH |
| Browser e2e / нақты AI provider | NOT_RUN / NOT_TESTED |

Skip — сыртқы PostgreSQL/restore орталары берілмеген сценарийлер.
Build-ке бола тәуелділік, қаріп немесе конфигурация өзгертілмеді.

**Сақталатын жұмыс істейтін тізбек:** user input → Zustand root/config →
`flattenTree` → `generateCabinet`/`generateHardware` → panels/drilling →
3D адаптері, деталировка, guillotine раскрой, смета және экспорт.
Жарамсыз кірісте соңғы жарамды 3D preview бөлек сақталып, production error
арқылы өндірістік есеп/экспорт бұғатталады. JSON roundtrip ID/геометрияны сақтайды.
Бұл тұжырымдар есептегі unit/integration сценарийлерімен шектелген.

**Расталған мәселе P01-01:** `store/configurator.ts:1499` тек autoJoint бар
жобаға `editShop` history қадамын жасайды. AutoJoint жоқ эталонда frontGap
3→4 мм фасадты 1994→1992 мм өзгертеді, бірақ past=0 қалады; undo қайтармайды.
Қалыпты габарит өзгерісі, бұрғылау және штанга undo/redo сценарийлері өтті.

**Нақты функционалдық шектеу:** жобалық PDF проекциясы бір корпусқа арналған;
қалған панельдер деталировкада. Тек board жобасына assembly PDF жоқ.
CSV/XLSX/DXF көп корпус + board сценарийі тексерілді.

**Дәлелденбеген күмәндер:** toolbar-да deferred panels пен ағымдағы hardware
араласуы; AI preview-де project settings берілмеуі. Бұлар орындалған ақау деп
саналмайды. Браузер таңдауы/drag және нақты AI provider келесіде бөлек тексеріледі.

**Келесі жалғыз тапсырма:** autoJoint жоқ жобадағы `editShop` өндірістік өзгерісін
бір undo/redo қадамына қосу. Ықтимал файлдар: `store/configurator.ts` және
`tests/configuratorIntegration.test.ts` не жеке shop-undo тесті.
Қабылдау: frontGap 3→4, undo→3, redo→4; әр қадамда нақты cut/drilling теңдігі;
save/load; бар autoJoint history регрессиялары. Global shop бағалары, өндірістік
формулалар/константалар, §6 еңбек ақысы, V4 схема және UI өзгермейді.
Түзету осы аудитте басталған жоқ.
