# `claude/basis-script` merge алдындағы ревью — 2026-09-24

Қорытынды: **әзір merge жасамау**. Төмендегі екі маңызды ақау түзетіліп, регрессиялық тестпен жабылуы керек. Базис-Мебельщиктің нақты runtime-ында скрипт әлі іске қосылып тексерілмеген; fake Bazis тесті API үйлесімін дәлелдемейді. Бұл ревью автордың worktree-сін өзгертпеді; толық тест жиынтығы жүргізілген жоқ.

## Important 1 — шкафтың жеке кромка ережесі жоғалады

`src/core/generateCabinet.ts:83` панельдерді `mergeSettings(projectSettings, config.settings)` арқылы есептейді. `src/core/export/basisScript.ts:338` тек жоба/цех баптауын оқиды, ал `components/CutPage.tsx:275` скриптке `shop.settings` қана береді. Сондықтан жеке шкаф `minBandSubtract: 3` етіп берілсе, 2 мм лента рез өлшемінен шегерілмейді, бірақ скрипт `ClipPanel: true` береді. Базис бөлшекті 2 мм кем кесуі мүмкін; дәл физикалық әсері runtime audit-пен тексерілуі тиіс.

Қайта шығару (`claude/basis-script` worktree түбірінен):

```sh
NODE_OPTIONS=--max-old-space-size=2048 npx tsx -e 'import {SEED_CATALOG,SEED_TEMPLATES,templateToCabinet,flattenTree,IDENTITY_TRANSFORM,basisScriptData} from "./src/core/index.ts"; const t=SEED_TEMPLATES.find(x=>x.id==="wardrobe-penal-600")!; const config={...templateToCabinet(t,SEED_CATALOG),settings:{minBandSubtract:3}}; const root={id:"root",name:"root",kind:"group" as const,transform:IDENTITY_TRANSFORM,children:[{id:"c",name:"c",kind:"cabinet" as const,transform:IDENTITY_TRANSFORM,config}]}; const scene=flattenTree(root,SEED_CATALOG); const d=basisScriptData(scene,SEED_CATALOG); const p=d.panels.find(p=>p.edges.some(e=>e.thickness===2))!; console.log(JSON.stringify({finished:[p.finishedLength,p.finishedWidth],cut:[p.cutLength,p.cutWidth],bands:p.edges.filter(e=>e.thickness===2).map(e=>({side:e.side,clip:e.clip}))}))'
```

Нәтиже: `{"finished":[2000,447],"cut":[2000,447],"bands":[{"side":"L1","clip":true}]}`. Сол баптау тесік орнын `cutOrigin` арқылы да өзгерте алады.

## Important 2 — audit JSON тексеруден өтіп, CLI құлайды

`src/core/export/basisAudit.ts:89` күтілген панель/крепеж массивтерін `z.unknown()` ретінде қабылдайды; `analyzeBasisAudit` оларды `BasisScriptData` деп cast жасап, `p.name` мен `p.skip` оқиды. Мысалы `expected.panels: [null]` Zod тексеруінен өтіп, `TypeError` береді. `src/cli/bazisAudit.ts` тек parse кезіндегі `ZodError`-ды өңдейді, сондықтан сырттан келген бұзылған audit файлы CLI-де шикі traceback шығарады.

Қайта шығару (`claude/basis-script` worktree түбірінен):

```sh
NODE_OPTIONS=--max-old-space-size=2048 npx tsx -e 'import {parseBasisAudit,analyzeBasisAudit} from "./src/core/index.ts"; const x={format:"furniture-configurator.basis-audit",version:1,project:"x",tolerance:0.5,panels:[],fasteners:[],holes:null,errors:[],expected:{format:"furniture-configurator.basis-script",panels:[null],fasteners:[]}}; try {const a=parseBasisAudit(x); console.log("parsed"); analyzeBasisAudit(a)} catch(e) {console.log(String(e))}'
```

Нәтиже: `parsed`, одан кейін `TypeError: Cannot read properties of null (reading 'name')`. `expected` құрылымын нақты schema-мен тексеріп, қате файлды басқарылатын validation қатесі ретінде көрсету керек.

Қалған diff бойынша басқа дәлелденген Critical ақау табылған жоқ. `detali.csv` бағандары бұрынғыдай; `prisadka.csv`-тың алынуы құжатталған, бірақ нақты Базис импорт жолы мен скрипт API-і бөлек runtime тексерісін қажет етеді.
