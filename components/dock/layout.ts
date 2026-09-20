/**
 * Докинг жүйесінің таза логикасы. React, DOM, three.js импорты ЖОҚ —
 * CLAUDE.md §3 талабы: логика таза қабатта, React тек көрсетеді. Осының
 * арқасында бұл файл `tests/dockLayout.test.ts`-те React/DOM орнатпай-ақ
 * толық юнит-тестпен қорғалады.
 */
import {
  DEFAULT_FLOATING_SIZE,
  DOCK_SIDES,
  MIN_FLOATING_SIZE,
} from './types'
import type {
  Bounds,
  DockSide,
  DockState,
  FloatingRect,
  PanelId,
  PanelPlacement,
  PanelState,
} from './types'

// ── Әдепкі орналасу ──────────────────────────────────────────────────────────

/** Жаңа панельдер бір-бірінің үстіне дәл түспес үшін сатылап ысырылады. */
const CASCADE_STEP = 24
const CASCADE_ORIGIN = { x: 80, y: 80 }
const CASCADE_WRAP = 6

function cascadeRect(index: number): FloatingRect {
  const i = index % CASCADE_WRAP
  return {
    x: CASCADE_ORIGIN.x + i * CASCADE_STEP,
    y: CASCADE_ORIGIN.y + i * CASCADE_STEP,
    width: DEFAULT_FLOATING_SIZE.width,
    height: DEFAULT_FLOATING_SIZE.height,
  }
}

function emptyOrder(): Record<DockSide, PanelId[]> {
  return { left: [], right: [], top: [], bottom: [] }
}

/** Берілген панель идентификаторлары үшін бастапқы күй: бәрі қалқымалы. */
export function createDockState(panelIds: readonly PanelId[]): DockState {
  const panels: Record<PanelId, PanelState> = {}
  panelIds.forEach((id, i) => {
    panels[id] = { placement: { kind: 'floating', rect: cascadeRect(i) }, visible: true, z: i }
  })
  return { panels, order: emptyOrder(), activeTab: {} }
}

// ── Пішінді тексеру (localStorage-тен оқығанда қорғау үшін) ─────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isDockSide(v: unknown): v is DockSide {
  return v === 'left' || v === 'right' || v === 'top' || v === 'bottom'
}

function isFloatingRect(v: unknown): v is FloatingRect {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return isFiniteNumber(r.x) && isFiniteNumber(r.y) && isFiniteNumber(r.width) && isFiniteNumber(r.height)
}

function isPlacement(v: unknown): v is PanelPlacement {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  if (p.kind === 'floating') return isFloatingRect(p.rect)
  if (p.kind === 'docked') return isDockSide(p.side)
  return false
}

function isPanelState(v: unknown): v is PanelState {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return isPlacement(p.placement) && typeof p.visible === 'boolean' && isFiniteNumber(p.z)
}

/**
 * Сақталған күйдің пішінін тексереді. `persist.ts` осыны шақырады: пішін
 * сай келмесе (бұзылған/ескі JSON), `false` қайтарады да, шақырушы себебін
 * логқа жазып әдепкі күйге түседі (no silent catch — persist.ts-ті қара).
 */
export function isDockState(v: unknown): v is DockState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>

  if (!s.panels || typeof s.panels !== 'object') return false
  if (!Object.values(s.panels as Record<string, unknown>).every(isPanelState)) return false

  if (!s.order || typeof s.order !== 'object') return false
  const order = s.order as Record<string, unknown>
  const orderOk = DOCK_SIDES.every((side) => {
    const arr = order[side]
    return Array.isArray(arr) && arr.every((id) => typeof id === 'string')
  })
  if (!orderOk) return false

  if (!s.activeTab || typeof s.activeTab !== 'object') return false

  return true
}

/**
 * Персистелген күй мен ағымдағы белгілі панельдер тізімін салыстырады:
 * жаңа панель қосылса — әдепкі қалқымалы орынмен қосады, енді жоқ панель
 * туралы жазба тасталады. `order`/`panels` арасындағы сәйкессіздік (мыс.
 * қолмен бұзылған JSON) `order`-ді жетекші деп алып түзетіледі — бұзылған
 * жазба апаттық емес, тек сол панель қалқымаға түседі.
 */
export function mergeWithDefaults(persisted: DockState | null, panelIds: readonly PanelId[]): DockState {
  const base = createDockState(panelIds)
  if (!persisted) return base

  const known = new Set(panelIds)

  const order = emptyOrder()
  for (const side of DOCK_SIDES) {
    order[side] = (persisted.order[side] ?? []).filter((id): id is PanelId => known.has(id))
  }

  const panels: Record<PanelId, PanelState> = {}
  panelIds.forEach((id, i) => {
    panels[id] = persisted.panels[id] ?? base.panels[id]!
  })

  // order — жетекші дереккөз: докталған деп белгіленген панель өз жиегінің
  // тізімінде болуы керек, әйтпесе сәйкессіздік — қалқымаға түсіреміз.
  for (const side of DOCK_SIDES) {
    for (const id of order[side]) {
      const p = panels[id]
      if (p) panels[id] = { ...p, placement: { kind: 'docked', side } }
    }
  }
  panelIds.forEach((id, i) => {
    const p = panels[id]!
    if (p.placement.kind === 'docked' && !order[p.placement.side].includes(id)) {
      panels[id] = { ...p, placement: { kind: 'floating', rect: cascadeRect(i) } }
    }
  })

  const activeTab: Partial<Record<DockSide, PanelId>> = {}
  for (const side of DOCK_SIDES) {
    const candidate = persisted.activeTab[side]
    const first = order[side][0]
    if (candidate && order[side].includes(candidate)) {
      activeTab[side] = candidate
    } else if (first) {
      activeTab[side] = first
    }
  }

  return { panels, order, activeTab }
}

// ── Ішкі көмекшілер ───────────────────────────────────────────────────────────

function withPanel(state: DockState, id: PanelId, patch: Partial<PanelState>): DockState {
  const existing = state.panels[id]
  if (!existing) return state
  return { ...state, panels: { ...state.panels, [id]: { ...existing, ...patch } } }
}

function removeFromOrder(order: Record<DockSide, PanelId[]>, id: PanelId): Record<DockSide, PanelId[]> {
  const next = emptyOrder()
  for (const side of DOCK_SIDES) next[side] = order[side].filter((x) => x !== id)
  return next
}

function nextZ(state: DockState): number {
  let max = 0
  for (const p of Object.values(state.panels)) if (p.z > max) max = p.z
  return max + 1
}

function firstVisibleInOrder(state: DockState, side: DockSide, excluding?: PanelId): PanelId | undefined {
  return state.order[side].find((id) => id !== excluding && state.panels[id]?.visible)
}

// ── Операциялар ───────────────────────────────────────────────────────────────

/** Панельді жиекке бекітеді: сол жиектегі басқа панельдермен таб болып жиналады. */
export function dockPanel(state: DockState, id: PanelId, side: DockSide): DockState {
  if (!state.panels[id]) return state
  const order = removeFromOrder(state.order, id)
  order[side] = [...order[side], id]
  const panels = {
    ...state.panels,
    [id]: { ...state.panels[id]!, placement: { kind: 'docked', side } as const, visible: true },
  }
  return { panels, order, activeTab: { ...state.activeTab, [side]: id } }
}

/** Докталған панельді қалқымаға шығарады (тақырып жолағынан сүйреп алу). */
export function undockPanel(state: DockState, id: PanelId, rect?: FloatingRect): DockState {
  const existing = state.panels[id]
  if (!existing) return state

  const order = removeFromOrder(state.order, id)
  const activeTab = { ...state.activeTab }
  for (const side of DOCK_SIDES) {
    if (activeTab[side] === id) {
      const fallback = order[side][0]
      if (fallback) activeTab[side] = fallback
      else delete activeTab[side]
    }
  }

  const fallbackRect = existing.placement.kind === 'floating' ? existing.placement.rect : cascadeRect(0)
  const panels = {
    ...state.panels,
    [id]: { ...existing, placement: { kind: 'floating', rect: rect ?? fallbackRect } as const, z: nextZ(state) },
  }
  return { panels, order, activeTab }
}

/**
 * Панельді жабады. ⚠ Докталған панель `order`-де қалады, тек `visible`
 * жалғанға түседі — DockHost сол панельдің DockPanel-ін DOM-да ұстап,
 * тек CSS-пен жасырады (types.ts-тегі ескертуді қара).
 */
export function closePanel(state: DockState, id: PanelId): DockState {
  const existing = state.panels[id]
  if (!existing) return state
  let next = withPanel(state, id, { visible: false })
  if (existing.placement.kind === 'docked' && state.activeTab[existing.placement.side] === id) {
    const side = existing.placement.side
    const fallback = firstVisibleInOrder(next, side, id)
    const activeTab = { ...next.activeTab }
    if (fallback) activeTab[side] = fallback
    else delete activeTab[side]
    next = { ...next, activeTab }
  }
  return next
}

/** Панельді мәзірден қайта ашады: қалқымалыны алдыңғы қатарға, докталғанды белсенді табқа шығарады. */
export function openPanel(state: DockState, id: PanelId): DockState {
  const existing = state.panels[id]
  if (!existing) return state
  let next = withPanel(state, id, { visible: true })
  if (existing.placement.kind === 'floating') {
    next = withPanel(next, id, { z: nextZ(next) })
  } else {
    next = { ...next, activeTab: { ...next.activeTab, [existing.placement.side]: id } }
  }
  return next
}

/** Жиектегі белсенді табты ауыстырады. */
export function activateTab(state: DockState, side: DockSide, id: PanelId): DockState {
  if (!state.order[side].includes(id)) return state
  return withPanel({ ...state, activeTab: { ...state.activeTab, [side]: id } }, id, { visible: true })
}

export function bringToFront(state: DockState, id: PanelId): DockState {
  return withPanel(state, id, { z: nextZ(state) })
}

/** Тіктөртбұрышты контейнер өлшеміне сыйдырады — терезе кішірейгенде панель экраннан шықпайды. */
export function clampRect(rect: FloatingRect, bounds: Bounds): FloatingRect {
  const width = Math.min(Math.max(rect.width, MIN_FLOATING_SIZE.width), Math.max(MIN_FLOATING_SIZE.width, bounds.width))
  const height = Math.min(Math.max(rect.height, MIN_FLOATING_SIZE.height), Math.max(MIN_FLOATING_SIZE.height, bounds.height))
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width))
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height))
  return { x, y, width, height }
}

export function moveFloating(state: DockState, id: PanelId, rect: FloatingRect, bounds: Bounds): DockState {
  const existing = state.panels[id]
  if (!existing || existing.placement.kind !== 'floating') return state
  return withPanel(state, id, { placement: { kind: 'floating', rect: clampRect(rect, bounds) } })
}

export function resizeFloating(
  state: DockState,
  id: PanelId,
  size: { width: number; height: number },
  bounds: Bounds,
): DockState {
  const existing = state.panels[id]
  if (!existing || existing.placement.kind !== 'floating') return state
  const rect = existing.placement.rect
  return moveFloating(state, id, { ...rect, width: size.width, height: size.height }, bounds)
}

/** Терезе өлшемі өзгергенде БӘРІН жаңа шекараға қайта сыйғызады (талап: «панель экраннан шықпайды»). */
export function reflowToBounds(state: DockState, bounds: Bounds): DockState {
  const panels: Record<PanelId, PanelState> = { ...state.panels }
  for (const [id, p] of Object.entries(panels)) {
    if (p.placement.kind === 'floating') {
      panels[id] = { ...p, placement: { kind: 'floating', rect: clampRect(p.placement.rect, bounds) } }
    }
  }
  return { ...state, panels }
}

/** Жиектегі докталған панельдер реті (ашық та, жабық та — DOM тұрақтылығы үшін). */
export function tabsForSide(state: DockState, side: DockSide): PanelId[] {
  return state.order[side]
}

/** Сол жиектегі КӨРІНЕТІН табтар — таб қатарында тек осылар түйме болады. */
export function visibleTabsForSide(state: DockState, side: DockSide): PanelId[] {
  return state.order[side].filter((id) => state.panels[id]?.visible)
}

/**
 * Сүйреу кезінде тінтуір жиекке жеткенін анықтайды (докинг ұсынысы үшін).
 * Табалдырық 32px — PRO100-дың докинг ені масштабына сай.
 */
export const DOCK_EDGE_THRESHOLD = 32

export function edgeAtPoint(point: { x: number; y: number }, bounds: Bounds): DockSide | null {
  const { x, y } = point
  if (bounds.width <= 0 || bounds.height <= 0) return null
  if (x <= DOCK_EDGE_THRESHOLD) return 'left'
  if (x >= bounds.width - DOCK_EDGE_THRESHOLD) return 'right'
  if (y <= DOCK_EDGE_THRESHOLD) return 'top'
  if (y >= bounds.height - DOCK_EDGE_THRESHOLD) return 'bottom'
  return null
}
