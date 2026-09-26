# PRO100 көпірі (`pro100-bridge`)

AisMebel-дің PRO100 v7.08-ді оның **интерфейсі арқылы** басқаратын Windows көмекшісі. Екі
міндеті бар:

1. **`audit`** — біздің тест-жинақты (`npm run pro100:kit` →
   `pro100-test-kit.json`) PRO100-да қайта құрып, PRO100 есептерін біз
   күткенмен салыстыру → `pro100-audit.json` + орысша `pro100-audit.txt`.
2. **`export-project`** — цех ашқан ескі PRO100 жобасының құрылымы мен
   есептерін біздің бейтарап пішімге оқу → `pro100-project.json` (ескі
   жобаларды AisMebel-ге көшіру үшін).

## Заңды шекара

- PRO100-да скрипт API жоқ (тек жабық Delphi `.plg` плагиндер, ашық SDK жоқ).
  Көпір DLL-ді, `.sto`/`.meb` файлдарын **ашпайды және талдамайды**.
- Жол — лицензиясы бар бағдарламаны пайдаланушының **өз ПК-сында** UI
  арқылы автоматтандыру: мәзір, Properties, Reports → «Save all...».
- Тек **есеп деректері** алынады. Кітапхана файлдары, текстуралар, модельдер
  көшірілмейді; кітапханадан тек **файл атаулары** оқылады (элементті табу үшін).

## Архитектура

```
 src/core/export/pro100Kit.ts ──► pro100-test-kit.json
                                        │
                     pro100-bridge.exe audit (Windows, PRO100 ашық)
                                        │
   cli.py ─► runner.py ─► driver.Pro100Driver ─┬─► ui_pro100.Pro100UI  (pywinauto, ЖАЛҒЫЗ GUI модулі)
                 │                              └─► dryrun.DryRunDriver (GUI-сіз журнал, Linux)
                 ├─► reports.py   есеп мәтінін талдау
                 ├─► compare.py   OK / MISMATCH / MISSING / EXTRA / SKIPPED (±0.5 мм)
                 ├─► library.py   кітапханадан АТЫ бойынша табу
                 ├─► safety.py    лицензия/демо терезесін тану, статус жолы
                 └─► summary_ru.py орысша қысқаша
                                        │
                                pro100-audit.json
                                        │
 src/core/export/pro100Audit.ts ◄── npm run pro100:audit ──► pro100-audit-report.md (қазақша)
```

- **Windows-қа тек `ui_pro100.py` тиеді.** Барлық терезе атауы, класс, мәзір
  орны — аталған тұрақтылар, әрқайсысының қасында қай скриншоттан алынғаны
  жазылған. pywinauto/pywin32/mss тек осы модульдің ішінде кеш импортталады.
- Қалғаны таза Python, Linux-та `pytest` (57 тест).
- TS жағы көпірдің салыстыруына **сенбейді**: `pro100-audit.json`-дағы шикі
  деректен (Properties мәндері, есеп жолдары, `expected`) бәрін қайта
  есептейді. Алгоритм екі тілде бірдей; `tests/fixtures/pro100/bridge-dryrun-audit.json`
  (Python шығарған) арқылы екі жақтың қорытындысы бірдей екені тексеріледі.

### `audit` қадамдары (әр сценарийге)

1. `File > New` → «Room properties» → OK (бөлме өлшемі өзгертілмейді).
2. Әр элемент: кітапханадан АТЫ бойынша табу (`library.search`, мысалы
   `Н 2дв 600`, `Н2 600`; `folderHints` — «Нижние», «560»), қою
   (алдымен `Edit > Insert from Catalog...`, болмаса Catalog терезесі),
   `Element > Properties` → Name, Width/Height/Depth, Left/Bottom/Back
   енгізу → OK → Properties-ті қайта ашып **оқу** (Cancel-мен жабу).
   Материал берілсе — Material → Change → Select material.
3. `Tools > Reports and calculation` → «Save all...» → төрт сақтау диалогына
   шығыс қалтасындағы жолды беру; болмаса қор тәсіл — қосымша + «Copy» +
   алмасу буфері.
4. Жобаны тек шығыс қалтасына `File > Save as` (`<сценарий>.sto`).
5. Әр негізгі қадамда PRO100 терезесінің скриншоты → `shots/`.

Әр қадам try/except: қате `errors`-қа жазылады, жүгіріс жалғасады.

### Қауіпсіздік

- PRO100 жалпы баптауына (Preferences), кітапханасына тимейді; тек ЖАҢА жоба
  құрады және оны тек шығыс қалтасына сақтайды (басқа жолға сақтауға тыйым
  `_save_in_dialog`-та).
- Лицензия / активация / тіркеу / демо / «проектті қалпына келтіру» терезесі
  шықса — **ешнәрсе баспай тоқтайды**, `stopped` өрісіне жазады (шығу коды 4).
- Пайдаланушының сақталмаған жобасы ашық болса («Проект был изменён») —
  Cancel басып тоқтайды, жобасын жоғалтпайды.
- Тек PRO100 процесінің терезелерімен жұмыс істейді; пернетақта жіберер
  алдында фокустың PRO100-да екенін тексереді (болмаса — тоқтайды).
  Скриншот тек PRO100 терезесінің аумағы.
- Өзі ашқан қалқымалы панельдерді (Catalog, Structure) соңында жабады.

## Не расталған, не болжам

**Расталған** (2026-09-24 нақты PRO100 v7.08, ағылшынша интерфейс, дамп пен файлдар):

| Не | Дереккөз |
|---|---|
| Есеп файлдарының пішімі: UTF-8+BOM, CRLF, TAB; деталь 8 баған (2 бос кромка бағаны), элемент 2, материал 3, құн 8 баған | `tests/fixtures/captured-s1/*.txt` |
| Properties: терезе `TFlatForm` «Properties», 6 × `TUnitSpinEdit` (Width, Height, Depth, Left, Bottom, Back — жоғарыдан төмен), Name — `TComboBox`+`Edit`, `TPageControl`, OK/Cancel/&Apply | `scenario1-properties-controls.json` |
| Мәзір пункттерінің WM_COMMAND id-і мен орны; мәзір OWNER-DRAW (мәтіні WinAPI-ге бос) | `menu-raw.json` (`tests/fixtures/menu-raw.json`, тестпен айқасады) |
| Сақтау диалогы стандарт `#32770`, бір `Edit` (файл аты), «&Save»; атаулары «Save piece list / element list / material consumption / calculation», «Save as» | `s1-*-export-dialog.json`, `s1-save-controls.json` |
| Reports: қосымшалар Parts list · Cabinet list · Material consumption · Calculation; батырмалар Print, Copy, Save..., Save all..., OK | `dialog-reports.png`, `s1-reports-saveall.png` |
| Статус жолының мәтіні: `Selected element: "…"`, `2700 x 0 x 1709`, `600 x 720 x 560` (екіншісі — әлемдік габарит, бұрылған элементте W/D ауысады) | `s1-final-dimensions-applied.png`, `scenario1-pasted.png` |
| File > New → «Room properties»; өзгерген жобада «Project was modified. Save changes?» | `scenario1-new-project.png`, `new-project-dialog.png` |

**Болжам** (бірінші нақты іске қосуда тексерілуі керек):

1. Owner-draw Delphi мәзіріне `PostMessage(WM_COMMAND, id)` жұмыс істейді.
2. `TUnitSpinEdit`-ке `{HOME}+{END}{DEL}` + сан + `{TAB}` терілгенде мән
   сақталады (OK-тан кейін қайта оқу арқылы тексеріледі — сәтсіз болса MISMATCH көрінеді).
3. `Edit > Insert from Catalog...` файл таңдау диалогын ашады (ашпаса — Catalog терезесі).
4. Catalog тізімі `SysListView32`-ге үйлесімді; қалтаға/элементке қос шерту
   кіреді/қояды; `BACKSPACE` жоғары қалтаға шығарады; комбо түбірде «Furniture».
5. Structure ағашы `TTreeView` (`SysTreeView32`) — түйінді таңдау сахнадағы
   элементті таңдайды.
6. Статус жолы `TStatusBar` класты, мәтіні `SB_GETTEXT`-пен оқылады.
7. Орысша интерфейс атаулары: тек `PRO100.rus` жолдарынан (экранда көрілмеген);
   «Свойства комнаты», «Сохранить все...» — ресурс жолында да табылмады.
8. Бірлік — мм (см болса, салыстыру «10 есе» деп белгілейді).
9. Кітапхана `PRO100.exe` қасындағы `Библиотека\Мебель` (болмаса `--library`).
10. «Select material» терезесінде Name өрісіне атау теріп «Select» басу материалды таңдайды.
11. Position → Back — артқы қабырғадан қашықтық (тек енгізіп, қайта оқимыз).

## Windows-та іске қосу

```bat
rem PRO100 іске қосулы болуы керек (жоба жабық не сақталған).
cd tools\pro100-bridge
py -3.12 -m pip install -r requirements.txt
py -3.12 -m pro100_bridge audit C:\path\pro100-test-kit.json
py -3.12 -m pro100_bridge export-project --out C:\path\old-project
```

Параметрлер: `--out` (шығыс қалтасы, әдепкісі — kit қасында күні бар қалта),
`--exe` (PRO100 іске қосылмаған болса), `--library` (кітапхана қалтасы),
`--slow 2` (баяу ПК), `--dry-run` (PRO100-сіз, тек журнал),
`--reports-from DIR` (dry-run үшін дайын есептер), `--no-countdown`.

Шығу коды: `0` — бәрі сәйкес, `3` — айырма не қадам қатесі бар, `4` —
тоқтатылды (лицензия терезесі т.б.), `2` — kit файлы қате.

### exe жинау (Windows)

```bat
cd tools\pro100-bridge
build.bat
rem нәтиже: dist\pro100-bridge.exe  (тесттер алдымен жүреді)
```

`build.bat` = venv → `pip install -r requirements.txt -r requirements-dev.txt "pyinstaller>=6,<7"`
→ `pytest` → `pyinstaller --clean --noconfirm pro100-bridge.spec` → `dist\pro100-bridge.exe --version`.

## Linux-та тексеру

```bash
cd tools/pro100-bridge
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q
npm run pro100:kit -- --out /tmp/kit
.venv/bin/python -m pro100_bridge audit /tmp/kit/pro100-test-kit.json --dry-run \
    --reports-from tests/fixtures/captured-s1 --out /tmp/dry
npm run pro100:audit -- /tmp/dry/pro100-audit.json --out /tmp/dry/report.md
```

## Бірінші нақты іске қосуда не тексеріледі

- [ ] `shots/001-start.png` — көпір дұрыс терезені тапты ма; `notes`-та мәзір id айырмасы жоқ па.
- [ ] `s1-base:insert` — қай тәсіл жұмыс істеді (`items[].insert.strategy`), қате болса `errors` мәтіні мен скриншот.
- [ ] `items[].actual` — Properties-тен оқылған H × W × D мен орын сұралғанға тең бе (терілген мән сақтала ма).
- [ ] `reports[].source` = `save-all` пе; файлдар `<сценарий>/` ішінде ме; `unparsed` бос па.
- [ ] Орысша интерфейсте: терезе атаулары танылды ма (танылмаса — `ui_pro100.py` тұрақтысына қосу).
- [ ] `export-project`: Structure ағашы оқылды ма (`elements` бос емес пе).
- [ ] Лицензия терезесі шықпады ма (`stopped`).

Айырма табылса — `npm run pro100:audit` есебі оны түрі бойынша топтап,
себебін (РЕЗ/ГОТОВЫЙ, кромка, конструкция, атау) айтады.

## `pro100-audit.json` пішімі (қысқаша)

`format: "furniture-configurator.pro100-audit"`, `version: 1`, `project`,
`runAt`, `tolerance`, `environment`, `items[]` (`requested`, `created`,
`insert`, `actual`, `statusBar`, `material`), `reports[]` (`source`, `files`,
`rawText`, `parts`, `elements`, `materials`, `calculation`, `unparsed`),
`comparison` (`summary`, `results[]`), `errors[]`, `stopped`, `steps[]`,
`shots[]`, `notes[]`, `expected` (тест-жинақтың өзі).
