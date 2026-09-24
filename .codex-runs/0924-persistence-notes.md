# 2026-09-24 — реквизит пен жеңілдіктің автосақталуы

- Бастапқы browser smoke: B1 сметасындағы жеңілдік есебі дұрыс, бірақ `localStorage['furniture-configurator:project']` 30 секундтан кейін де өзгермеді. `Workspace.tsx` автосақтау effect-і тек `room/cabinets/placements` өзгерісін тыңдайды; `editProjectInfo` және `editPriceOverrides` store-да `set` қана жасады.
- Түзету: осы екі store әрекетінде `set`-тен кейін `get().saveProjectLocally()` шақырылады. Геометрия, undo және `src/core` баға/өндіріс ережелері өзгерген жоқ. Жаңа dependency жоқ.
- Тест `window.localStorage`-ті Map-пен ауыстырады. Бір edit-тен кейін parseProject жарамды JSON жазылғанын, бес реквизиттің бәрін, `salePrice` пен екі жеңілдікті, hydrateProject round-trip-ті, override пен бос metadata тазалауды және шкаф конфигінің өзгермеуін тексереді. Жолдық жеңілдік кілті ағымдағы шкафтың нақты `carcassMaterialId` мәнінен алынды.
- TDD: бастапқыда жаңа 3 тесттің 3-уі red (сақталған JSON жоқ / hydrate бос). Екі save шақыруынан кейін 3/3 green.
- Мутация 1: `editProjectInfo` ішіндегі save шақыруы алынды → метадерек тесті 1/1 failed. Мутация 2: `editPriceOverrides` ішіндегі save шақыруы алынды → жеңілдік тесті 1/1 failed. Әр файл алдын ала `cp` арқылы сақталып, `cp` арқылы қайтарылды.
- Соңғы тексеру: `npm test` — **132 файл/1588 тест**, `npm run typecheck` — таза. Коммит: `fix(store): реквизит пен жеңілдікті бірден сақтау`.
