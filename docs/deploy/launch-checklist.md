# Іске қосу тізімі: staging → production

Бұл құжат — серверде орындауға арналған нұсқаулық. Реподағы үлгілер серверге орнатылған жоқ. `scripts/deploy.sh` қолданатын қазіргі production — SQLite файлы мен `furniture-data:/data` Docker томы; `docker/stack.yml` — PostgreSQL нұсқасы. Әр орта үшін бөлек домен, құпиялар, DB, файл қоймасы және бэкап орны керек.

## 1. Staging дайындау

1. Доменнің DNS A/AAAA жазбасын staging хостына бағыттаңыз. 80/443 порттарын ашыңыз; ішкі 8096 (бір контейнер) не 8080 (Compose/Swarm) портын сыртқы желіден жабыңыз. Swarm кезінде `PLATFORM_HTTP_PORT=8080` қойып, host firewall-де 8080 портын тек жергілікті TLS проксиіне рұқсат етіңіз. Compose 8080 портын тек loopback-ке шығарады.
2. Серверде құпияларды реподан бөлек сақтаңыз. SQLite үшін `DATA_DIR=/data`; PostgreSQL үшін `DATABASE_URL` немесе Docker `POSTGRES_PASSWORD_FILE`. Объектілер S3-те болса `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, AWS кілттері дұрыс екеніне көз жеткізіңіз. `/api/health` DB байланысы кезінде ғана 200/`{"ok":true}` қайтарады; файл қоймасын бөлек файл жүктеп/оқып тексеріңіз.
3. `docker/nginx-site.conf.example` ішіндегі `example.com` және upstream портын ауыстырыңыз. Алғашқы сертификатқа дейін **тек 80-порттағы server блогын** қосып, `sudo mkdir -p /var/www/letsencrypt && sudo nginx -t && sudo systemctl reload nginx` орындаңыз. `sudo certbot certonly --webroot -w /var/www/letsencrypt -d staging.example.com` арқылы сертификат алыңыз. Содан кейін 443 блогын қосып, `ssl_certificate` жолдарын нақты доменге ауыстырып, қайтадан `nginx -t` және reload жасаңыз. `sudo certbot renew --dry-run` арқылы автоұзартуды тексеріңіз; certbot timer/cron қосулы болсын. Сертификат жаңарған соң nginx қайта оқуына `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` ішінде `#!/bin/sh` және `systemctl reload nginx` орналастырып, файлды орындалатын етіңіз.
4. Домен ауысқанда барлық орта айнымалысын қараңыз: реподағы нақты браузер айнымалысы `NEXT_PUBLIC_CLOUD` (`off` болса аккаунт/бұлт өшеді). Басқа `NEXT_PUBLIC_*` айнымалысы кейін қосылса, жаңа доменмен **build кезінде** қайта жинаңыз. Сыртқы OAuth провайдері қолданылса, redirect/callback URI, allowed origin және cookie доменін жаңа HTTPS доменіне ауыстырыңыз; қазір репода production OAuth провайдері қосылмаған. MCP-тің OAuth дайындығын `docs/mcp/README.md` түсіндіреді. Webhook және сыртқы сілтемелерді де жаңа доменге тексеріңіз.
5. HTTPS арқылы `/api/health`, кіру, жоба сақтау, файл жүктеу/оқу, share және export жолдарын тексеріңіз. 80→443 redirect пен сертификат тізбегін тексеріңіз. Staging дерегін production құпияларымен араластырмаңыз.

## 2. Тәуліктік бэкап

Дерек пен файлдың **бір уақытқа сәйкес** болуы үшін бэкап сәтінде барлық жазушыны (web/api/worker) тоқтатыңыз немесе maintenance режиміне қойыңыз. SQLite `sqlite3.backup` WAL-ды дұрыс қамтиды; PostgreSQL `pg_dump -Fc` транзакциялық DB snapshot береді. Файл қоймасы DB-мен бір транзакцияда емес, сондықтан жазуды тоқтату қажет. Жергілікті `DATA_DIR` ішіндегі барлық файл сақталады (`furniture.db` жеке snapshot ретінде); S3 объект қоймасы үшін `--object-s3-uri s3://.../` беріңіз. Қысылған `.tar.gz` архивінде SHA-256 manifest бар. Архив жеке деректерді қамтиды: бэкап бумасы 0700, архив 0600, сыртқы қоймаға шифрлау мен рұқсат шектеуін орнатыңыз.

Серверде `/etc/aismebel/backup.env` файлын тек root оқитындай сақтаңыз:

```ini
BACKUP_MODE=sqlite
DATA_DIR=/var/lib/docker/volumes/furniture-data/_data
BACKUP_DIR=/var/backups/aismebel
BACKUP_RSYNC_TARGET=backup@example-backup-host:/srv/aismebel-only/
# Немесе: BACKUP_S3_TARGET=s3://backup-bucket/aismebel-only/
# Қолданбаның S3 қоймасы болса: OBJECT_S3_URI=s3://app-bucket/
# PostgreSQL режимінде: BACKUP_MODE=postgres және DATABASE_URL қауіпсіз env арқылы
```

`DATA_DIR` нақты Docker volume mountpoint-ін `docker volume inspect furniture-data` арқылы растаңыз. PostgreSQL үшін хостта `pg_dump`, қалпына келтіруге `psql` және `pg_restore` керек; нұсқалары сервердегі PostgreSQL-мен үйлесуі тиіс. `DATABASE_URL` процесс аргументіне жазылмайды, тек ортада беріледі. S3 көшіруіне AWS CLI керек; S3/R2/MinIO endpoint қажет болса AWS CLI ортасында `AWS_ENDPOINT_URL` орнатыңыз. `BACKUP_RSYNC_TARGET` не `BACKUP_S3_TARGET` міндетті және сол мақсатты **тек осы бэкаптар үшін** бөліңіз: `--delete` 14 күннен ескі архивті сыртқы жақтан да жояды. S3-те versioning/Object Lock ережесін бөлек бекітіңіз, егер ұзақ сақтау талап етілсе.

`docs/deploy/systemd/aismebel-backup.{service,timer}` файлдарын `/etc/systemd/system/` ішіне көшіріп, сервис жолындағы репо орнын сәйкестендіріңіз. `scripts/launch_backup_daily.sh` орындалатын болсын. `sudo systemctl daemon-reload && sudo systemctl enable --now aismebel-backup.timer` және бір рет `sudo systemctl start aismebel-backup.service` орындаңыз. Timer күн сайын 02:30-да қосылады, жіберілген іске қосуды өтейді. Cron баламасы: `30 2 * * * /opt/furniture-configurator/scripts/launch_backup_daily.sh` (алдымен env файлын қауіпсіз жүктеңіз). `journalctl -u aismebel-backup.service` журналын қарап, сыртқы объектінің барын тексеріңіз. Скрипт жергілікті және сыртқы арнайы префиксте соңғы 14 күнді ұстайды. Қате болса timer сәтсіз күйде қалады, жергілікті архив сақталады.

## 3. Қалпына келтіру сынағы және rollback

Айына кемінде бір рет **бөлек staging DB/бос S3 префиксіне** қалпына келтіріп, жазба санын және бірнеше объектінің хэшін салыстырыңыз. Ешқашан production үстіне тікелей қалпына келтірмеңіз. Скрипт бар `--restore-dir` жолына жазбайды, PostgreSQL нысаналы базасы бос болмаса тоқтайды, S3 нысаналы префиксі бос болмаса тоқтайды.

```sh
python3 scripts/launch_backup.py restore \
  --archive /var/backups/aismebel/aismebel-YYYYMMDDTHHMMSSffffffZ.tar.gz \
  --restore-dir /tmp/aismebel-restore
# PostgreSQL: DATABASE_URL=... нысаналы БОС DB-ге бағытталсын.
# Қолданба S3 болса: --restore-object-s3-uri s3://restore-test-bucket/empty-prefix/
```

SQLite-де `/tmp/aismebel-restore/furniture.db` файлын жаңа `DATA_DIR` ретінде іске қосыңыз. PostgreSQL-де файлдар `--restore-dir` ішінде, DB нысаналы `DATABASE_URL` ішінде болады. Production rollback: жазуды тоқтатыңыз → соңғы тексерілген архивті оқшаулап қалпына келтіріңіз → алдыңғы қолданба образын сол схемаға үйлесімін қарап іске қосыңыз → `/api/health`, жоба және объектіні тексеріңіз → ғана трафикті қайтарыңыз. Миграцияны кері автоматты жүргізуге болмайды; DB мен образды бір recovery point ретінде қараңыз.

Автоматты сынақ: `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run tests/launchBackup.test.ts --maxWorkers=2`. Ол SQLite dump→restore, файл теңдігін, архив бұзылуын тексереді. PostgreSQL-ді нақты тексеру үшін бос, **тек тестке арналған** екі DB URL-ін `PG_LAUNCH_SOURCE_URL` және `PG_LAUNCH_RESTORE_URL` ретінде беріңіз; тест `pg_dump`/`pg_restore` жолымен жазбалардың теңдігін салыстырады. URL-дер болмаса бұл integration сынағы skip болады.

## 4. Мониторинг және іске қосу шешімі

`/api/health` DB-ге `SELECT 1` жасайды, ақауда 503 береді. `/admin/observability` платформаның әкімші цехына API метрикасы мен `error_log` жазбаларын көрсетеді; серверлік stdout/stderr `docker logs`/`journalctl` арқылы бақыланады. `scripts/launch_monitor.py` health, диск (`/var/lib/docker`) және `/proc/meminfo` жадын тексереді; әдепкі ескерту шектері 85% және 90%. `docs/deploy/systemd/aismebel-monitor.{service,timer}` бес минут сайын іске қосады. Монитор сервисінің сәтсіз шығуын өз alert жүйеңізге (`OnFailure=`, journal forwarding немесе cron `MAILTO`) жалғаңыз; жалған тыныштық болмас үшін хабарлама жеткізуді staging-те сынаңыз.

Production-ға өтуден бұрын: staging тесттері өтті; DNS/HTTPS дұрыс; сыртқы бэкап жасалып, таза ортаға қалпына келді; alert жеткізілді; соңғы жұмыс істейтін образ және DB архиві белгіленді; жауапты адам rollback тәртібін тексерді. Тек осыдан кейін production трафигін ауыстырыңыз.
