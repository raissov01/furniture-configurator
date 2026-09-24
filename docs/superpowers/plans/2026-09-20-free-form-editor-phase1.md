# Еркін редактор өзегі — 1-фазаның жүзеге асыру жоспары

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Жобаның өзегіне түйіндер ағашын қосу және оның `generateCabinet` +
`Placement` жолымен дәл бірдей нәтиже беретінін тестпен дәлелдеу — UI-ға
мүлде тимей.

**Architecture:** `src/core/tree.ts` түйін типтерін және Y осі бойынша поза
құрамасын береді. `src/core/flatten.ts` ағашты аралап, әр түйін үшін
«панельдер + поза» жұбын қайтарады. Өндірістік тізбек (`cutList`, `pricing`,
`nesting`, `dxf`) панельдің әлемдегі орнын ЕШҚАШАН қарамайды, сондықтан
жайылу панельдерді түйіннің **локал** кеңістігінде қалдырады да, орнын бөлек
`Pose` болып береді — бұл қолданыстағы `SceneItem`-мен дәл сәйкес келеді.

**Tech Stack:** TypeScript (strict), Vitest, Zod (кейінгі фазада). Жаңа
тәуелділік ЖОҚ.

**Spec:** `docs/superpowers/specs/2026-09-20-free-form-editor-design.md`

**Бұтақ:** `feat/tree-core`

## 2026-09-24 тексеру

Task 1–5 коды мен тесттері бұрынғы `feat/tree-core` коммиттерінде болған;
Task 6-ның `SEED_SETS` бөлігі де дайын еді. Осы күнгі тексеріс барлық
міндетті нәтижені іске қосып растады, Task 6-ға `SEED_TEMPLATES`-тің барлық
35 үлгісі қосылды. Төмендегі `[x]` код пен тесттің бүгін расталған күйін
көрсетеді; ол бұрынғы автордың TDD сынағы қай уақытта қызарғаны туралы
тарихи мәлімдеме емес. Бүгін sin таңбасы, settings таралуы, placement сүзгісі,
hidden және v4 schema қатаңдығы `cp` арқылы қайтарылған мутациямен жеке
тексерілді. v4-тің типтелген `root` форматы `src/core/projectV4.ts` ішінде
бар; қолданыстағы UI әлі v3 адаптерін пайдаланады (2-фаза).

Алғашқы A worktree build-і бұрыннан бар `app/api/ar/route.ts`-тегі артық
`arDir` экспорты үшін TS2344 қатесіне тоқтады. Оны бөлек `9a10ffe`
коммиті функцияны `lib/server/arStorage.ts`-ке көшіру арқылы түзетті.
3091 портындағы алғашқы e2e 19/22 өтті: reload-та жоба сақталуы, 3D
drag/undo, аккаунттан жобаны қалпына келтіру құлады. A өзгерістері жоқ
базалық тармақта алғашқы жүгіріс screenshot timeout-пен тоқтады, ал
assertion-дарды өзгертпеген instrumented қайталау 22/22 өтті. Демек
19/22-нің тұрақты A регрессиясы екені дәлелденбеді; браузер күйі/уақыты
әсер етуі мүмкін (`.codex-runs/0924-baseline-e2e-notes.md`).

Соңғы `codex/0924` интеграциясында (`2d7b392`) `npm test` — 132 файл,
1588 тест; `npm run typecheck` — таза; әдепкі Turbopack-пен `npm run build`
— exit 0 (`.codex-runs/0924-final-build.log`). Dev-сервер 3094 портында
HTTP 200 берді, ресми `npm run test:e2e -- http://localhost:3094` —
22/22, exit 0 (`.codex-runs/0924-final-e2e.log`). Бүгінгі өзгерістер
тек `codex/0924` интеграция бұтағына біріктірілді; `feat/tree-core` мен
`master` өзгертілмеді. v4 `root` өзек API-і мен v3 UI адаптерінің 2-фаза шекарасы
сақталады.

## Global Constraints

Бәрі `CLAUDE.md`-ден, сөзбе-сөз:

- **§0.1** Өлшем реті — **H × W × D**, прозада әр сан өз әрпімен: `2000 (H) × 600 (W) × 450 (D)`. Әріпсіз `2000×600×450` жазуға тыйым.
- **§0.2** Өлшем — **миллиметр, бүтін сан**. Ақша — бүтін минор бірлік (тиын).
- **§3** `/src/core` — **таза TypeScript кітапханасы, React/three.js/Next.js импорты нөл**. Node-та жүруі және толық юнит-тестке келуі керек.
- **§3** `Panel[]` — жалғыз ақиқат көзі. Панель өлшемін React компонентінің немесе three.js мешінің ішінде есептеуге тыйым.
- **§4.3** Рез өлшемі — туынды: `cutLength = finishedLength − t(W1) − t(W2)`, `cutWidth = finishedWidth − t(L1) − t(L2)`. Қолмен енгізілмейді.
- **§10** `no any`. `no silent catch`. Валидация қателері өріс атымен және рұқсат етілген аралығымен бетке шығады.
- **§10** Шағын коммиттер, бір коммит — бір мәселе, conventional commit хабары.
- **§8** `npm test` әр коммитке дейін жүгіртіледі. Құлаған тест коммитке кетпейді.
- Әр өндірістік константаға физикалық мағынасын түсіндіретін түсініктеме жазылады.

**Базалық күй (2026-09-20):** 81 тест файлы, 1083 тест өтеді, `tsc --noEmit` таза.

---

## Спектен ауытқу — оқып шығыңыз

Спектің 5-бөлімінде `flattenTree` **әлем координатындағы** `Panel[]`
қайтарады деп жазылған. Жоспар оны нақтылайды:

`Panel.rotation` — бұл `Orientation`-нан шыққан Euler (мысалы `ORIENT_FACING`
→ `(180, 0, −90)`). Оған түйіннің Y-бұрылысын «қосу» деген дұрыс емес:
Euler бұрыштарын қосуға болмайды, матрица керек. Ал қолданыстағы қосымша
бұл мәселені мүлде шешпейді — `placementPose` позаны бөлек береді де,
three.js оны топ деңгейінде қолданады.

Түбегейлі себеп: **өндірістік тізбек панельдің әлемдегі орнын қарамайды.**
`formatCutList`, `pricing`, `nesting`, `cutPlan`, `dxf`, `cnc`, `labels` —
бәрі тек өлшемді, кромканы, присадканы оқиды. Әлем координаты тек 3D-ге
керек, ал ол бұрыннан позамен жұмыс істейді.

Сондықтан:

```ts
flattenTree(root, catalog, settings) → { nodes: FlatNode[]; solids: PlacedSolid[] }
FlatNode = { nodeId, name, panels /* локал */, hardware, pose }
```

Бұл `lib/useSceneItems.ts`-тегі `SceneItem` пішінімен бірдей, сондықтан
2-фазада UI-ды ауыстыру шағын қадам болады. Матрица математикасы да,
онымен келетін дәлдік қателері де жазылмайды.

---

## Файл құрылымы

| Файл | Жауапкершілігі |
|---|---|
| `src/core/tree.ts` (жаңа) | Түйін типтері, `Transform`/`Pose`, поза құрамасы, ағашты аралау |
| `src/core/flatten.ts` (жаңа) | Ағаш → `FlatScene`. `generateCabinet`-ті шақырады, `BoardSpec`-ті `Panel`-ге айналдырады |
| `src/core/treeFromProject.ts` (жаңа) | `ProjectFile` (v3) → `GroupNode`. Таза, бір бағытты |
| `src/core/index.ts` (өзгереді) | Үш жаңа модульді экспорттау |
| `CLAUDE.md` (өзгереді) | §1 Non-goals жаңартылады |
| `tests/tree.test.ts` (жаңа) | Поза құрамасы, аралау, қате жағдайлары |
| `tests/flatten.test.ts` (жаңа) | Төрт түйін түрі, `hidden` ережесі |
| `tests/treeFromProject.test.ts` (жаңа) | v3 жобаның ағашқа айналуы |
| `tests/flattenEquivalence.test.ts` (жаңа) | **Басты кепіл**: ескі жол = жаңа жол |

1-фазада `store/configurator.ts`, `components/*`, `src/core/schema.ts`
**тиілмейді**. Қосымша бұрынғыдай жұмыс істейді.

---

### Task 1: `tree.ts` — түйін типтері және поза құрамасы

**Files:**
- Create: `src/core/tree.ts`
- Test: `tests/tree.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `CabinetConfig`, `PanelEdges`, `PanelRole`, `Orientation`, `Drill`, `Cutout`, `PanelCorners`, `MillingPath` — `./types`-тен; `ConfigValidationError` — `./errors`-тен
- Produces: `Transform`, `Pose`, `SceneNode`, `GroupNode`, `CabinetNode`, `BoardNode`, `SolidNode`, `BoardSpec`, `SolidSpec`, `IDENTITY_TRANSFORM`, `ORIGIN_POSE`, `composePose(parent: Pose, child: Transform): Pose`, `walkTree(root: GroupNode, visit: (node: SceneNode, pose: Pose) => void): void`, `findNode(root: GroupNode, id: string): SceneNode | undefined`

- [x] **Step 1: Тестті жаз (құлауы керек)**

`tests/tree.test.ts`:

```ts
/**
 * ТҮЙІНДЕР АҒАШЫ — еркін редактордың өзегі.
 *
 * Поза құрамасының бағыты `room.ts`-тегі `placementCorners`-пен БІРДЕЙ
 * болуы керек: world.x = pos.x + lx·cos + lz·sin, world.z = pos.z − lx·sin + lz·cos.
 * Басқаша болса, ескі жоба ағашқа көшкенде шкаф басқа жерге тұрады.
 */
import { describe, expect, it } from 'vitest'
import { ConfigValidationError, ORIGIN_POSE, composePose, findNode, walkTree } from '../src/core/index'
import type { GroupNode, Pose, SceneNode, Transform } from '../src/core/index'

const tr = (x: number, y: number, z: number, rotY = 0): Transform =>
  ({ pos: { x, y, z }, rot: { x: 0, y: rotY, z: 0 } })

const group = (id: string, transform: Transform, children: SceneNode[]): GroupNode =>
  ({ kind: 'group', id, name: id, transform, children })

const solid = (id: string, transform: Transform): SceneNode =>
  ({ kind: 'solid', id, name: id, transform, solid: { size: { x: 100, y: 100, z: 100 } } })

describe('composePose', () => {
  it('бұрылыссыз — орындар жай қосылады', () => {
    const pose = composePose(ORIGIN_POSE, tr(100, 200, 300))
    expect(pose.position).toEqual({ x: 100, y: 200, z: 300 })
    expect(pose.rotationY).toBe(0)
  })

  it('90° бұрылыста x → −z (room.ts келісімі)', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 90 }
    const pose = composePose(parent, tr(100, 0, 0))
    // cos90 = 0, sin90 = 1 → x = 0 + 100·0 + 0·1 = 0; z = 0 − 100·1 + 0·0 = −100
    expect(pose.position.x).toBe(0)
    expect(pose.position.z).toBe(-100)
  })

  it('90°-қа еселі бұрышта «құйрық» қалмайды', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 180 }
    const pose = composePose(parent, tr(450, 0, 0))
    expect(pose.position.x).toBe(-450)
    expect(pose.position.z).toBe(0)
  })

  it('бұрыштар қосылады', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 90 }
    expect(composePose(parent, tr(0, 0, 0, 45)).rotationY).toBe(135)
  })

  it('X немесе Z бойынша бұрылыс — қате', () => {
    expect(() => composePose(ORIGIN_POSE, { pos: { x: 0, y: 0, z: 0 }, rot: { x: 10, y: 0, z: 0 } }))
      .toThrow(ConfigValidationError)
    expect(() => composePose(ORIGIN_POSE, { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 10 } }))
      .toThrow(ConfigValidationError)
  })
})

describe('walkTree', () => {
  it('ұя ішіндегі түйінге АТА позасы қосылып келеді', () => {
    const root = group('root', tr(0, 0, 0), [
      group('g1', tr(1000, 0, 0), [solid('s1', tr(500, 0, 0))]),
    ])
    const seen = new Map<string, Pose>()
    walkTree(root, (node, pose) => { seen.set(node.id, pose) })
    expect(seen.get('g1')!.position.x).toBe(1000)
    expect(seen.get('s1')!.position.x).toBe(1500)
  })

  it('түбірдің өзі де кіреді', () => {
    const root = group('root', tr(7, 0, 0), [])
    const ids: string[] = []
    walkTree(root, (node) => { ids.push(node.id) })
    expect(ids).toEqual(['root'])
  })
})

describe('findNode', () => {
  it('ұяның түбінен табады', () => {
    const root = group('root', tr(0, 0, 0), [group('g1', tr(0, 0, 0), [solid('s1', tr(0, 0, 0))])])
    expect(findNode(root, 's1')!.id).toBe('s1')
  })

  it('жоқ id — undefined', () => {
    expect(findNode(group('root', tr(0, 0, 0), []), 'yoq')).toBeUndefined()
  })
})
```

- [x] **Step 2: Тестті жүгіртіп, құлағанын көр**

Run: `npx vitest run tests/tree.test.ts`
Expected: FAIL — `composePose` экспортталмаған («No "composePose" export is defined»).

- [x] **Step 3: `src/core/tree.ts`-ті жаз**

```ts
/**
 * ТҮЙІНДЕР АҒАШЫ — еркін редактордың өзегі (spec 2026-09-20).
 *
 * Таза TypeScript: React, three.js, Next.js импорты ЖОҚ (CLAUDE.md §3).
 *
 * Ағаштың мәні — PRO100-дағы «элементтің ішіне элемент салу»: топты
 * жылжытқанда балалары бірге жылжуы керек. Сондықтан әр түйіннің
 * `transform`-ы АТА-ТҮЙІНГЕ қатысты, ал әлемдегі орны аралау кезінде
 * жиналады.
 */
import { ConfigValidationError } from './errors'
import type {
  CabinetConfig, Cutout, Drill, MillingPath, Orientation,
  PanelCorners, PanelEdges, PanelRole, Vec3,
} from './types'

/** Ата-түйінге ҚАТЫСТЫ орны. Орын — бүтін мм (§0.2), бұрыш — градус. */
export type Transform = { pos: Vec3; rot: Vec3 }

export const IDENTITY_TRANSFORM: Transform = {
  pos: { x: 0, y: 0, z: 0 },
  rot: { x: 0, y: 0, z: 0 },
}

/**
 * ӘЛЕМДЕГІ орны. `placementPose` қайтаратын пішінмен әдейі БІРДЕЙ: 3D сахна
 * бұрыннан осымен жұмыс істейді, екінші келісім ойлап табудың қажеті жоқ.
 */
export type Pose = { position: Vec3; rotationY: number }

export const ORIGIN_POSE: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 0 }

type NodeBase = {
  id: string
  name: string
  transform: Transform
  /** Көрінбейтін түйін деталировкаға да, сметаға да ТҮСПЕЙДІ */
  hidden?: boolean | undefined
  locked?: boolean | undefined
}

export type GroupNode = NodeBase & { kind: 'group'; children: SceneNode[] }
export type CabinetNode = NodeBase & { kind: 'cabinet'; config: CabinetConfig }
export type BoardNode = NodeBase & { kind: 'board'; board: BoardSpec }
export type SolidNode = NodeBase & { kind: 'solid'; solid: SolidSpec }

export type SceneNode = GroupNode | CabinetNode | BoardNode | SolidNode

/**
 * ЕРКІН ТАҚТА = бір деталь.
 *
 * `cutLength`/`cutWidth` әдейі ЖОҚ: рез өлшемі кромкадан есептеледі
 * (CLAUDE.md §4.3). Оны қолмен енгізуге рұқсат етсек, екі ақиқат көзі пайда
 * болады да, цехқа қате сан кетеді.
 */
export type BoardSpec = {
  materialId: string
  /** ГОТОВЫЙ ұзындығы, мм */
  length: number
  /** ГОТОВЫЙ ені, мм */
  width: number
  orientation: Orientation
  edges: PanelEdges
  grainAlongLength: boolean
  role: PanelRole
  drilling?: Drill[] | undefined
  cutouts?: Cutout[] | undefined
  corners?: PanelCorners | undefined
  milling?: MillingPath[] | undefined
}

/** Өндіріске КЕТПЕЙТІН қорап: техника, тас, декор. */
export type SolidSpec = {
  size: Vec3
  color?: string | undefined
  textureId?: string | undefined
}

/**
 * 90°-қа еселі бұрышта cos/sin ДӘЛ ±1 не 0 болуы керек.
 * `Math.cos(Math.PI)` −0.9999999999999999 береді де, 450 мм-лік шкаф
 * 450.0000000000001 болып шығады (room.ts-тегі сол ескерту).
 */
function snapTrig(n: number): number {
  if (Math.abs(n) < 1e-9) return 0
  if (Math.abs(n - 1) < 1e-9) return 1
  if (Math.abs(n + 1) < 1e-9) return -1
  return n
}

/**
 * Ата позасына бала трансформасын қосу.
 *
 * Бұрылыс бағыты `room.ts`-тегі `placementCorners`-пен бірдей:
 *   world.x = pos.x + lx·cos + lz·sin
 *   world.z = pos.z − lx·sin + lz·cos
 *
 * ⚠ 1-фазада тек Y осі. Жиһазда қажеті де сол: шкаф қабырғаға бұрылады,
 * шалқайып тұрмайды. X/Z бойынша бұрылыс Euler құрамасын талап етеді —
 * ол кейінгі фазада, `SolidNode`-қа қисық декор керек болғанда.
 */
export function composePose(parent: Pose, child: Transform): Pose {
  if (child.rot.x !== 0 || child.rot.z !== 0) {
    throw new ConfigValidationError(
      'transform.rot',
      'бұл фазада тек Y осі бойынша бұрылысқа қолдау бар',
      'rot.x = 0 және rot.z = 0',
    )
  }
  const a = (parent.rotationY * Math.PI) / 180
  const cos = snapTrig(Math.cos(a))
  const sin = snapTrig(Math.sin(a))
  return {
    position: {
      x: parent.position.x + child.pos.x * cos + child.pos.z * sin,
      y: parent.position.y + child.pos.y,
      z: parent.position.z - child.pos.x * sin + child.pos.z * cos,
    },
    rotationY: parent.rotationY + child.rot.y,
  }
}

/**
 * Ағашты тереңдігінен аралау. Әр түйінге ӘЛЕМДЕГІ позасы беріледі.
 * Түбірдің өзі де кіреді — оның да трансформасы болуы мүмкін.
 */
export function walkTree(
  root: GroupNode,
  visit: (node: SceneNode, pose: Pose) => void,
): void {
  const step = (node: SceneNode, parent: Pose): void => {
    const pose = composePose(parent, node.transform)
    visit(node, pose)
    if (node.kind === 'group') {
      for (const child of node.children) step(child, pose)
    }
  }
  step(root, ORIGIN_POSE)
}

export function findNode(root: GroupNode, id: string): SceneNode | undefined {
  let found: SceneNode | undefined
  walkTree(root, (node) => {
    if (found === undefined && node.id === id) found = node
  })
  return found
}
```

- [x] **Step 4: `index.ts`-ке экспорт қос**

`src/core/index.ts`, `export * from './geometry'` жолынан кейін:

```ts
export * from './tree'
```

- [x] **Step 5: Тестті жүгірт**

Run: `npx vitest run tests/tree.test.ts`
Expected: PASS — 9 тест.

- [x] **Step 6: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: 1092 тест өтеді, `tsc` үнсіз.

- [x] **Step 7: Коммит**

```bash
git add src/core/tree.ts src/core/index.ts tests/tree.test.ts
git commit -m "feat(core): түйіндер ағашының типтері мен поза құрамасы

Transform ата-түйінге қатысты, Pose әлемде. Бұрылыс бағыты room.ts-тегі
placementCorners-пен бірдей. 1-фазада тек Y осі — X/Z Euler құрамасын
талап етеді, ол жиһазға керек емес.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `flatten.ts` — топ пен параметрлік корпус

**Files:**
- Create: `src/core/flatten.ts`
- Modify: `src/core/index.ts`
- Test: `tests/flatten.test.ts`

**Interfaces:**
- Consumes: Task 1-ден `GroupNode`, `SceneNode`, `Pose`, `walkTree`; `generateCabinet`, `generateHardware`, `Catalog`, `SettingsOverride`, `Panel`, `HardwarePlacement`
- Produces: `FlatNode`, `PlacedSolid`, `FlatScene`, `flattenTree(root: GroupNode, catalog: Catalog, settings?: SettingsOverride): FlatScene`, `scenePanels(scene: FlatScene): Panel[]`

- [x] **Step 1: Тестті жаз**

`tests/flatten.test.ts`:

```ts
/**
 * АҒАШТЫҢ ЖАЙЫЛУЫ.
 *
 * Басты талап: `cabinet` түйіні `generateCabinet`-тің нәтижесін СОЛ КҮЙІНДЕ
 * береді. Панельдер түйіннің ЛОКАЛ кеңістігінде қалады, ал әлемдегі орны
 * бөлек `pose` болып шығады — өндірістік тізбек орынды қарамайды, 3D қарайды.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, flattenTree, generateCabinet, scenePanels, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, GroupNode, SceneNode, Transform } from '../src/core/index'

const tr = (x = 0, y = 0, z = 0, rotY = 0): Transform =>
  ({ pos: { x, y, z }, rot: { x: 0, y: rotY, z: 0 } })

const cab = (): CabinetConfig =>
  templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const cabinetNode = (id: string, config: CabinetConfig, transform: Transform): SceneNode =>
  ({ kind: 'cabinet', id, name: config.name, transform, config })

const root = (children: SceneNode[], transform = tr()): GroupNode =>
  ({ kind: 'group', id: 'root', name: 'Жоба', transform, children })

describe('flattenTree — корпус түйіні', () => {
  it('generateCabinet-тің панельдерін сол күйінде береді', () => {
    const config = cab()
    const scene = flattenTree(root([cabinetNode('c1', config, tr())]), SEED_CATALOG)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0]!.panels).toEqual(generateCabinet(config, SEED_CATALOG))
  })

  it('фурнитураны да береді', () => {
    const scene = flattenTree(root([cabinetNode('c1', cab(), tr())]), SEED_CATALOG)
    expect(scene.nodes[0]!.hardware.length).toBeGreaterThan(0)
  })

  it('панельдің орны ЛОКАЛ қалады — поза бөлек', () => {
    const config = cab()
    const scene = flattenTree(root([cabinetNode('c1', config, tr(2000, 0, 500))]), SEED_CATALOG)
    const local = generateCabinet(config, SEED_CATALOG)
    expect(scene.nodes[0]!.panels[0]!.position).toEqual(local[0]!.position)
    expect(scene.nodes[0]!.pose.position).toEqual({ x: 2000, y: 0, z: 500 })
  })

  it('топтың трансформасы балаға қосылады', () => {
    const inner: GroupNode = {
      kind: 'group', id: 'g1', name: 'Қатар', transform: tr(1000, 0, 0),
      children: [cabinetNode('c1', cab(), tr(600, 0, 0))],
    }
    const scene = flattenTree(root([inner]), SEED_CATALOG)
    const node = scene.nodes.find((n) => n.nodeId === 'c1')!
    expect(node.pose.position.x).toBe(1600)
  })

  it('топтың өзі FlatNode бермейді — ол тек контейнер', () => {
    const scene = flattenTree(root([cabinetNode('c1', cab(), tr())]), SEED_CATALOG)
    expect(scene.nodes.map((n) => n.nodeId)).toEqual(['c1'])
  })
})

describe('scenePanels', () => {
  it('барлық түйіннің панелін бір тізімге жинайды', () => {
    const config = cab()
    const scene = flattenTree(root([
      cabinetNode('c1', config, tr()),
      cabinetNode('c2', config, tr(600, 0, 0)),
    ]), SEED_CATALOG)
    expect(scenePanels(scene)).toHaveLength(generateCabinet(config, SEED_CATALOG).length * 2)
  })
})
```

- [x] **Step 2: Тестті жүгіртіп, құлағанын көр**

Run: `npx vitest run tests/flatten.test.ts`
Expected: FAIL — `flattenTree` экспортталмаған.

- [x] **Step 3: `src/core/flatten.ts`-ті жаз**

```ts
/**
 * АҒАШТЫҢ ЖАЙЫЛУЫ: SceneNode ағашы → панельдер мен позалар.
 *
 * Таза TypeScript (CLAUDE.md §3).
 *
 * ⚠ НЕГЕ ӘЛЕМ КООРДИНАТЫ ЕМЕС. `Panel.rotation` — `Orientation`-нан шыққан
 * Euler (ORIENT_FACING → 180, 0, −90). Оған түйіннің Y-бұрылысын қосу үшін
 * матрица керек, ал онсыз да қажеті жоқ: өндірістік тізбек (cutList,
 * pricing, nesting, dxf, cnc, labels) панельдің әлемдегі орнын ЕШҚАШАН
 * оқымайды. Орын тек 3D-ге керек, ал 3D бұрыннан позамен жұмыс істейді
 * (`placementPose` → `SceneItem.pose`).
 */
import { generateCabinet } from './generateCabinet'
import { generateHardware } from './hardware'
import { walkTree } from './tree'
import type { GroupNode, Pose, SolidSpec } from './tree'
import type { Catalog, HardwarePlacement, Panel, SettingsOverride } from './types'

export type FlatNode = {
  nodeId: string
  name: string
  /** Түйіннің ЛОКАЛ кеңістігінде */
  panels: Panel[]
  hardware: HardwarePlacement[]
  pose: Pose
}

export type PlacedSolid = {
  nodeId: string
  name: string
  spec: SolidSpec
  pose: Pose
}

export type FlatScene = { nodes: FlatNode[]; solids: PlacedSolid[] }

export function flattenTree(
  root: GroupNode,
  catalog: Catalog,
  settings?: SettingsOverride,
): FlatScene {
  const nodes: FlatNode[] = []
  const solids: PlacedSolid[] = []

  walkTree(root, (node, pose) => {
    switch (node.kind) {
      case 'group':
        // Топ — контейнер. Өзі ештеңе шығармайды, балалары шығарады.
        return
      case 'cabinet':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: generateCabinet(node.config, catalog, settings),
          hardware: generateHardware(node.config, catalog, settings),
          pose,
        })
        return
      case 'board':
        // Task 3-те толады.
        return
      case 'solid':
        solids.push({ nodeId: node.id, name: node.name, spec: node.solid, pose })
        return
    }
  })

  return { nodes, solids }
}

/** Өндірістік тізбекке берілетін жалпы тізім (орын маңызды емес). */
export function scenePanels(scene: FlatScene): Panel[] {
  return scene.nodes.flatMap((n) => n.panels)
}
```

- [x] **Step 4: `index.ts`-ке экспорт қос**

`src/core/index.ts`, `export * from './tree'` жолынан кейін:

```ts
export * from './flatten'
```

- [x] **Step 5: Тестті жүгірт**

Run: `npx vitest run tests/flatten.test.ts`
Expected: PASS — 6 тест.

- [x] **Step 6: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: бәрі өтеді.

- [x] **Step 7: Коммит**

```bash
git add src/core/flatten.ts src/core/index.ts tests/flatten.test.ts
git commit -m "feat(core): ағашты жайылту — топ пен параметрлік корпус

Панельдер түйіннің локал кеңістігінде қалады, орны бөлек Pose болып
шығады: өндірістік тізбек орынды оқымайды, ал 3D бұрыннан позамен
жұмыс істейді. Euler құрамасы жазылмайды.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `flatten.ts` — еркін тақта (`BoardNode`)

**Files:**
- Modify: `src/core/flatten.ts`
- Test: `tests/flatten.test.ts` (жаңа `describe` қосылады)

**Interfaces:**
- Consumes: Task 1-ден `BoardNode`, `BoardSpec`; `calculateCutDimensions` (`./edges`), `rotationFor` (`./geometry`), `mergeSettings` (`./constants`), `ConfigValidationError` (`./errors`)
- Produces: `flattenTree` енді `board` түйінін де өңдейді — әр `BoardNode` өз `FlatNode`-ын береді, ішінде дәл бір `Panel`

- [x] **Step 1: Тестті жаз**

`tests/flatten.test.ts` соңына қосылады:

```ts
import { ORIENT_HORIZONTAL } from '../src/core/index'
import type { BoardSpec } from '../src/core/index'

const BAND_2MM = SEED_CATALOG.edgeBands.find((b) => b.thickness === 2)!
const LDSP_16 = SEED_CATALOG.materials.find((m) => m.thickness === 16)!

const board = (over: Partial<BoardSpec> = {}): BoardSpec => ({
  materialId: LDSP_16.id,
  length: 600,
  width: 450,
  orientation: ORIENT_HORIZONTAL,
  edges: { L1: { bandId: BAND_2MM.id }, L2: null, W1: null, W2: null },
  grainAlongLength: LDSP_16.hasGrain,
  role: 'custom',
  ...over,
})

const boardNode = (id: string, spec: BoardSpec, transform: Transform): SceneNode =>
  ({ kind: 'board', id, name: 'Столешница', transform, board: spec })

describe('flattenTree — еркін тақта', () => {
  it('бір Panel береді', () => {
    const scene = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0]!.panels).toHaveLength(1)
    expect(scene.nodes[0]!.hardware).toEqual([])
  })

  it('рез өлшемі кромкадан есептеледі (§4.3)', () => {
    // L1-де 2 мм кромка → cutWidth = 450 − 2 = 448; ұзындығы тимейді.
    const panel = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.finishedLength).toBe(600)
    expect(panel.finishedWidth).toBe(450)
    expect(panel.cutLength).toBe(600)
    expect(panel.cutWidth).toBe(448)
  })

  it('0.4 мм кромка рез өлшемін ӨЗГЕРТПЕЙДІ (§4.3 minBandSubtract)', () => {
    const thin = SEED_CATALOG.edgeBands.find((b) => b.thickness === 0.4)!
    const spec = board({ edges: { L1: { bandId: thin.id }, L2: null, W1: null, W2: null } })
    const panel = flattenTree(root([boardNode('b1', spec, tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.cutWidth).toBe(450)
  })

  it('түйіннің аты — панельдің белгісі', () => {
    const panel = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG).nodes[0]!.panels[0]!
    expect(panel.label).toBe('Столешница')
    expect(panel.id).toBe('b1')
  })

  it('деталировкаға түседі', () => {
    const scene = flattenTree(root([boardNode('b1', board(), tr())]), SEED_CATALOG)
    expect(scenePanels(scene)).toHaveLength(1)
  })

  it('жоқ материал — ConfigValidationError', () => {
    const spec = board({ materialId: 'yoq-material' })
    expect(() => flattenTree(root([boardNode('b1', spec, tr())]), SEED_CATALOG))
      .toThrow(ConfigValidationError)
  })
})
```

Тест файлының жоғарғы импортына `ConfigValidationError` қосылады.

- [x] **Step 2: Тестті жүгіртіп, құлағанын көр**

Run: `npx vitest run tests/flatten.test.ts`
Expected: FAIL — `scene.nodes` бос (`board` тармағы әлі бос), «expected length 1, received 0».

- [x] **Step 3: `flatten.ts`-ке `boardPanel` қос**

`src/core/flatten.ts` жоғарғы импорттарына:

```ts
import { mergeSettings } from './constants'
import { calculateCutDimensions } from './edges'
import { ConfigValidationError } from './errors'
import { rotationFor } from './geometry'
import type { BoardNode } from './tree'
import type { ConstructionSettings, EdgeBand } from './types'
```

`flattenTree`-тің алдына:

```ts
/**
 * Еркін тақта → деталь.
 *
 * Орны {0,0,0}: түйіннің ЛОКАЛ басы тақтаның өз басы. Әлемдегі орны
 * `FlatNode.pose`-та.
 */
function boardPanel(
  node: BoardNode,
  catalog: Catalog,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): Panel {
  const spec = node.board
  const material = catalog.materials.find((m) => m.id === spec.materialId)
  if (!material) {
    throw new ConfigValidationError(
      `board[${node.id}].materialId`,
      `материал табылмады: "${spec.materialId}"`,
    )
  }
  const { cutLength, cutWidth } = calculateCutDimensions(
    spec.length, spec.width, spec.edges, bands, settings,
  )
  return {
    id: node.id,
    role: spec.role,
    label: node.name,
    materialId: material.id,
    finishedLength: spec.length,
    finishedWidth: spec.width,
    cutLength,
    cutWidth,
    edges: spec.edges,
    grainAlongLength: spec.grainAlongLength,
    qty: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: rotationFor(spec.orientation),
    orientation: spec.orientation,
    note: '',
    drilling: spec.drilling ?? [],
    cutouts: spec.cutouts ?? [],
    grooves: [],
    milling: spec.milling ?? [],
    ...(spec.corners ? { corners: spec.corners } : {}),
  }
}
```

`flattenTree`-тің басына, `walkTree`-ге дейін:

```ts
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
  const merged = mergeSettings(settings)
```

`case 'board':` тармағын алмастыр:

```ts
      case 'board':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: [boardPanel(node, catalog, bands, merged)],
          hardware: [],
          pose,
        })
        return
```

- [x] **Step 4: Тестті жүгірт**

Run: `npx vitest run tests/flatten.test.ts`
Expected: PASS — 12 тест.

- [x] **Step 5: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: бәрі өтеді.

- [x] **Step 6: Коммит**

```bash
git add src/core/flatten.ts tests/flatten.test.ts
git commit -m "feat(core): еркін тақта түйіні — BoardNode → Panel

Рез өлшемі calculateCutDimensions арқылы есептеледі, BoardSpec-те
cutLength жоқ: екі ақиқат көзі болмауы керек (§4.3).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `hidden` ережесі және декор қорап

**Files:**
- Modify: `src/core/flatten.ts`
- Test: `tests/flatten.test.ts` (жаңа `describe`)

**Interfaces:**
- Consumes: Task 2, Task 3-тің бәрі
- Produces: мінез өзгереді — `hidden: true` түйін мен оның БАРЛЫҚ баласы `nodes`-қа да, `solids`-қа да түспейді. `solid` түйіні `panels`-ке ешқашан қосылмайды.

- [x] **Step 1: Тестті жаз**

`tests/flatten.test.ts` соңына:

```ts
const solidNode = (id: string, transform: Transform): SceneNode =>
  ({ kind: 'solid', id, name: 'Тоңазытқыш', transform, solid: { size: { x: 600, y: 1800, z: 600 } } })

describe('flattenTree — декор қорап', () => {
  it('деталировкаға ТҮСПЕЙДІ', () => {
    const scene = flattenTree(root([solidNode('s1', tr())]), SEED_CATALOG)
    expect(scenePanels(scene)).toEqual([])
    expect(scene.nodes).toEqual([])
  })

  it('solids тізімінде позасымен тұрады', () => {
    const scene = flattenTree(root([solidNode('s1', tr(1200, 0, 0))]), SEED_CATALOG)
    expect(scene.solids).toHaveLength(1)
    expect(scene.solids[0]!.pose.position.x).toBe(1200)
    expect(scene.solids[0]!.spec.size.y).toBe(1800)
  })
})

describe('flattenTree — hidden', () => {
  it('жасырылған корпус деталировкаға түспейді', () => {
    const node = cabinetNode('c1', cab(), tr())
    const scene = flattenTree(root([{ ...node, hidden: true }]), SEED_CATALOG)
    expect(scene.nodes).toEqual([])
  })

  it('жасырылған топтың БАЛАЛАРЫ да түспейді', () => {
    const inner: GroupNode = {
      kind: 'group', id: 'g1', name: 'Қатар', transform: tr(), hidden: true,
      children: [cabinetNode('c1', cab(), tr()), solidNode('s1', tr())],
    }
    const scene = flattenTree(root([inner]), SEED_CATALOG)
    expect(scene.nodes).toEqual([])
    expect(scene.solids).toEqual([])
  })

  it('жасырылған тақта да түспейді', () => {
    const node = boardNode('b1', board(), tr())
    const scene = flattenTree(root([{ ...node, hidden: true }]), SEED_CATALOG)
    expect(scenePanels(scene)).toEqual([])
  })

  it('көрінетін көршісі қалады', () => {
    const hiddenCab = { ...cabinetNode('c1', cab(), tr()), hidden: true }
    const scene = flattenTree(root([hiddenCab, cabinetNode('c2', cab(), tr(600, 0, 0))]), SEED_CATALOG)
    expect(scene.nodes.map((n) => n.nodeId)).toEqual(['c2'])
  })
})
```

- [x] **Step 2: Тестті жүгіртіп, құлағанын көр**

Run: `npx vitest run tests/flatten.test.ts`
Expected: FAIL — «жасырылған корпус деталировкаға түспейді» құлайды
(`walkTree` `hidden`-ды білмейді, `scene.nodes` бір элемент береді).

- [x] **Step 3: `flatten.ts`-те `hidden`-ды өңде**

`walkTree` бүкіл ағашты аралайды да, `hidden` туралы ештеңе білмейді — ол
дұрыс: аралау құралы саясат ұстамауы керек. Сондықтан сүзгі жайылтуда
тұрады. `flattenTree` ішінде `walkTree` шақыруын өзінің рекурсиясымен
алмастыр:

```ts
  const step = (node: SceneNode, parent: Pose): void => {
    // Көрінбейтін деталь деталировкаға да, сметаға да түспеуі керек:
    // әйтпесе клиент көрмеген нәрсеге ақша төлейді. Топ жасырылса —
    // балалары да жасырын, сондықтан рекурсия осы жерде тоқтайды.
    if (node.hidden === true) return
    const pose = composePose(parent, node.transform)
    switch (node.kind) {
      case 'group':
        for (const child of node.children) step(child, pose)
        return
      case 'cabinet':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: generateCabinet(node.config, catalog, settings),
          hardware: generateHardware(node.config, catalog, settings),
          pose,
        })
        return
      case 'board':
        nodes.push({
          nodeId: node.id,
          name: node.name,
          panels: [boardPanel(node, catalog, bands, merged)],
          hardware: [],
          pose,
        })
        return
      case 'solid':
        solids.push({ nodeId: node.id, name: node.name, spec: node.solid, pose })
        return
    }
  }
  step(root, ORIGIN_POSE)
```

Импорттарды түзет: `walkTree` орнына `composePose`, `ORIGIN_POSE` керек;
`SceneNode` типі де импортталады.

```ts
import { ORIGIN_POSE, composePose } from './tree'
import type { BoardNode, GroupNode, Pose, SceneNode, SolidSpec } from './tree'
```

- [x] **Step 4: Тестті жүгірт**

Run: `npx vitest run tests/flatten.test.ts`
Expected: PASS — 18 тест.

- [x] **Step 5: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: бәрі өтеді. ⚠ `tree.test.ts`-тегі `walkTree` тесттері әлі өтуі
керек — `walkTree` жойылмайды, ол ағаш бойынша іздеуге (`findNode`) және
кейінгі фазадағы UI-ға керек.

- [x] **Step 6: Коммит**

```bash
git add src/core/flatten.ts tests/flatten.test.ts
git commit -m "feat(core): декор қорап пен hidden ережесі

Көрінбейтін түйін мен оның балалары деталировкаға да, сметаға да
түспейді. solid түйіні panels-ке ешқашан қосылмайды — шекараны типтің
өзі ұстайды.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `treeFromProject.ts` — v3 жобаны ағашқа айналдыру

**Files:**
- Create: `src/core/treeFromProject.ts`
- Modify: `src/core/index.ts`
- Test: `tests/treeFromProject.test.ts`

**Interfaces:**
- Consumes: `ProjectFile`, `Placement`, `Room`, `CabinetConfig` (`./types`); `placementPose` (`./room`); Task 1-ден `GroupNode`, `CabinetNode`, `Transform`
- Produces: `treeFromProject(project: ProjectFile): GroupNode`

- [x] **Step 1: Тестті жаз**

`tests/treeFromProject.test.ts`:

```ts
/**
 * v3 ЖОБА → АҒАШ.
 *
 * Бұл — 2-фазадағы schemaVersion 4 миграциясының негізі. Талап біреу:
 * ағашқа айналдырғаннан кейін шкаф дәл сол жерде тұруы керек, әйтпесе
 * сақталған жобаның бөлмесі бұзылады.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, placementPose, templateToCabinet, treeFromProject,
} from '../src/core/index'
import type { CabinetConfig, ProjectFile } from '../src/core/index'

const cab = (id: string): CabinetConfig =>
  ({ ...templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG), id })

const project = (cabinets: CabinetConfig[], placements: ProjectFile['placements']): ProjectFile => ({
  schemaVersion: 3,
  name: 'Тест',
  materials: SEED_CATALOG.materials,
  edgeBands: SEED_CATALOG.edgeBands,
  cabinets,
  room: { width: 4000, depth: 3000, height: 2700 },
  placements,
})

describe('treeFromProject', () => {
  it('әр шкаф — түбірдің бір баласы', () => {
    const root = treeFromProject(project(
      [cab('c1'), cab('c2')],
      [{ cabinetId: 'c1', wall: 'south', offset: 0 }, { cabinetId: 'c2', wall: 'south', offset: 600 }],
    ))
    expect(root.kind).toBe('group')
    expect(root.children.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(root.children.every((c) => c.kind === 'cabinet')).toBe(true)
  })

  it('трансформа placementPose-пен ДӘЛ бірдей орын береді', () => {
    const p = project([cab('c1')], [{ cabinetId: 'c1', wall: 'east', offset: 500, elevation: 700, rotate: 15 }])
    const pose = placementPose(p.room, p.cabinets[0]!, p.placements[0]!)
    const node = treeFromProject(p).children[0]!
    expect(node.transform.pos).toEqual(pose.position)
    expect(node.transform.rot.y).toBe(pose.rotationY)
    expect(node.transform.rot.x).toBe(0)
    expect(node.transform.rot.z).toBe(0)
  })

  it('орны жоқ шкаф ағашқа кірмейді (useSceneItems-тегі сол ереже)', () => {
    const root = treeFromProject(project([cab('c1'), cab('c2')], [{ cabinetId: 'c1', wall: 'south', offset: 0 }]))
    expect(root.children.map((c) => c.id)).toEqual(['c1'])
  })

  it('түбірдің трансформасы бірлік', () => {
    const root = treeFromProject(project([], []))
    expect(root.transform).toEqual({ pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } })
  })

  it('түйіннің аты — шкафтың аты', () => {
    const root = treeFromProject(project([cab('c1')], [{ cabinetId: 'c1', wall: 'south', offset: 0 }]))
    expect(root.children[0]!.name).toBe(cab('c1').name)
  })
})
```

- [x] **Step 2: Тестті жүгіртіп, құлағанын көр**

Run: `npx vitest run tests/treeFromProject.test.ts`
Expected: FAIL — `treeFromProject` экспортталмаған.

- [x] **Step 3: `src/core/treeFromProject.ts`-ті жаз**

```ts
/**
 * v3 ЖОБА → ТҮЙІНДЕР АҒАШЫ.
 *
 * Таза TypeScript (CLAUDE.md §3).
 *
 * 1-фазада бұл функция `parseProject`-ке ЖАЛҒАНБАЙДЫ: қосымша әлі
 * `cabinets` + `placements` пішінімен жұмыс істейді. Ол 2-фазада, UI ағашқа
 * көшкенде, `schemaVersion` 4-ке көтерілгенде жалғанады. Қазір ол —
 * эквиваленттік тесттің кірісі.
 *
 * `placementPose` қабырға геометриясын бұрыннан біледі, сондықтан бұл жерде
 * қайта есептелмейді: екі жерде екі есеп болса, олар бір күні алшақтайды.
 */
import { placementPose } from './room'
import { IDENTITY_TRANSFORM } from './tree'
import type { CabinetNode, GroupNode } from './tree'
import type { ProjectFile } from './types'

export function treeFromProject(project: ProjectFile): GroupNode {
  const children: CabinetNode[] = []

  for (const cabinet of project.cabinets) {
    const placement = project.placements.find((p) => p.cabinetId === cabinet.id)
    // Орны жоқ шкаф сахнада да көрінбейді (`useSceneItems` сол ережемен
    // жүреді), сондықтан ағашқа да кірмейді.
    if (!placement) continue
    const pose = placementPose(project.room, cabinet, placement)
    children.push({
      kind: 'cabinet',
      id: cabinet.id,
      name: cabinet.name,
      transform: { pos: pose.position, rot: { x: 0, y: pose.rotationY, z: 0 } },
      config: cabinet,
    })
  }

  return {
    kind: 'group',
    id: 'root',
    name: project.name,
    transform: IDENTITY_TRANSFORM,
    children,
  }
}
```

- [x] **Step 4: `index.ts`-ке экспорт қос**

`src/core/index.ts`, `export * from './flatten'` жолынан кейін:

```ts
export * from './treeFromProject'
```

- [x] **Step 5: Тестті жүгірт**

Run: `npx vitest run tests/treeFromProject.test.ts`
Expected: PASS — 5 тест.

- [x] **Step 6: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: бәрі өтеді.

- [x] **Step 7: Коммит**

```bash
git add src/core/treeFromProject.ts src/core/index.ts tests/treeFromProject.test.ts
git commit -m "feat(core): v3 жобаны түйіндер ағашына айналдыру

Трансформа placementPose-тен алынады — қабырға геометриясы екі жерде
есептелмеуі керек. parseProject-ке әлі жалғанбайды: ол 2-фазада.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Эквиваленттік тест — 1-фазаның БАСТЫ КЕПІЛІ

**Files:**
- Test: `tests/flattenEquivalence.test.ts` (жаңа)

**Interfaces:**
- Consumes: Task 2, 3, 4, 5-тің бәрі; `SEED_SETS`, `setToProject`, `SEED_TEMPLATES`, `templateToCabinet`, `generateCabinet`, `generateHardware`, `placementPose`, `formatCutList`, `parseProject`
- Produces: жаңа код жоқ — бұл тапсырманың нәтижесі тек тест. Ол 2-фазаның қауіпсіздік торы.

Бұл тапсырманың мәні: **ағаш жолы мен ескі жол миллиметрге дейін бірдей
нәтиже береді.** Бұл дәлелденсе, 2-фазада стор ағашқа көшкенде раскрой,
смета, присадка, DXF-тің бұзылмайтынына кепілдік бар.

- [x] **Step 1: Тестті жаз**

`tests/flattenEquivalence.test.ts`:

```ts
/**
 * БАСТЫ КЕПІЛ: ағаш жолы = ескі жол.
 *
 * Ескі жол:  cabinets[] + placements[] → generateCabinet + placementPose
 * Жаңа жол:  treeFromProject → flattenTree
 *
 * Екеуі де бірдей панель, бірдей фурнитура, бірдей поза беруі керек. Бұл
 * тест өтсе — 2-фазада сторды ағашқа көшіргенде деталировка да, раскрой да,
 * смета да, присадка да, DXF те бұзылмайды.
 *
 * Тест `SEED_SETS`-тің БӘРІН аралайды: ас үй, шкаф, балалар бөлмесі —
 * әрқайсысы бірнеше модульден тұрады, қабырғасы мен бұрышы әртүрлі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, SEED_SETS, flattenTree, formatCutList, generateCabinet,
  generateHardware, placementPose, scenePanels, setToProject, treeFromProject,
} from '../src/core/index'
import type { ProjectFile } from '../src/core/index'

/**
 * `setToProject` толық ProjectFile ЕМЕС, тек { cabinets, placements } береді —
 * қалған өрістерді осында жинаймыз. Бөлме — жиынтықтың өз ең кіші бөлмесі.
 */
const projects: { name: string; project: ProjectFile }[] = SEED_SETS.map((set) => {
  const { cabinets, placements } = setToProject(set, SEED_CATALOG)
  return {
    name: set.id,
    project: {
      schemaVersion: 3,
      name: set.name,
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets,
      room: set.room,
      placements,
    },
  }
})

describe('ағаш жолы = ескі жол', () => {
  it('тексерілетін жоба бар', () => {
    expect(projects.length).toBeGreaterThan(0)
  })

  for (const { name, project } of projects) {
    describe(name, () => {
      const scene = flattenTree(treeFromProject(project), SEED_CATALOG, project.settings)

      it('түйін саны — орны бар шкаф саны', () => {
        const placed = project.cabinets.filter((c) =>
          project.placements.some((p) => p.cabinetId === c.id))
        expect(scene.nodes).toHaveLength(placed.length)
      })

      it('әр шкафтың панельдері БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          if (!node) continue
          expect(node.panels).toEqual(generateCabinet(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың фурнитурасы БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          if (!node) continue
          expect(node.hardware).toEqual(generateHardware(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың позасы placementPose-пен БІРДЕЙ', () => {
        for (const placement of project.placements) {
          const cabinet = project.cabinets.find((c) => c.id === placement.cabinetId)
          if (!cabinet) continue
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)!
          expect(node.pose).toEqual(placementPose(project.room, cabinet, placement))
        }
      })

      it('деталировка БІРДЕЙ', () => {
        const oldPanels = project.cabinets
          .filter((c) => project.placements.some((p) => p.cabinetId === c.id))
          .flatMap((c) => generateCabinet(c, SEED_CATALOG, project.settings))
        expect(formatCutList(scenePanels(scene), SEED_CATALOG))
          .toEqual(formatCutList(oldPanels, SEED_CATALOG))
      })
    })
  }
})
```

- [x] **Step 2: Тестті жүгірт**

Run: `npx vitest run tests/flattenEquivalence.test.ts`
Expected: PASS. **Құласа — 1-фазада қате бар, әрі қарай жүрме.**

Ықтимал құлау себептері және не істеу керек:
- *«позасы бірдей» құлады* → `composePose`-тағы sin/cos таңбасы `room.ts`
  `placementCorners`-пен сәйкес емес. Task 1-дің Step 3-індегі формуланы
  сөзбе-сөз тексер.
- *«панельдері бірдей» құлады* → `flattenTree`-ке `settings` берілмей тұр.
  `flattenTree(root, catalog, project.settings)` екенін тексер.
- *«түйін саны» құлады* → `treeFromProject` орны жоқ шкафты сүзбей тұр.

- [x] **Step 3: `SEED_SETS` қамтуын тексер**

Run: `npx vitest run tests/flattenEquivalence.test.ts --reporter=verbose`
Expected: әр жиын өз атымен көрінеді, барлығында 5 тест өтеді.

- [x] **Step 4: Барлық тест пен типті тексер**

Run: `npm test && npm run typecheck`
Expected: бәрі өтеді.

- [x] **Step 5: Коммит**

```bash
git add tests/flattenEquivalence.test.ts
git commit -m "test(core): ағаш жолы ескі жолға тең екенінің кепілі

SEED_SETS-тің бәрінде панель, фурнитура, поза және деталировка
салыстырылады. Бұл тест 2-фазада сторды ағашқа көшірудің қауіпсіздік
торы.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `CLAUDE.md` жаңарту және фазаны жабу

**Files:**
- Modify: `CLAUDE.md:44-49` (§1 Non-goals блогы)

**Interfaces:**
- Consumes: Task 1–6-ның бәрі
- Produces: код жоқ. Репода қарама-қайшылық қалмайды.

- [x] **Step 1: `CLAUDE.md` §1-дегі Non-goals блогын алмастыр**

Қазіргі мәтін:

```markdown
**Non-goals (do not build these unless explicitly asked):**
- Free-form / organic modelling. Everything is axis-aligned rectangular panels.
- A general CAD editor. This is a configurator with constrained parameters.
- Full room / interior design in phase 1. Room context comes later.
- CNC G-code post-processors. We export DXF + drilling data; postprocessing is downstream.
```

Жаңа мәтін:

```markdown
**Free-form editor (added 2026-09-20, explicitly requested).** The project now
has a node tree (`src/core/tree.ts`): a node is a group, a parametric cabinet,
a free board, or a decorative solid. Boards may be placed by hand anywhere in
the scene. See `docs/superpowers/specs/2026-09-20-free-form-editor-design.md`.

This does **not** relax §0.2 or §4.3. Every board is still an axis-aligned
rectangular panel, its cut size is still derived from its edge banding, and
`Panel[]` is still the single source of truth. What changed is who places the
panel, not what a panel is.

**Non-goals (do not build these unless explicitly asked):**
- Organic / curved modelling — lathed or bent parts. Nodes are boxes.
- Automatic joint detection between hand-placed boards. Drilling for a free
  board is entered by hand in `DrillEditor`; `autoJoint.ts` is a later spec.
- CNC G-code post-processors. We export DXF + drilling data; postprocessing is downstream.
```

> «Full room / interior design in phase 1» жолы алынды: бөлме (`room.ts`),
> терезе-есік және әрлеу 09-12-де жасалып қойған, яғни ол жол шындыққа
> сәйкес келмей тұр.

- [x] **Step 2: Толық тексеру**

Run: `npm test && npm run typecheck && npm run build`
Expected: барлық тест өтеді, `tsc` үнсіз, build өтеді.

- [x] **Step 3: e2e жүгірт**

Терминалдың бірінде: `npm run dev`
Екіншісінде: `npm run test:e2e`
Expected: 22/22 өтеді (2026-09-24 интеграцияда расталды).

> ⚠ Дев-сервер қосулы тұрмаса 12 тест ЖАЛҒАН құлайды. Бұл жобаның белгілі
> гочасы, сервер жүрмей тұрып e2e нәтижесін оқуға болмайды.

- [x] **Step 4: Коммит**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md §1 — еркін редактор Non-goals тізімінен шықты

Пайдаланушы 2026-09-20-да нақты сұрады, сондықтан «unless explicitly
asked» шарты орындалды. Органикалық модельдеу мен автоматты присадка
Non-goals-та қалды. «Full room design» жолы алынды — бөлме 09-12-де
жасалған.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [x] **Step 5: Фазаның қорытындысын шығар**

Run: `git log --oneline master..feat/tree-core`
Expected: 7 коммит (спек + 6 тапсырма).

1-фазаның нәтижесі: өзекте ағаш бар, ол ескі жолға тең екені дәлелденген,
қосымша бұрынғыдай жұмыс істейді, прод тиілмеген. **Бұтақ әлі
қосылмайды** — 2-фаза UI-ды ағашқа көшіргенде бірге қосылады, әйтпесе
master-де қолданылмайтын код жатады.

---

## Келесі фазалар

2–6-фазалардың жоспары бұл құжатта ЖОҚ, әрі әдейі жоқ. Себебі: 2-фаза
сторды (`store/configurator.ts`, 927 жол) және `StructureTree`-ді
қозғайды, ал оның нақты қадамдары 1-фазаның коды тұрғаннан кейін ғана
дұрыс жазылады. Әр фаза өз жоспарын алады:

| Фаза | Жоспар қашан жазылады |
|---|---|
| 2 — стор + `StructureTree` + `schemaVersion` 4 | 1-фаза біткенде |
| 3 — `BoardNode` UI | 2-фаза біткенде |
| 4 — `snap.ts` + 3D | 3-фаза біткенде |
| 5 — кітапхана | 4-фаза біткенде |
| 6 — `import:nomenclature` | 5-фаза біткенде |

Фазалардың мазмұны спектің 11-бөлімінде.
