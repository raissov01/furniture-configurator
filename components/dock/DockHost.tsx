'use client'

/**
 * Барлық панельдерді орналастыратын контейнер — докинг жүйесінің React
 * қабаты. Логиканың бәрі `layout.ts`-те (таза), бұл файл тек оны шақырады
 * және DOM/pointer оқиғаларын байланыстырады.
 *
 * PRO100-дың негізгі идеясы (docs/pro100/ui-design.md §2): панельдер
 * әдепкіде қалқымалы, пайдаланушы оларды төрт жиектің біріне сүйреп
 * бекітеді; бір жиекке бірнешеуі бекітілсе — таб болып жиналады.
 */
import * as React from 'react'
import { cn } from '@/lib/cn'
import { t as tr } from '@/lib/i18n'
import {
  activateTab,
  bringToFront,
  closePanel,
  createDockState,
  dockPanel,
  edgeAtPoint,
  moveFloating,
  openPanel,
  reflowToBounds,
  resizeFloating,
  tabsForSide,
  undockPanel,
  visibleTabsForSide,
} from './layout'
import { loadDockState, saveDockState } from './persist'
import { DockPanel } from './DockPanel'
import { usePanelDrag } from './usePanelDrag'
import type { Bounds, DockSide, DockState, FloatingRect, PanelId } from './types'
import { DOCK_SIDES } from './types'

export type DockPanelSpec = {
  id: PanelId
  title: string
  content: React.ReactNode
}

const SIDE_LABEL: Record<DockSide, string> = {
  left: 'Левый край',
  right: 'Правый край',
  top: 'Верхний край',
  bottom: 'Нижний край',
}

export function DockHost({ panels, children, initiallyClosed = [], storageKey }: {
  panels: DockPanelSpec[]
  children?: React.ReactNode
  initiallyClosed?: readonly PanelId[]
  storageKey?: string
}) {
  const panelIds = React.useMemo(() => panels.map((p) => p.id), [panels])
  const defaultState = React.useMemo(() => {
    const state = createDockState(panelIds)
    for (const id of initiallyClosed) {
      const entry = state.panels[id]
      if (entry) state.panels[id] = { ...entry, visible: false }
    }
    return state
  // Panel IDs and initial visibility are fixed for the lifetime of this host.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const byId = React.useMemo(() => new Map(panels.map((p) => [p.id, p] as const)), [panels])
  const containerRef = React.useRef<HTMLDivElement>(null)

  const [state, setState] = React.useState<DockState>(defaultState)
  const [bounds, setBounds] = React.useState<Bounds>({ width: 0, height: 0 })
  const [dropHint, setDropHint] = React.useState<DockSide | null>(null)
  // ⚠ REF ЕМЕС, СТЕЙТ: React Strict Mode (Next dev) mount эффектілерін
  // mount→cleanup→mount болып ЕКІ РЕТ шақырады. `loadedRef`-пен (ref)
  // сынап көрсек, бірінші mount-тың save-эффекті ЕСКІ (default) `state`
  // closure-мен escape болып, localStorage-ті жүктелген нақты күймен
  // ауыстырмай тұрып-ақ дефолтпен қайта басып кетеді — жарыс жағдайы
  // (race), сақталған орналасу reload сайын жоғалады. Стейт болса,
  // «жүктелді» белгісі мен жүктелген `state`-тің өзі БІР рендерде бірге
  // committed болады, сондықтан save-эффект әлі committed болмаған
  // ескі closure-мен іске қосылмайды.
  const [loaded, setLoaded] = React.useState(false)

  // Гидратациядан КЕЙІН оқимыз (Collapsible-дегі ережемен бірдей себеп):
  // сервер мен клиент бірінші кадрда бірдей болуы керек.
  React.useEffect(() => {
    setState(loadDockState(panelIds, storageKey, defaultState))
    setLoaded(true)
    // panelIds әдетте тұрақты жиын — тек бастапқы жүктемеде іске қосамыз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!loaded) return
    saveDockState(state, storageKey)
  }, [state, loaded, storageKey])

  // Талап: «терезе кішірейгенде панель экраннан шығып кетпейді».
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      setBounds(next)
      setState((s) => reflowToBounds(s, next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const attemptDock = React.useCallback((id: PanelId, point: { x: number; y: number }) => {
    const side = edgeAtPoint(point, bounds)
    if (side) setState((s) => dockPanel(s, id, side))
  }, [bounds])

  return (
    <div ref={containerRef} className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950">
      <div className="flex min-h-0 flex-1 flex-col">
        <DockZone side="top" state={state} byId={byId} bounds={bounds} dropHint={dropHint} setState={setState} setDropHint={setDropHint} />
        <div className="flex min-h-0 flex-1">
          <DockZone side="left" state={state} byId={byId} bounds={bounds} dropHint={dropHint} setState={setState} setDropHint={setDropHint} />
          <div className="relative min-w-0 flex-1 border border-neutral-800">{children}</div>
          <DockZone side="right" state={state} byId={byId} bounds={bounds} dropHint={dropHint} setState={setState} setDropHint={setDropHint} />
        </div>
        <DockZone side="bottom" state={state} byId={byId} bounds={bounds} dropHint={dropHint} setState={setState} setDropHint={setDropHint} />
      </div>

      {/* Қалқымалы қабат — үстінен жабады, тек нақты панельдер pointer events алады. */}
      <div className="pointer-events-none absolute inset-0">
        {panels.map((p) => {
          const panelState = state.panels[p.id]
          if (!panelState || panelState.placement.kind !== 'floating') return null
          const rect = panelState.placement.rect
          return (
            <FloatingPanel
              key={p.id}
              spec={p}
              rect={rect}
              visible={panelState.visible}
              z={panelState.z}
              bounds={bounds}
              containerRef={containerRef}
              onChange={(r) => setState((s) => moveFloating(s, p.id, r, bounds))}
              onResize={(size) => setState((s) => resizeFloating(s, p.id, size, bounds))}
              onClose={() => setState((s) => closePanel(s, p.id))}
              onFocus={() => setState((s) => bringToFront(s, p.id))}
              onDragging={setDropHint}
              onDropAt={(point) => attemptDock(p.id, point)}
            />
          )
        })}
      </div>

      <ClosedPanelsMenu panels={panels} state={state} onOpen={(id) => setState((s) => openPanel(s, id))} />
    </div>
  )
}

// ── Жиек аймағы (докталған панельдер + таб қатары) ──────────────────────────

function DockZone({
  side, state, byId, bounds, dropHint, setState, setDropHint,
}: {
  side: DockSide
  state: DockState
  byId: Map<PanelId, DockPanelSpec>
  bounds: Bounds
  dropHint: DockSide | null
  setState: React.Dispatch<React.SetStateAction<DockState>>
  setDropHint: (side: DockSide | null) => void
}) {
  // ⚠ order-дегі БӘРІН (ашық та, жабық та) аламыз — DockPanel DOM-да
  // қалуы үшін, тек CSS-пен жасырылады. Таб қатарында тек көрінетіндер.
  const allIds = tabsForSide(state, side)
  const visibleIds = visibleTabsForSide(state, side)
  const active = state.activeTab[side]
  const horizontal = side === 'top' || side === 'bottom'
  const isHighlighted = dropHint === side
  const hasContent = allIds.length > 0

  if (!hasContent && !isHighlighted) return null

  return (
    <div
      data-dock-zone={side}
      className={cn(
        'flex shrink-0 flex-col bg-neutral-950',
        horizontal ? 'w-full' : 'h-full',
        side === 'left' && 'border-r border-neutral-800',
        side === 'right' && 'border-l border-neutral-800',
        side === 'top' && 'border-b border-neutral-800',
        side === 'bottom' && 'border-t border-neutral-800',
        isHighlighted && 'ring-1 ring-inset ring-neutral-300',
      )}
      style={horizontal ? { minHeight: hasContent ? 180 : 32 } : { width: hasContent ? 260 : 32 }}
    >
      {hasContent ? (
        <div className="flex shrink-0 flex-wrap gap-px border-b border-neutral-800 bg-neutral-900">
          {visibleIds.map((id) => {
            const spec = byId.get(id)
            if (!spec) return null
            return (
              <button
                key={id}
                type="button"
                onClick={() => setState((s) => activateTab(s, side, id))}
                className={cn(
                  'px-2 py-1 text-[11px] uppercase tracking-wider',
                  id === active ? 'bg-neutral-950 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                {spec.title}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 p-1 text-[10px] text-neutral-500">{tr('Закрепить у края')}: {tr(SIDE_LABEL[side])}</div>
      )}

      <div className="relative min-h-0 flex-1">
        {allIds.map((id) => {
          const spec = byId.get(id)
          const panelState = state.panels[id]
          if (!spec || !panelState) return null
          return (
            <DockPanel
              key={id}
              testId={id}
              title={spec.title}
              hidden={id !== active || !panelState.visible}
              onClose={() => setState((s) => closePanel(s, id))}
              onTitlePointerDown={(e) => {
                // Докталған панельдің тақырып жолағынан сүйресе — қалқымаға шығады.
                e.preventDefault()
                const startX = e.clientX
                const startY = e.clientY
                const rect: FloatingRect = { x: startX - 60, y: startY - 12, width: 320, height: 220 }
                setState((s) => bringToFront(undockPanel(s, id, rect), id))
                const move = (ev: PointerEvent) => {
                  const moved = { ...rect, x: rect.x + (ev.clientX - startX), y: rect.y + (ev.clientY - startY) }
                  setState((s) => moveFloating(s, id, moved, bounds))
                  setDropHint(edgeAtPoint(moved, bounds))
                }
                const up = (ev: PointerEvent) => {
                  window.removeEventListener('pointermove', move)
                  window.removeEventListener('pointerup', up)
                  const point = { x: rect.x + (ev.clientX - startX), y: rect.y + (ev.clientY - startY) }
                  const nextSide = edgeAtPoint(point, bounds)
                  setDropHint(null)
                  if (nextSide) setState((s) => dockPanel(s, id, nextSide))
                }
                window.addEventListener('pointermove', move)
                window.addEventListener('pointerup', up)
              }}
            >
              {spec.content}
            </DockPanel>
          )
        })}
      </div>
    </div>
  )
}

// ── Қалқымалы панель ──────────────────────────────────────────────────────────

function FloatingPanel({
  spec, rect, visible, z, bounds, containerRef, onChange, onResize, onClose, onFocus, onDropAt, onDragging,
}: {
  spec: DockPanelSpec
  rect: FloatingRect
  visible: boolean
  z: number
  bounds: Bounds
  containerRef: React.RefObject<HTMLDivElement | null>
  onChange: (rect: FloatingRect) => void
  onResize: (size: { width: number; height: number }) => void
  onClose: () => void
  onFocus: () => void
  onDropAt: (point: { x: number; y: number }) => void
  onDragging: (side: DockSide | null) => void
}) {
  const { startMove, startResize } = usePanelDrag({
    rect,
    bounds,
    containerRef,
    onChange,
    onDropAt,
    onDragging: (point) => onDragging(point ? edgeAtPoint(point, bounds) : null),
  })
  return (
    <div className="pointer-events-auto">
      <DockPanel
        testId={spec.id}
        title={spec.title}
        floatingRect={rect}
        zIndex={z}
        hidden={!visible}
        onClose={onClose}
        onFocus={onFocus}
        onTitlePointerDown={startMove}
        onResizePointerDown={startResize}
      >
        {spec.content}
      </DockPanel>
    </div>
  )
}

// ── Жабық панельдерді қайта ашу мәзірі ───────────────────────────────────────

function ClosedPanelsMenu({
  panels, state, onOpen,
}: { panels: DockPanelSpec[]; state: DockState; onOpen: (id: PanelId) => void }) {
  const closed = panels.filter((p) => !(state.panels[p.id]?.visible ?? true))
  if (closed.length === 0) return null
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-50 flex flex-wrap gap-1">
      {closed.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          className="pointer-events-auto border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-400 hover:text-neutral-100"
        >
          {tr('Открыть')} {p.title}
        </button>
      ))}
    </div>
  )
}

export { DOCK_SIDES }
