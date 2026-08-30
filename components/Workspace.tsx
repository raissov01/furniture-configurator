'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, Slider } from '@/components/ui'
import { Configurator } from '@/components/Configurator'
import { TemplateGallery } from '@/components/TemplateGallery'
import { AiPanel } from '@/components/AiPanel'
import { RoomPlan } from '@/components/RoomPlan'
import { ShopSettings } from '@/components/ShopSettings'
import { QuoteView } from '@/components/QuoteView'
import { ExportMenu } from '@/components/ExportMenu'
import { CutListTable } from '@/components/CutListTable'
import { usePanels } from '@/lib/usePanels'
import { useSceneItems } from '@/lib/useSceneItems'
import { shelfSpanWarnings } from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'

// R3F тек браузерде жүреді — сервер жағында рендерленбейді.
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100 dark:bg-neutral-950" />,
})

const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: 'Фас' },
  { value: 'three-quarter', label: '3/4' },
  { value: 'inside', label: 'Внутри' },
  { value: 'plan', label: 'План' },
  { value: 'room', label: 'Комната' },
]

/** C1 бюджеті: 40 панельге дейін параметр өзгерісі < 100 мс. */
const BUDGET_MS = 100

export function Workspace() {
  const cabinet = useConfigurator(activeCabinet)
  const undo = useConfigurator((s) => s.undo)
  const redo = useConfigurator((s) => s.redo)
  const reset = useConfigurator((s) => s.reset)
  const canUndo = useConfigurator((s) => s.past.length > 0)
  const canRedo = useConfigurator((s) => s.future.length > 0)
  const exploded = useConfigurator((s) => s.exploded)
  const setExploded = useConfigurator((s) => s.setExploded)
  const cameraPreset = useConfigurator((s) => s.cameraPreset)
  const setCameraPreset = useConfigurator((s) => s.setCameraPreset)
  const setGalleryOpen = useConfigurator((s) => s.setGalleryOpen)
  const setAiOpen = useConfigurator((s) => s.setAiOpen)
  const setRoomOpen = useConfigurator((s) => s.setRoomOpen)
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const setShopOpen = useConfigurator((s) => s.setShopOpen)
  const hydrateShop = useConfigurator((s) => s.hydrateShop)
  const setQuoteOpen = useConfigurator((s) => s.setQuoteOpen)

  const { panels, error, ms, stale } = usePanels(cabinet, catalog, shop.settings)
  const items = useSceneItems(room, cabinets, placements, catalog, shop.settings)

  // Генерация уақыты серверде де, браузерде де әртүрлі шығады — гидратация
  // сәйкессіздігін болдырмау үшін оны тек браузерде көрсетеміз.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Сақталған цех профилі тек браузерде оқылады: серверде оқысақ, гидратация
  // сәйкессіздігі шығады.
  useEffect(() => hydrateShop(), [hydrateShop])

  // Цехтың пролёт шегі қойылмаса, бұл әрқашан бос тізім қайтарады.
  const spanWarnings = useMemo(() => shelfSpanWarnings(panels, shop), [panels, shop])

  // Смета БҮКІЛ жоба бойынша: цех парақты бір тапсырысқа бірге сатып алады.
  const projectPanels = useMemo(() => items.flatMap((i) => i.panels), [items])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <TemplateGallery />
      <AiPanel />
      <RoomPlan />
      <ShopSettings />
      <QuoteView panels={projectPanels} />
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h1 className="text-sm font-semibold">
          {cabinet.name}
          <span className="ml-2 font-normal tabular-nums text-neutral-500">
            {cabinet.height} (H) × {cabinet.width} (W) × {cabinet.depth} (D)
          </span>
        </h1>

        <div className="flex items-center gap-1">
          <Button onClick={() => setGalleryOpen(true)} title="Готовые шаблоны">Шаблоны</Button>
          <Button onClick={() => setAiOpen(true)} title="Описать задачу словами">Техзадание</Button>
          <Button onClick={() => setRoomOpen(true)} title="План комнаты и стены">Стены</Button>
          <Button onClick={() => setShopOpen(true)} title="Материалы, цены и правила цеха">Цех</Button>
          <Button onClick={() => setQuoteOpen(true)} title="Раскрой и стоимость по всему проекту">Смета</Button>
          <Button onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶</Button>
          <Button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">↷</Button>
          <Button onClick={reset}>Сброс</Button>
        </div>

        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <Button key={p.value} active={cameraPreset === p.value} onClick={() => setCameraPreset(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>

        <ExportMenu cabinet={cabinet} panels={panels} />

        <label className="flex min-w-40 flex-1 items-center gap-2 text-[11px] text-neutral-500">
          Разнести
          <Slider value={exploded} onChange={setExploded} />
        </label>

        <span
          className={
            mounted && ms > BUDGET_MS
              ? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] tabular-nums text-red-800 dark:bg-red-950 dark:text-red-300'
              : 'rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-500 dark:bg-neutral-800'
          }
          title={`Бюджет: ${BUDGET_MS} мс`}
        >
          {panels.length} панелей{cabinets.length > 1 ? ` · корпусов: ${cabinets.length}` : ''}{mounted ? ` · ${ms.toFixed(1)} мс` : ''}
        </span>
      </header>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <b className="font-mono">{error.field}</b> — {error.message.replace(`${error.field}: `, '')}
          {stale ? <span className="ml-2 opacity-70">Показана последняя корректная модель.</span> : null}
        </div>
      ) : null}

      {spanWarnings.length > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Полка длиннее предела цеха ({spanWarnings[0]!.limit} мм):{' '}
          {spanWarnings.map((w) => `${w.label} ${w.span}`).join(', ')} — поставьте перегородку.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,460px)]">
        <aside className="min-h-0 overflow-auto border-r border-neutral-200 p-3 dark:border-neutral-800">
          <Configurator invalidField={error?.field ?? null} />
        </aside>
        <main className="relative min-h-64">
          {/* absolute inset-0 — канвас өлшемі бірінші кадрда-ақ анық болуы үшін */}
          <div className="absolute inset-0">
            <Scene items={items} room={room} activeId={activeId} catalog={catalog} />
          </div>
        </main>
        <aside className="min-h-0 border-l border-neutral-200 dark:border-neutral-800">
          <CutListTable panels={panels} catalog={catalog} />
        </aside>
      </div>
    </div>
  )
}
