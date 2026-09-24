# 2026-09-24 B5 — жоба реквизиттері

- Бастапқы аудит: `ProjectInfo` бес өріспен, ProjectPanel/store редакторы және v3 JSON round-trip бұрыннан бар. `projectV4.ts` миграциясы `info`-ны `...rest` арқылы сақтайды; v4 схемасы ортақ `ProjectInfoSchema`-ны пайдаланады. Жаңа v3→v4→JSON round-trip тесті бес өрісті дәл сақтайтынын растады. UI v3 болып қалады (1-фаза шекарасы).
- Табылған бос жерлер: дата схемасы `2026-02-31` қабылдады; `projectInfoRows`/assembly PDF дата жолын баспады; CLI `assemblyDrawingPdf`-ке `project.info` бермеді. `ProjectPanel` дата өрісін тазалағанда store-да уақытша `''` тұрады, сондықтан PDF бос датаны өткізуі керек.
- Шешім: уақыт белдеуіне тәуелсіз Gregorian күнтізбесін тексеретін `projectDate.ts`; `ProjectInfoSchema` соны пайдаланады. Сызба PDF-інде бес реквизит жеке жолдарға шығады, биіктік сол жол санына қарай ығысады. Клиент КП-сының күні бұрынғыдай QuotePdfInput.date жолымен жеке басылады. CLI енді жобаның `info`-сын сызба PDF-іне береді. Жаңа dependency жоқ.

## TDD және тексеру

- RED: invalid calendar date, projectInfoRows date, assembly PDF нақты drawText date — 3 тест құлады. Кейін бос date UI кейсі `projectInfoRows({date:''})` RED болды. Green: `tests/projectInfo.test.ts` 17/17, толық `npm test` 126 файл/1527 тест, `npm run typecheck` таза.
- Мутация: `ProjectInfoSchema` date refinement-ті `() => true` деп бұзғанда invalid-date тесті құлады.
- Мутация: `projectInfoRows` дата жолын алып тастағанда assembly PDF drawText тесті құлады.
- Мутация: бос date тексеруін `!== undefined` деп бұзғанда UI бос дата тесті құлады.
- CLI мутациясы: `info: project.info` жолын алып тастап экспорттағанда PDF-та 5 реквизиттің бірде-бірі табылмады. Әр мутация алдында файл `cp` арқылы сақталып, кейін `cp` арқылы қайтарылды.
- CLI smoke: v3 жобасында бес реквизитпен `npm run export -- /tmp/0924-b5-project.json --out /tmp/0924-b5-export` жасалды; `pdftotext -layout` әр үш беттен `Заказ: CLI-42`, `Дата: 24.09.2026`, `Заказчик: Aigul`, `Дизайнер: Beknazar`, `Примечание: deliver soon` мәтіндерін тапты. Бірінші сынақтағы examples/wardrobe.json v2 файлына кейін қосылған `info` v2 схемаға жатпайтындықтан түсіп қалды; smoke v3-ке көшіріліп қайта жасалды. v3/v4 дерегі сақталады.
- PDF unit тесті файл ұзындығын ғана қарамайды: `PDFPage.drawText` шақыруларын бақылап, КП мен сызбаның барлық бес өрісін тексереді.

## Біріктіру

- B1 `src/core/schema.ts`-тегі discount өрістерімен осы бұтақтағы дата refinement бір schema блогына тиеді; merge кезінде екеуін де сақтаңыз.
