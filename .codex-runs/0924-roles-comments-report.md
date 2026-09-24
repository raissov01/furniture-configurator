# 2026-09-24 — `07-roles-comments` есебі

## Нәтиже

- ✅ `owner / designer / shop / client` таза permission matrix (`lib/permissions.ts`). Бар SQLite базасында founder → owner, қалған бұрынғы мүше → designer; жаңа шақыру `designer` не `shop` рөлін сақтайды. Тек owner шақырады, рөл ауыстырады, команда мен цех профилін басқарады. Designer жобаға жазады және ішкі бағаны оқиды; shop жобаны тек оқиды, API жауабы баға түзетулерінен және сатып алу бағасынан тазаланады; client тек share арқылы кіреді.
- ✅ AccountPanel owner ғана профильді серверге сақтайды; designer бар профильді тек оқиды, shop мүлде сұрамайды. Сервердегі бүлінген профиль енді үнсіз local нұсқамен қайта жазылмайды, қате көрсетіледі; initial GET бітпей autosync PUT кетпейді.
- ✅ Бұрынғы командалық e2e қабілеті қайтарылды: designer/shop өз цехының member тізімін және limit-ті оқиды, өз жолында «Уйти» бар; invitation token тізімі тек owner-ге шығады. Шақыру, бөтен мүшені шығару және рөл ауыстыру owner-only қалды.
- ✅ `/api/projects`, `/api/projects/[id]`, `/api/shop`, `/api/team`, `/api/team/member`, `/api/share` және comment route-тарында серверлік guard бар. Рөл UI-дан келген сөзге емес, session cookie арқылы дерекқордан оқылады.
- ✅ Клиентке арналған hash және код payload-ында material/edge/slab бағасы 0 не алынып тасталады, `coefficient`, line discounts, client `info` алынады; қолмен келісілген `salePrice` ғана қалады. Клиент бетінде өлшем кестесі жоқ; материал, 3D және осы қол бағасы көрсетіледі. Cloud қосулы «Ссылка клиенту» 24 сағаттық `/view?c=...` жасайды; `/c` арқылы код енгізу де жұмыс істейді. Cloud off болса бұрынғы серверсіз hash сілтеме қалады.
- ✅ Қосымша Viewer leak түзетілді: client 3D-де `DimensionLabels` өшіріледі, редактордың қалыпты өлшем toggle-ы сақталады. Unit тест саясатты тексереді; e2e редактордағы үш label барын және client бетінде жоқтығын тексереді.
- ✅ `/view?c=` клиенті жалпы жобаға не cabinet/node ID-іне пікір жазады; автор аты, мәтін және target server boundary-де шектеледі. Designer/owner AccountPanel ішінен оқиды және жауап береді; аноним код жасаушы қолындағы жаңарту кілтімен ShareCodeDialog ішінде оқып жауап бере алады. `authorRole` серверде сақталады, клиент өзін «designer» деп атай алмайды. ClientComments әр 5 секунд сайын жауапты жаңартады, желі қатесін көрсетеді.
- ✅ Пікір жазылған share мерзімі аяқталғанда база тазалауы оны өшірмейді: клиенттің коды 24 сағаттан соң жабылады, бірақ shop inbox-та архиві қалады; designer ескі пікірге жауап бере алады. Жаңа кодта ескі пікір автоматты көрінбейді.
- ✅ Жаңа route-тардың malformed JSON, бос/үлкен мәтін, жалған target/authorRole, role deny және бөтен цех сценарийлері 4xx береді; response-та traceback/path жоқ. Team invite POST-та бұрын `"{"` malformed body 200 болып қабылданатын; RED→GREEN түзетілді.

## Тексеру

- Бастапқы root база: 133 файл / 1597 PASS, typecheck PASS (`dcae477`, root мәліметі).
- Осы branch соңғы толық: 139 файл / 1613 PASS; `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=2`. Typecheck PASS. `node --check scripts/e2e-roles-comments.mjs` PASS. Логтар `.codex-runs/0924-roles-comments-test.log` және `...-typecheck.log`.
- Мутациялар, әрқайсысы `cp`-пен қайтарылды: material price leak → 2 FAIL; shop `editProject` рұқсаты → 2 FAIL; client persisted `author_role` жалған designer → 1 FAIL. Бұлардың кейінгі targeted тесттері жасыл.
- Follow-up `readTeam` мутациясы designer grant-ін алып тастағанда matrix + route тестінде 2 FAIL берді; `cp`-пен қалпына келтіріліп, targeted 2 файл / 6 PASS.
- ⚠ Build/dev/e2e осы worktree-де жүргізілген жоқ: root интеграция кезінде бір ғана сервер/браузермен жүргізеді. Жеке сценарий: `node scripts/e2e-roles-comments.mjs http://localhost:<порт>`; ол Chrome-ды 9444 CDP портында оқшау profile-мен ашады, UI-да client comment және designer reply-ді тексереді, соңында өзі өшіреді.

## Интеграция және шекара

- ⚠ `02-phase2-structure-tree` agent v4 canonical parser/store-ға көшіреді. Ортақ merge файлдары: `app/api/projects/route.ts`, `app/api/share/route.ts`, `app/api/share/[code]/route.ts`, `components/AccountPanel.tsx`, `components/ViewerPage.tsx`, `src/core/share.ts`. Root екі жақтың өзгерісін сақтауы қажет: осы branch guard/redaction/comments UI; tree branch `parseProjectV4`, `decodeProject` және FlatScene viewer. Осы branch-та `decodeProjectV4` helper дайын, бірақ ViewerPage v3 store baseline-ға типтелген; v4 store біріккенде оны v4 decoder/type-ке жалғау керек. V4 parser public price нөлдерін default profile бағасына қайта толтырмайтынын интеграция тесті тексеруі қажет.
- ⚠ Серверсіз бұрын жіберілген `#token` URL-дерінің ішіндегі ескі құпия bytes-ты кері өшіру мүмкін емес. Жаңа `encodeProject` тазартады; код GET ескі сақталған JSON-ды да жауапта тазартады. Ескі hash URL өзін revocation жасау бұл өзгерістің шегінен тыс.
- ⚠ Cloud off серверсіз hash сілтемесіне пікір сақталмайды. Cloud on жасалған жаңа client link пен 6 санды код пікірді қолдайды. Аноним жасаушының key-і тек браузердің ағымдағы `shareSession` күйінде; қайта жүктегеннен кейін ол жауап беру мүмкіндігін жоғалтады, ал аккаунтпен жасалған share пікірлері account inbox-та сақталады.
- ⚠ Қолмен `salePrice` қойылмаса клиентке «Бағасы сұраныс бойынша» көрінеді. Есептелген quote total-ды жариялау үшін профильдің құпия бағасын шығармайтын бөлек public total DTO қажет; бұл branch оны қоспады.
- ⚠ Shop рөліне сервер жазуды тыйды және ішкі баға payload-ын тазартты; Workspace-тің барлық жергілікті редактор батырмаларын role-aware read-only ету осы branch-қа кірмеді. Локал өзгеріс сервер жобасына сақталмайды, бірақ цехқа арналған UI-да шатастыруы мүмкін. Billing/payment provider/invoices B3-тің бөлек бөлігі, бұл тапсырмада жасалмады.
- ⚠ Пікір нысаны cabinet/node ID-імен тіркеледі; нақты 3D нүктесіне pin және ескі пікірді жаңа кодқа көшіру бөлек кеңейту. Shop inbox соңғы 200 жазбаны көрсетеді; одан көбі үшін pagination керек.

Коммиттер: `5551029` — `feat: рөл рұқсатын және клиент пікірін қосу`; `4f2e15a` — `fix: клиент көрінісінен 3D өлшемдерін жасыру`; `7a223b0` — `fix: команда тізімі мен өз еркімен шығуды қайтару`. Push, merge, deploy жасалмады.

## Root интеграциясы (аралық)

- ✅ `5551029` + `4f2e15a` тәуелсіз shop агентінің ревьюінен кейін `f08ae34` merge-коммитімен `codex/0924`-ке біріктірілді.
- ✅ Біріктірілген күй: 140 файл / 1621 тест PASS, typecheck PASS (`0924-wave1-merge-roles-test.log`, `0924-wave1-merge-roles-typecheck.log`).
- ⚠ Соңғы build және browser сценарийі қалған тармақтар біріктірілген соң орындалады.
- ⚠ Клиенттің UI өлшемдері жасырылғанымен, 3D конфигінің геометриялық өлшемдері payload-та болады. Өндірістік конфигті мүлде бермейтін бөлек public mesh DTO бұл фазада жасалмады.
- ⚠ Viewer code TTL — 24 сағат; автордың архивке жауап беру құқығы осы TTL-мен тоқтамайды. Anonymous share бұрынғы public capability ретінде сақталады.
- ⚠ Келесі кезек: бірнеше Node процессі бір SQLite-ке жазатын орта үшін шақыруды бір рет пайдалану + тіркелуді бір транзакцияға біріктіру. Қазіргі route-тың check/register/mark synchronous тізбегінде await жоқ; бұл өзгерісте multi-process hardening жасалмады.

- ✅ Team read/self-leave follow-up `7a223b0` → root merge `1dd9b5f`: 140 файл /1622PASS +typecheck. Owner шақыру/role/revoke күзеті сақталған, designer/shop тек member тізімін оқып, өздері шыға алады.

## Resume интеграциясының браузер дәлелі

- ✅ `31420fc` интеграциясы: 162 файл / 1774 тест PASS; typecheck және webpack build PASS.
- ✅ Осы тапсырманың standalone browser сценарийі PASS (exit 0); қорытынды gate және қалған шектеулер `0924-01-wave1-report.md` ішінде.

- ⚠ Негізгі 22 e2e жиынтығы толық жасыл болмады; толқын толық бітті деп белгіленбейді. Жеке сценарий PASS жалпы regression gate-ін алмастырмайды. Үш әрекет шегі және қалған жұмыс толқын есебінде.

- ✅ Соңғы `7ed6914` кодымен жеке browser сценарийі қайта PASS (exit 0), лог `0924-final-e2e-roles.log`. Барлық іске қосу кезекпен, бір браузермен орындалды.

- ❌ Жалпы e2e-дегі команда сценарийі соңғы жүрісте «тізімде екі адам» шартынан өтпеді. Нақты түбірлік себеп дәлелденген жоқ; клиент пікірінің жеке PASS нәтижесі бұл шектеуді жаппайды. Келесі кезекте UI/сервер тізімін бір сәтте тіркеп тексеру қажет.
