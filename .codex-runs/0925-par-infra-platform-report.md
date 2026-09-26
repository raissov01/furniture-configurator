# 04e — платформа инфрақұрылымы

**Бұтақ:** `codex/0925-par` (`.worktrees/par`). `codex/0924` басында біріктірілді; негізгі ағашқа жазылған жоқ. Push және deploy жасалған жоқ.

## Іске асқаны

- SQLite әдепкі режимде қалды. `DATABASE_URL` PostgreSQL болса, бұрынғы синхронды `db().prepare().get/all/run` интерфейсін worker-thread адаптері сақтайды. PG 16 схемасы `docker/migrations/001–003` файлдарымен нұсқаланған; транзакциялық жазуларға advisory lock қосылған. Share кодтары бірегей шектеудің `ON CONFLICT` тармағымен қатар репликаларда да қайталанбайды.
- `scripts/migrateSqliteToPostgres.ts` ескі SQLite кестелерін бос PG базасына бір транзакцияда көшіреді. Ескі `users.role` жоқ нұсқада бірінші мүше `owner` болып миграцияланады; сан мен үлгі дерек тексеріледі.
- `/api/v1` алиастары ескі API handler-лерін қолданады. Бір образдың `web` және `api` рөлдері бар. PG кезегіндегі worker `render`, `xlsx`, `installation_sync` тапсырмаларын lease және retry арқылы орындайды; жаңа клиентке `/api/v1/jobs` жолдары берілді.
- Disk және S3/R2/MinIO адаптерлері, цехпен шектелген `/api/v1/objects` API-і қосылды. Жаңа фото, рендер, кітапхана, цех кітапханасы және экспорт файлдарына түр кілттері бар. Жүктеу 25 МБ-пен шектелген.
- Жоба, цех бағасы/профилі, тариф, рөл, келісім өзгерістеріне audit log; API v1 latency/status және қате журналы; иеге арналған `/admin/observability` кестесі қосылды.
- `docker/docker-compose.yml`, Swarm `docker/stack.yml` (web ×2, api ×2, worker ×1, PG ×1, nginx), nginx rate limit/25m/X-Real-IP, Docker secrets және healthcheck дайын. GitHub Actions тест/typecheck/build, өзгерген runtime бөлігін анықтау, GHCR образын жариялау және **тек қолмен, production environment мақұлдауымен** deploy жасауға дайын. `docs/deploy/architecture.md` орта, миграция, rollback және staging → production тәртібін түсіндіреді.

## Тексеру

- Соңғы толық SQLite Vitest: 253 файл, 2443 тест өтті; 3 файл және 4 тест skip (`/tmp/fc-par-sqlite-verified.log`).
- Толық PostgreSQL Vitest: 255 файл, 2446 тест өтті; 1 SQLite-ке тән тест skip (`fc_all4`, `PG_TEST_SCHEMA_PREFIX=vitest`).
- `npm run -s typecheck`: өтті.
- `docker compose config` және `docker stack config`: өтті.
- Бір `docker build --memory 3g` образы: Next.js production build және TypeScript өтті; уақытша образ жойылды. PG тест контейнері де жойылды.
- Мутациялық тексеріс: object storage цех ID тексеруін уақытша әлсіреткенде тест құлады; бастапқы файл `cp` арқылы қалпына келтірілді.
- Бұрынғы UI тест деректері жаңа parser валидациясына сәйкестендірілді; суық cache кезіндегі екі ұзақ import/CLI тестінің timeout шегі көтерілді, assertions сақталды.

## Қалған шектер

- Негізгі кезектің 06 e2e кезеңінде ғана толық `docker compose up` және браузер тексерісі жасалады; бұл параллель кезекте тыйым салынған.
- Қазіргі телефон фото маршруты бұрынғы DB BLOB жолын сақтайды, жаңа `/api/v1/objects/photo` объект қоймасын қолданады. Ескі фотоларды автоматты объектке көшіру және UI-ді жаңа async API-ге ауыстыру осы кезекте жасалмады.
- S3/R2 адаптері AWS SDK арқылы жасалды, бірақ нақты MinIO/R2 интеграциялық тесті жүргізілген жоқ; disk адаптері мен цех изоляциясы тестпен тексерілді.
- Production-ға шығару үшін Docker secret-терін және GitHub `production` environment required reviewer-ін оператор баптайды. Ешбір құпия репоға енгізілген жоқ.
