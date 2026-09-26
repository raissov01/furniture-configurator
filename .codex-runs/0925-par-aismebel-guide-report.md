# AisMebel пайдаланушы нұсқаулығы — 2026-09-26

## Нәтиже

- `docs/guide/kk.md` және `docs/guide/ru.md` жасалды: рөлдерге арналған 10 минуттық бастау, өлшеуден төлемге дейінгі жол, офлайн/онлайн тәртібі, Базис және PRO100, ақаулар, сөздік, скриншот орындары.
- Нақты емес мүмкіндіктер жоспар деп ашық белгіленді. Атап айтқанда, `/cut → Бирки` QR жасамайды: `components/CutPage.tsx` `labelsPdf`-ке `projectId` пен `version` бермейді. QR кодтау `src/core/export/labels.ts` пен `/mobile/scan` ішінде бар; UI-ға жалғау кейін.
- Төлем үшін `src/core/kaspiManual.ts` қолмен Kaspi Pay шотын сипаттайды, бірақ қолданбадағы төлем журналы/банк растау экраны жоқ. PRO100 көпірі салыстыру/есеп шығару үшін, `.sto` жобасын AisMebel-ге тікелей импорттамайды.
- Қазіргі аккаунт рөлдері `owner`, `designer`, `shop`, `client` (`lib/permissions.ts`). Менеджер, өлшеуші, распил, кромка, монтажник бөлек рөл емес; нұсқаулықта міндетке сай рөл көрсетілді.

## Кодпен салыстырылған көздер

`CLAUDE.md`, `graphify-out/GRAPH_REPORT.md` (негізгі ағаштан тек оқылды), `components/Workspace.tsx`, `components/AccountPanel.tsx`, `components/QuoteView.tsx`, `components/ShareCodeDialog.tsx`, `components/CutPage.tsx`, `components/mobile/MeasurementWizard.tsx`, `app/mobile/installation/page.tsx`, `app/mobile/scan/page.tsx`, `src/core/sync/capabilities.ts`, `docs/basis/script-export.md`, `tools/pro100-bridge/README.md`, `docs/pro100/reference-comparison.md`.

## Тексеру

- `npm run -s typecheck` — өтті.
- Жад шегімен `npx vitest run` нысаналы 7 файл — **164 тест өтті**: approval, labels, basisScript, syncQueue, installation, kaspiManual, roles.
- Екі құжаттың міндетті бөлімдері, шектеулері, сурет толтырғыштары және ішкі сілтемелері тексерілді. Мутациялық тексеруде қазақша QR ескертпесі уақытша бұзылғанда тексергіш қате тапты; түпнұсқа `cp` арқылы қайтарылды, қайта тексеру өтті.

## Кейінгі UI жұмысы

Өндірістік биркаға QR шығару үшін `/cut`-тен `labelsPdf`-ке тұрақты жоба ID-і мен нұсқасын беру керек. Бұл тапсырма құжатпен ғана шектелгендіктен UI өзгертілмеді. Скриншоттардың орны көрсетілді, суреттері әлі түсірілген жоқ.
