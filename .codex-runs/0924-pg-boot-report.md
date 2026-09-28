# 09-24 PostgreSQL Compose іске қосылуы — есеп

2026-09-28. Бұтақ: `codex/0924-pg-boot`.

| Пункт | Күй | Дәлел |
|---|---|---|
| Түбірлік себеп | ✅ | Таза Compose-та PostgreSQL healthy болғанмен web/API health 503: Turbopack standalone `pgWorker.cjs` модулін жүктей алмады. Worker миграцияға дейін `jobs` кестесін сұрап тоқтады. Webpack-пен жергілікті PostgreSQL health 200, сондықтан Docker build webpack-ке көшірілді. |
| Worker startup | ✅ | Бос PostgreSQL базасына worker іске қосу тесті әуелі red (`jobs` жоқ, exit 1), түзетуден кейін green. Миграция шақыруын алып тастау мутациясы red; файл `cp` арқылы қайтарылды. |
| Image қауіпсіздігі | ✅ | `docker/secrets` және `.worktrees` build context-тен шығарылды. Уақытша құпиялар тек `/tmp` ішінде болды, image-ке түспеді. |
| Толық тексеріс | ✅ | Бұтақтағы `npm test -- --maxWorkers=3`: 425 файл/3039 тест өтті, 4 файл/6 тест skip; typecheck exit 0. PostgreSQL мақсатты тесті жеке 1/1 өтті. Docker webpack image build exit 0. |
| Таза Compose | ✅ | Жаңа volume: PostgreSQL, web, API, worker төртеуі healthy. `/api/health`, `/api/v1/health` HTTP 200. Контейнер үстіндегі `Эталон шкаф: 6 позиция / 11 деталь` e2e 1/1 өтті. Контейнерлер мен volume өшірілді. |

Тәуелділік қосылмады. Push, deploy, `feat/tree-core` және `main` өзгертілмеді.
