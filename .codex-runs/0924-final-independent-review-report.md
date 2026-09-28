# 09-24 тәуелсіз код аудиті

**Қамту:** `feat/tree-core..codex/0924` өзгерісінің тәуекелі жоғары сервер маршруттары, олардың рөлдері мен дерек сақтау ағындары; `CLAUDE.md` §0.2/§3 шектеулеріне статикалық тексеріс. Diff 1145 файл, сондықтан барлық жолға толық аудит жасалды деп мәлімделмейді. 2026-09-28, worktree `codex/0924-final-review`.

## Түзетілген нақты ақаулар

- ✅ `app/api/ar/route.ts:33`: аутентификациясыз POST 25 МБ GLB-ні дискке сақтайтын. Ашық телефон сілтемесіне тек `app/api/ar/[id]/route.ts` GET керек. POST енді `editProject` рөлін талап етеді. `tests/arUploadAccess.test.ts`: бастапқыда 200↔401 red, соңында 401/403/200 green; auth guard-ты алып тастаған мутация red.
- ✅ `app/api/ar/[id]/route.ts:18`: 1 сағат мерзімі тек келесі жүктеу кезінде тазаланатын, GET бұрынғы файлды әрі қарай беретін. GET енді ортақ `AR_TTL_MS` шегін тексереді, ескі файлды өшіріп 404 қайтарады; GET пен POST sweep нақты IO қатесін жасырмайды. Бұрынғы `Cache-Control: public, max-age=3600` файлды мерзімінен кейін де кэштен көрсете алатын, сондықтан `no-store` қойылды. Екі сағат ескірткен файл тесті бастапқыда 200, түзетуден кейін 404; `Infinity` мутациясы red.
- ✅ `app/api/share/route.ts:15`, `lib/server/share.ts:31`: аноним сұраныс жарамды жоба үшін әр жолы 2 МБ-қа дейін 24 сағат DB-де сақтайтын, жасау жиілігінің шегі жоқ. `allowAnonymousShareCreate` арқылы сенімді proxy IP-іне 10/сағ, IP белгісіз болса ортақ 3/сағ шегі қосылды. `tests/anonymousShareRate.test.ts`: 11-ші сұраныс бастапқыда 200, соңында 429; 10→11 мутациясы red. Nginx `X-Real-IP`-ді өз IP-імен қайта жазуы керек (`docs/deploy/share-rate-limit.md`).
- ✅ `app/api/v1/jobs/route.ts:27`: `shop` ғана тыйылып, `client` `render`/`xlsx` жұмысын кезекке қоя алатын. Енді осы екі жұмысқа `editProject` қажет. `tests/jobsAccess.test.ts`: бастапқыда client үшін 202, соңында 403; ескі шартты қайтарған мутация red.
- ✅ `scripts/worker.ts:17-25`: render job cookie-сыз `app/api/render/route.ts` POST-ына кіріп, 401 алатын. OpenAI қадамы `lib/server/renderScene.ts`-ке шығарылды; HTTP маршрут auth guard-ын сақтайды, worker цех квотасын тексеріп service-ті тікелей шақырады. `tests/renderWorker.test.ts`: бастапқыда «Нужен вход» red, енді cookie-сыз render және quota reject жасыл.
- ✅ `app/api/share/route.ts`, `app/api/share/[code]/route.ts`, `app/api/ar/route.ts`, `app/api/render/route.ts`: body бұрын түгел жадыға оқылып, содан кейін өлшемі тексерілетін. `readLimitedBody` шек асқанда ағынды тоқтатады; POST/PUT ортақ байт шегін қолданады. Үш маршрут тесті бастапқы red, кейін green; `reader.cancel()` мутациясы үшеуін де red етті.
- ✅ Аноним share лимиті енді body оқылып, JSON парсталмай тұрып тексеріледі; PUT-та аноним автор кілті де body алдында тексеріледі. Екі тест бастапқы red, кейін green; әр guard-ты өшірген мутация жеке red.
- ✅ `app/api/v1/objects/[kind]` POST/GET/DELETE маршруттарында `client` рөлі цех файлын жүктеп, оқып не өшіре алатын. Енді `editProject` құқығы керек; `shop` үшін тек `photo` жүктеу/оқу ерекшелігі сақталды. `tests/objectRoutesAccess.test.ts` бастапқы red, кейін green; үш операцияның guard мутациясы red.

## Ашық қауіптер

- ⚠ `scripts/worker.ts` қате job-ты үш ретке дейін қайта орындайды. OpenAI сәтті аяқталып, нәтижені қоймаға жазу не `completeJob` үзілсе, render қайталап төленуі мүмкін. Job id-ге байланған quota reservation және дайын output key-ді қайта қолдану келесі кезекке қалды. Signed internal HTTP call таңдалмады: ол бөлек құпия кілт, replay қорғауы мен маршрутта auth bypass жолын қажет етеді.

- ⚠ AR upload енді тек кірген `owner`/`designer` үшін өтеді; guest/демо редакторындағы AR батырмасы 401 жауабын пайдаланушыға анық көрсетуі керек. Негізгі интеграция e2e тексеруі қажет.
- ⚠ `app/api/v1/objects/[kind]/route.ts` әр рұқсат етілген өңдеушіге 25 МБ-қа дейін шексіз файл сақтауға мүмкіндік береді. `lib/server/objectStorage.ts` файлды дискке жазады, TTL/сан лимиті жоқ. Жоба/цех сақтауының нақты квотасын өнім шешімі ретінде бекітіп, бөлек енгізу керек.
- ⚠ **Интеграция қақтығысы:** бұл branch-тің `app/api/render/route.ts` өзгерісі базалық маршруттан шыққан. `codex/0924-final-audit`-тің жаңа committed маршрутында `RenderRequestSchema`, reference image, prompt, cost және history ағындары бар. Merge кезінде осы өрістердің бәрін сақтап, тек OpenAI шақыруын ортақ `renderScene` service-ке шығару қажет; worker тек `image`/`hint`/`style` subset-ін қолданады. Осы branch жаңа route-пен әлі merge жасамады, интеграцияда жеке тест пен typecheck қажет.

## Тексеру мен шек

- ✅ `git diff --name-only feat/tree-core..codex/0924`: **1145 файл**, соның ішінде **133 `src/core/` файлы**, **61 API route**. Қазіргі ағашта `app/api` ішінде 63 route (соның 32-сі `/v1` alias/endpoint).
- ✅ `src/core` ішінде React/three/Next импорты және тікелей `: any`/`as any`/`<any>` үлгісі табылмады (`rg '^import .*from .*react|three|next'`, `rg '(:|as|<)\s*any\b'`). Бұл regex статикалық шолу, толық TypeScript dependency graph дәлелі емес.
- ✅ `src/core` catch орындары іріктелді: `share.ts`, `partQr.ts`, `kaspiManual.ts`, `import/solid.ts` қате пішінін нақты validation error-ға айналдырады; `autoJointRebuild.ts` бүлінген joint-ті `broken` күйімен қайтарады; `manufacturerAssets.ts` жарамсыз URL-ды `none` қылады. `briefRules.ts` генерациясы құлаған ұсынысты `continue` арқылы өткізбейді — ол UI-ға жеке себеп бермейді, сондықтан UX ретінде кейін қарау керек. Бүкіл catch тармақтарының семантикасы толық тексерілді деген сөз емес.
- ✅ API іріктемесі: auth/session, role матрицасы, projects, share/approval/comments, AR, AI render/generate/variants, jobs, object storage, library/own-catalog, mobile/installation, team. Іріктеу өзгерген маршруттардың тәуекеліне негізделді; барлық 63 маршруттың барлық тармағы динамикалық орындалмады.
- ✅ `git diff --check` таза; `npm run typecheck` жасыл.
- ✅ Бес нысаналы test file / 29 тест жасыл (`aiAccess`, `rolesRoutes` бірге), кемінде он бір әдейі мутация red; `npm run typecheck` жасыл.
- ✅ Бұрынғы OOM алдын алу тоқтатуларынан кейін 2026-09-28 толық `npm test -- --maxWorkers=2` жасыл: **424 файл/3038 тест passed; 3 файл/5 тест skipped**. Жаңа body тесті әуелі жоспарлы red болып, түзетуден кейін бүкіл жиынтық өтті.
- ⚠ Сервер маршруттарының барлық malformed body тармағы жеке тексерілген жоқ; өндірістік геометрия бұл аудитте жаңадан талданбады.

## Пайдаланушы шешетін сұрақтар

- Worker render retry үшін квота бір job-қа бір рет жұмсалуы тиіс пе? Ұсыныс: job id бойынша бір реттік reservation.
- Цех файл қоймасының сақталу мерзімі және әр цехқа байт/файл саны квотасы қандай болуы тиіс?
