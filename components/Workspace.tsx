'use client'

import { t as tr, tf } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, Slider } from '@/components/ui'
import { Configurator } from '@/components/Configurator'
import { TemplateGallery } from '@/components/TemplateGallery'
import { AiPanel } from '@/components/AiPanel'
import { RoomPlan } from '@/components/RoomPlan'
import { ShopSettings } from '@/components/ShopSettings'
import { ProjectMenu } from '@/components/ProjectMenu'
import { QuoteView } from '@/components/QuoteView'
import { SketchEditor } from '@/components/SketchEditor'
import { DrillEditor } from '@/components/DrillEditor'
import { CustomParts } from '@/components/CustomParts'
import { ProjectPanel } from '@/components/ProjectPanel'
import { HelpPanel } from '@/components/HelpPanel'
import { HistoryPanel } from '@/components/HistoryPanel'
import { isTyping, matchHotkey } from '@/lib/hotkeys'
import { AccountPanel } from '@/components/AccountPanel'
import { LangSwitch } from '@/components/LangSwitch'
import { AppearanceSwitch } from '@/components/AppearanceSwitch'
import { cloudEnabled } from '@/lib/cloud'
import {
  MAX_SILHOUETTE_HEIGHT, MIN_SILHOUETTE_HEIGHT, SHARE_LINK_WARN_LENGTH, shareLink,
} from '@/src/core/index'
import { ExportMenu } from '@/components/ExportMenu'
import { CutListTable } from '@/components/CutListTable'
import { usePanels } from '@/lib/usePanels'
import { useSceneItems } from '@/lib/useSceneItems'
import {
  DIMENSION_AXIS_LABEL, dimensionWarningTemplate, dimensionWarnings, mergeProjectPanels, shelfSpanWarnings,
} from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'

// R3F тек браузерде жүреді — сервер жағында рендерленбейді.
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100 dark:bg-neutral-950" />,
})

const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: tr('Фас') },
  { value: 'three-quarter', label: '3/4' },
  { value: 'inside', label: tr('Внутри') },
  { value: 'plan', label: tr('План') },
  { value: 'room', label: tr('Комната') },
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
  const hydrateProject = useConfigurator((s) => s.hydrateProject)
  const saveProjectLocally = useConfigurator((s) => s.saveProjectLocally)
  const exportProject = useConfigurator((s) => s.exportProject)
  const setQuoteOpen = useConfigurator((s) => s.setQuoteOpen)
  const setSketchOpen = useConfigurator((s) => s.setSketchOpen)
  const setDrillOpen = useConfigurator((s) => s.setDrillOpen)
  const setPartsOpen = useConfigurator((s) => s.setPartsOpen)
  const setProjectOpen = useConfigurator((s) => s.setProjectOpen)
  const setHelpOpen = useConfigurator((s) => s.setHelpOpen)
  const setHistoryOpen = useConfigurator((s) => s.setHistoryOpen)
  const viewMode = useConfigurator((s) => s.viewMode)
  const setViewMode = useConfigurator((s) => s.setViewMode)
  const showFronts = useConfigurator((s) => s.showFronts)
  const openness = useConfigurator((s) => s.openness)
  const setOpenness = useConfigurator((s) => s.setOpenness)
  const setShowFronts = useConfigurator((s) => s.setShowFronts)
  const silhouette = useConfigurator((s) => s.silhouette)
  const setSilhouette = useConfigurator((s) => s.setSilhouette)
  const projection = useConfigurator((s) => s.projection)
  const setProjection = useConfigurator((s) => s.setProjection)
  const fitCamera = useConfigurator((s) => s.fitCamera)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const setAccountOpen = useConfigurator((s) => s.setAccountOpen)

  const { panels, error, ms, stale } = usePanels(cabinet, catalog, shop.settings)
  const items = useSceneItems(room, cabinets, placements, catalog, shop.settings)

  // Генерация уақыты серверде де, браузерде де әртүрлі шығады — гидратация
  // сәйкессіздігін болдырмау үшін оны тек браузерде көрсетеміз.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Сақталған цех профилі тек браузерде оқылады: серверде оқысақ, гидратация
  // сәйкессіздігі шығады.
  useEffect(() => {
    hydrateShop()
    hydrateProject()
    // Бірінші рет ашылған браузерде бірден шкаф тұрмауы керек: алдымен
    // ЖИҺАЗДЫҢ ТҮРІН таңдау. Әйтпесе құрал «шкаф жасайтын» болып көрінеді.
    if (useConfigurator.getState().firstRun) setGalleryOpen(true)
  }, [hydrateShop, hydrateProject, setGalleryOpen])

  // Автосақтау: бетті жаңартқанда жұмыс жоғалмауы керек. Кідіріс — өріске
  // сан теріп жатқанда әр таңбаға жазбау үшін.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectLocally()
      // Тарихқа да жазамыз: автосақтау бір ғана кілтті қайта жазады да,
      // жарты сағат бұрынғы күйге қайтуға мүмкіндік қалмайды.
      pushHistory()
    }, 500)
    return () => clearTimeout(timer)
  }, [room, cabinets, placements, saveProjectLocally, pushHistory])

  // Цехтың пролёт шегі қойылмаса, бұл әрқашан бос тізім қайтарады.
  const spanWarnings = useMemo(() => shelfSpanWarnings(panels, shop), [panels, shop])

  // Габарит шектері де солай: цех қоймаса, ескерту мүлде шықпайды. Тексеру
  // БҮКІЛ жоба бойынша — жобадағы екінші корпус шектен шықса да көрінуі керек.
  const sizeWarnings = useMemo(() => dimensionWarnings(cabinets, shop), [cabinets, shop])

  // Смета БҮКІЛ жоба бойынша: цех парақты бір тапсырысқа бірге сатып алады.
  // id-лер корпустың атауымен префиксталады: бір жобадағы екі шкафта да
  // `side-left` бар, ал экспортта олар бөлек файл болуы керек.
  const projectPanels = useMemo(
    () => mergeProjectPanels(items.map((i) => ({ cabinetId: i.cabinet.id, panels: i.panels }))),
    [items],
  )
  const projectHardware = useMemo(() => items.flatMap((i) => i.hardware), [items])
  const projectName = cabinets.length === 1 ? cabinets[0]!.name : `Проект (${cabinets.length} корпуса)`
  // Монтаж корпустардың ЕНІНІҢ қосындысымен саналады.
  const moduleWidths = useMemo(() => cabinets.map((c) => c.width), [cabinets])
  const [shared, setShared] = useState<string | null>(null)
  useEffect(() => {
    if (!shared) return
    const timer = setTimeout(() => setShared(null), 5000)
    return () => clearTimeout(timer)
  }, [shared])

  /*
   * Хоткейлер. Тізім `lib/hotkeys.ts`-те — анықтама терезесі де сол тізімнен
   * құрылады, сондықтан «құжатта бар, шындықта жоқ» перне болмайды.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const hotkey = matchHotkey(e)
      if (!hotkey) return
      e.preventDefault()
      const action = hotkey.action
      switch (action.kind) {
        case 'preset': setCameraPreset(action.preset); break
        case 'fit': fitCamera(); break
        case 'viewMode':
          setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid')
          break
        case 'fronts': setShowFronts(!showFronts); break
        case 'openness': setOpenness(openness > 0 ? 0 : 1); break
        case 'projection': setProjection(projection === 'perspective' ? 'ortho' : 'perspective'); break
        case 'dimensions': setShowDimensions(!showDimensions); break
        case 'help': setHelpOpen(true); break
        case 'undo': undo(); break
        case 'redo': redo(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <TemplateGallery />
      <AiPanel />
      <RoomPlan />
      <ShopSettings />
      <SketchEditor />
      <DrillEditor panels={panels} catalog={catalog} />
      <CustomParts catalog={catalog} />
      <ProjectPanel panels={projectPanels} catalog={catalog} />
      <HelpPanel />
      <HistoryPanel />
      {cloudEnabled && <AccountPanel />}
      <QuoteView
        panels={projectPanels}
        hardware={projectHardware}
        projectName={projectName}
        moduleWidths={moduleWidths}
      />
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <Link
          href="/"
          title={tr('На главную')}
          className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <svg width="18" height="14" viewBox="0 0 26 20" aria-hidden="true">
            <rect x="0.5" y="0.5" width="25" height="19" fill="#c9a227" fillOpacity="0.85" stroke="#7c5f14" />
            <rect x="0.5" y="0.5" width="4" height="19" fill="#7c5f14" />
          </svg>
          РЕЗ
        </Link>

        <h1 className="text-sm font-semibold">
          {cabinet.name}
          <span className="ml-2 font-normal tabular-nums text-neutral-500">
            {cabinet.height} (H) × {cabinet.width} (W) × {cabinet.depth} (D)
          </span>
        </h1>

        <div className="flex items-center gap-1">
          <Button onClick={() => setGalleryOpen(true)} title={tr('Готовые шаблоны')}>{tr('Шаблоны')}</Button>
          <Button onClick={() => setAiOpen(true)} title={tr('Описать задачу словами')}>{tr('Техзадание')}</Button>
          <Button onClick={() => setSketchOpen(true)} title={tr('Нарисовать корпус мышью')}>{tr('Нарисовать')}</Button>
          <Button onClick={() => setPartsOpen(true)} title={tr('Добавить свою деталь: перемычку, царгу, столешницу')}>{tr('Детали')}</Button>
          <Button onClick={() => setProjectOpen(true)} title={tr('Материалы проекта и порядок сборки')}>{tr('Проект')}</Button>
          <Button onClick={() => setDrillOpen(true)} title={tr('Развёртка детали: добавить или убрать отверстие')}>{tr('Присадка')}</Button>
          <Button onClick={() => setRoomOpen(true)} title={tr('План комнаты и стены')}>{tr('Стены')}</Button>
          <Button onClick={() => setShopOpen(true)} title={tr('Материалы, цены и правила цеха')}>{tr('Цех')}</Button>
          <Button onClick={() => setQuoteOpen(true)} title={tr('Раскрой и стоимость по всему проекту')}>{tr('Смета')}</Button>
          {/* Раскрой — БӨЛЕК бет: цехтың станок жанындағы адамы оны басып шығарады. */}
          <Link
            href="/cut"
            title={tr('Отдельный экран раскроя: КИМ, резы, бирки')}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-300"
          >
            {tr('Раскрой')}
          </Link>
          <Button onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶</Button>
          <Button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">↷</Button>
          <Button onClick={reset}>{tr('Сброс')}</Button>
          <Button
            title={tr('Ссылка для клиента: проект едет в самой ссылке, на сервер не попадает')}
            onClick={() => {
              const link = shareLink(window.location.origin, exportProject())
              void navigator.clipboard.writeText(link).then(
                () => setShared(
                  link.length > SHARE_LINK_WARN_LENGTH
                    // Мессенджерлер ұзын сілтемені үзіп жібереді — цех оны білуі керек.
                    ? 'Ссылка скопирована, но она длинная: мессенджер может её обрезать. Надёжнее отправить файл проекта.'
                    : 'Ссылка скопирована',
                ),
                () => setShared('Не удалось скопировать — разрешите доступ к буферу обмена'),
              )
            }}
          >
            Ссылка клиенту
          </Button>
        </div>

        <ProjectMenu />

        <AppearanceSwitch />
        <LangSwitch />

        {cloudEnabled && (
          <Button onClick={() => setAccountOpen(true)} title={tr('Аккаунт и проекты в облаке')}>{tr('Аккаунт')}</Button>
        )}

        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <Button key={p.value} active={cameraPreset === p.value} onClick={() => setCameraPreset(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>

        {/* Көрініс: мөлдірлік, фасадты жасыру, проекция, кадрға сыйдыру.
            Әрқайсысының хоткейі бар — анықтамада «?» арқылы көрінеді. */}
        <div className="flex items-center gap-1">
          <Button
            active={viewMode !== 'solid'}
            title={`${tr('Прозрачность')} (T)`}
            onClick={() => setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid')}
          >
            {viewMode === 'solid' ? tr('Тело') : viewMode === 'ghost' ? tr('Полупрозрачно') : tr('Контур')}
          </Button>
          {/*
            Силуэт — масштабтың өлшемі: клиент 2400 мм-ді санмен емес,
            қасында тұрған адаммен түсінеді (`src/core/silhouette.ts`).
          */}
          <Button
            active={silhouette.on}
            title={tr('Человек рядом — для масштаба')}
            onClick={() => setSilhouette({ on: !silhouette.on })}
          >
            {tr('Рост')}
          </Button>
          {silhouette.on ? (
            <input
              type="number"
              className="w-16 rounded-md border border-neutral-300 px-1.5 py-1 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              value={silhouette.height}
              min={MIN_SILHOUETTE_HEIGHT}
              max={MAX_SILHOUETTE_HEIGHT}
              step={10}
              title={tr('Рост человека, мм')}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) setSilhouette({ height: Math.round(v) })
              }}
            />
          ) : null}
          <Button
            active={!showFronts}
            title={`${tr('Показать или скрыть фасады')} (H)`}
            onClick={() => setShowFronts(!showFronts)}
          >
            {showFronts ? tr('Фасады') : tr('Без фасадов')}
          </Button>
          {/* Ашық/жабық — клиентке көрсететін нәрсе: жабық шкаф суреттен
              айнымайды, ал ашылған есік жиһаздың ішін бірден түсіндіреді. */}
          <Button
            active={openness > 0}
            title={`${tr('Открыть или закрыть двери и ящики')} (E)`}
            onClick={() => setOpenness(openness > 0 ? 0 : 1)}
          >
            {/* «Открыть» деп атауға БОЛМАЙДЫ: жоғарыда файл ашатын
                «Открыть» тұр, ал бір панельдегі екі бірдей атау — қате
                басудың дайын себебі. */}
            {openness > 0 ? tr('Закрыть створки') : tr('Распахнуть')}
          </Button>
          <Button
            active={projection === 'ortho'}
            title={`${tr('Перспектива или ортогональная проекция')} (O)`}
            onClick={() => setProjection(projection === 'perspective' ? 'ortho' : 'perspective')}
          >
            {projection === 'perspective' ? tr('Перспектива') : tr('Орто')}
          </Button>
          <Button onClick={fitCamera} title={`${tr('Вписать в кадр')} (F)`}>{tr('В кадр')}</Button>
          <Button onClick={() => setHistoryOpen(true)} title={tr('История локальных сохранений')}>{tr('История')}</Button>
          <Button onClick={() => setHelpOpen(true)} title={tr('Горячие клавиши')}>?</Button>
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
          {stale ? <span className="ml-2 opacity-70">{tr('Показана последняя корректная модель.')}</span> : null}
        </div>
      ) : null}

      {shared ? (
        <div
          role="status"
          className="border-b border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
        >
          {shared}
        </div>
      ) : null}

      {sizeWarnings.length > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {sizeWarnings
            .map((w) =>
              // Корпустың аты бір ғана корпус болғанда артық: ол тақырыпта тұр.
              (cabinets.length > 1 ? `${w.cabinetName}: ` : '') +
              tf(dimensionWarningTemplate(w), {
                axis: tr(DIMENSION_AXIS_LABEL[w.axis]), value: w.value, limit: w.limit,
              }))
            .join('; ')}
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
