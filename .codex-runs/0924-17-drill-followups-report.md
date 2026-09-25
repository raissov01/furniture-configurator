# 17-drill-followups — Базис экспорты және присадка

Негізгі база: `cf32861` (`codex/0924`). `claude/review-shop-drill` мен `claude/drill-followups` онда бар, қайта merge жасалған жоқ. `claude/basis-script` осы тармақта `--no-commit` арқылы біріктіріліп, толық diff ревьюден өтті.

## Нәтиже

- ✅ Базиске присадка CSV арқылы импортталмайтыны ресми дерекпен құжатталған: `docs/basis/drilling-import-route.md`. Basis ZIP ішінде `detali.csv` және `detali.xlsx`, панель мен крепежді әлем координатасында құратын `bazis-import.js` бар; Базиске арналмаған `prisadka.csv` алынды.
- ✅ Кабинеттің жеке `minBandSubtract` баптауы `flattenTree` түйінінде нақты settings ретінде сақталып, скрипттің `ClipPanel` және `canonicalDrill` координатасына өтеді. RED тест 2 мм лента қате шегерілетінін көрсетті; GREEN кейін өтті.
- ✅ Сырттан келген audit файлының `expected` дерегі толық Zod schema-мен тексеріледі. `[null]` панелі parse кезінде ұсталады; CLI шикі `TypeError` traceback шығармай, өріс жолымен validation қатесін береді.
- ✅ Branch ревьюінде `/cut` экспортындағы жоқ `items` айнымалысы табылып, сол production қолданатын `flattenTree(root, catalog, settings, layers)` сахнасымен алмастырылды. Ескі disabled guard та сақталды.
- ✅ 3 286 жолдық сыртқы `index.d.ts.txt` және оның fixture LICENSE файлы merge құрамынан шығарылды. API тексеруі үшін өзіміз жазған қысқа `tests/bazisApiStub.ts` қолданылды; ресми MIT дереккөзі мәтінде көрсетілді.
- ✅ `scripts/e2e-basis-export.mjs` браузер сценарийі ZIP-тегі `.js`, CSV, XLSX, README және `prisadka.csv` жоқтығын тексереді. `node --check` өтті; браузерді тек оркестр жүргізеді.
- ✅ 2: `src/core/constants.ts`-те outer координатасының түсінігі түзетілген; бұрынғы экспорт айналдырмағаны дұрыс сипатталған.
- ✅ 3: `components/ShopDrillingSettings.tsx`-тегі `minifixPairEndOffset` мәтіні оның «от концов» жұбына да, ящик түбінің бекіткішіне де әсерін айтады; `src/core/drilling.ts` екеуін бөлек қолданады.
- ✅ 4: `src/core/drilling.ts` Ø35 чашка мен бекіткіш тесік қиылысын өріс атымен тексереді; `tests/shopDrilling.test.ts`-тегі overlap тесті ұстайды.
- ✅ 5–6: `ShopDrillingSettings.tsx` тереңдіктерге 0.1 мм қадам береді, ал пилот диаметрін reset жасау `press-fit` режимін өзгертпейді; компоненттің тәуелді өріс шарттары қаралды.
- ✅ 7: `tests/shopDrilling.test.ts` 429-жолдан бастап DXF outer пазын, ен өсіндегі ARC бұрышын, press-fit диаметрін және CNC README өсін жеке тексереді.
- ✅ 8: `tests/drillSectionFaces.test.ts` left/right бүйірлердің нақты ішкі бетін және canonical координатасының артқы/алдыңғы бағытын тексереді.
- ✅ 9: `tests/shopDrilling.test.ts`-тің 472-жолдан басталатын тесттері аласа шкафта сыймаған сөре жолағын өріс атымен валидациялайтынын тексереді.
- ✅ 10: `tests/drillSectionFaces.test.ts` барлық seed шаблонда бір панельдегі бірдей тесіктің қайталанбауын және divider-дің сол/оң секция тесіктері екі бетке бөлінетінін тексереді.

## Тексеру

- Бастапқы база: оркестрдің `cf32861` gate-і 194 файл/1 975 тест, typecheck PASS.
- Тапсырма targeted тесттері: basisScript 114/114, basisAudit 9/9, basis/testkit/divider 77/77, flatten/canonicalTreeRows 28/28 өтті.
- Мутация 1: `node.settings` еленбесе 2 мм `ClipPanel` тесті құлады; `cp` арқылы қайтарылды.
- Мутация 2: `canonicalDrill` түйін баптауының орнына глобал баптауды қолданса әлем координатасында 2 мм ауытқу ұсталды; `cp` қайтарылды.
- Мутация 3: audit панелін қайта `z.unknown()` етсе `[null]` тесті құлады; `cp` қайтарылды.
- Толық `npm test -- --maxWorkers=2`: 197 файл/2 110 тест PASS. `npm run typecheck`: біріншіде `exactOptionalPropertyTypes` үйлеспеуін тапты; `BasisScriptNode.settings` типі `FlatNode`-пен үйлестірілген соң PASS.

## Шек және келесі қадам

- ⚠ Нақты Базис runtime-ында JS API-ін іске қосып, қайтқан audit JSON-ды салыстыру цех тестерімен жасалуы тиіс. Fake Bazis тесті API үйлесімін дәлелдемейді. Тестерге нұсқаулық `docs/basis/script-export.md` ішінде.
- ⚠ Оркестр интеграциядан кейін `scripts/e2e-shop-drill.mjs` және `scripts/e2e-basis-export.mjs` браузер сценарийлерін жүргізеді; субагент build/dev/e2e жасамады.
- ❌ Түбірлік ақаулардың түзетілмегені жоқ; нақты Базиспен runtime audit — сыртқы ортаға тәуелді ашық дәлел.

## Коммиттер

- `claude/basis-script` тармағының бес коммиті осы тармаққа merge commit ретінде кіреді; осы тармақтың соңғы SHA-сы оркестрге бөлек хабарланады.
