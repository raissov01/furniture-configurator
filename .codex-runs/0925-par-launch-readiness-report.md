# 0925-par — іске қосуға дайындық есебі

## Нәтиже

- Бұтақ: `codex/0925-par`; бастапқы `codex/0924` біріктіруі `Already up to date` болды. Негізгі ағашқа, `codex/0924` пен `main` бұтақтарына жазылған жоқ. Push/деплой жасалған жоқ.
- `scripts/launch_backup.py`: SQLite `sqlite3.backup` (WAL-мен), PostgreSQL `pg_dump -Fc`, `DATA_DIR` файлдары және қажет болса қолданбаның S3 объектілері бір SHA-256 manifest-і бар `.tar.gz` архивке жиналады. Жергілікті 14 күндік сақтау, арнайы rsync/S3 нысанасына көшіру және сол жақтағы ескі архивтерді жою бар. Қалпына келтіру жаңа бумаға, PostgreSQL-де тек бос DB-ге, S3-те тек бос префикске рұқсат етеді; бұзылған архив қабылданбайды.
- `scripts/launch_backup_daily.sh` және `docs/deploy/systemd/` ішінде тәуліктік backup timer мен бес минуттық monitor timer үлгілері бар.
- `docker/nginx-site.conf.example` HTTPS host proxy үлгісі; Compose HTTP порты loopback-ке байланды, Swarm HTTP портын `PLATFORM_HTTP_PORT` арқылы таңдауға болады, ішкі nginx HTTPS `X-Forwarded-Proto` мәнін өткізеді.
- `/api/health` DB тексерісі және `error_log` / observability осы бұтақта бұрыннан бар. `scripts/launch_monitor.py` health, диск, жад шегін тексереді; `docs/deploy/launch-checklist.md` DNS, сертификат/жаңарту, `NEXT_PUBLIC_*`, OAuth redirect, staging→production, rollback және бэкап сынағын сипаттайды.

## Тексеру

- `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run tests/launchBackup.test.ts --maxWorkers=2`: 2 өтті, PostgreSQL integration сынағы 1 skip (екі бос тест DB URL-і берілмеген). SQLite-де dump→restore жазбалары және файл байттары тең; manifest бұзылса restore тоқтайды. PostgreSQL URL өрістерінің libpq орта айнымалыларына дұрыс бөлінуі тексерілді.
- `npm run -s typecheck`: өтті.
- Осы ортада `pg_dump`, `pg_restore`, `psql` және серверлік nginx жоқ; нақты PostgreSQL restore және `nginx -t` staging-те checklist бойынша тексерілуі керек. `next build`, dev-server, браузер, e2e жүргізілген жоқ.

## Коммиттер

- `03de28a` — `feat: күнделікті дерек пен файл архивін жасау`
- `f2b944b` — `docs: іске қосу және бақылау үлгілерін дайындау`
- Қосымша түзету: PostgreSQL CLI URL-ін нақты libpq орта айнымалыларына бөлу (осы есеп жаңартуымен бірге).

Бастапқы worktree-дегі өзге өзгерістер (`package*.json`, `docs/mcp`, `scripts/mcp-*`, `tests/mcpTools.test.ts`) бұл есептің коммиттеріне кірмеді. UI кейін қажет болса жеке кезекте қаралады.
