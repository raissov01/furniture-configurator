'use client'

import { t as tr, tf } from '@/lib/i18n'
import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, Dense, Menu, MenuItem, Slider } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Configurator } from '@/components/Configurator'
import { BoardProperties } from '@/components/BoardProperties'
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
import { ShareCodeDialog } from '@/components/ShareCodeDialog'
import { isTyping, matchHotkey } from '@/lib/hotkeys'
import { AccountPanel } from '@/components/AccountPanel'
import { LangSwitch } from '@/components/LangSwitch'
import { AppearanceSwitch } from '@/components/AppearanceSwitch'
import { ArButton } from '@/components/ArButton'
import { VrButton } from '@/components/VrButton'
import { Tour } from '@/components/Tour'
import { RenderPanel } from '@/components/RenderPanel'
import { cloudEnabled } from '@/lib/cloud'
import {
  MAX_SILHOUETTE_HEIGHT, MIN_SILHOUETTE_HEIGHT, SHARE_LINK_WARN_LENGTH, shareLink,
  ConfigValidationError, formatTenge, nestPanels, nestingOptionsOf, priceProject,
  boardDimensions, findNode,
} from '@/src/core/index'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { ExportMenu } from '@/components/ExportMenu'
import { CutListTable } from '@/components/CutListTable'
import { TreeDock } from '@/components/panels/TreeDock'
import { BusyOverlay, Spinner } from '@/components/BusyOverlay'
import { TouchJoystick } from '@/components/TouchJoystick'
import { isTouchDevice } from '@/lib/walkInput'
import { usePanels } from '@/lib/usePanels'
import { useTreeSceneItems } from '@/lib/useTreeSceneItems'
import { useProjectProduction } from '@/lib/useProjectProduction'
import {
  DIMENSION_AXIS_LABEL, dimensionWarningTemplate, dimensionWarnings, shelfSpanWarnings,
} from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'

// R3F тек браузерде жүреді — сервер жағында рендерленбейді.
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  // 3D кітапханасы бірнеше секунд жүктеледі: бос сұр тақта емес, «жүктелуде»
  // деген белгі — әйтпесе адам бет қатып қалды деп ойлайды (qdesign сияқты).
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-950">
      <Spinner label={tr('Загрузка 3D…')} />
    </div>
  ),
})

const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: tr('Фас') },
  { value: 'three-quarter', label: '3/4' },
  { value: 'inside', label: tr('Внутри') },
  { value: 'plan', label: tr('План') },
  { value: 'room', label: tr('Комната') },
]

/**
 * PRO100-дың АСТЫҢҒЫ ҚОЙЫНДЫ ҚАТАРЫ (docs/pro100/ui-design.md, §4 «ЕҢ
 * ҚҰНДЫСЫ»): Перспектива · Аксонометрия · План · Стена С · З · Ю · В.
 *
 * Бізде камера пресеті (`cameraPreset`) мен проекция (`projection`) БӨЛЕК
 * күй, ал PRO100-дың бір қойындысы екеуін де бірге қояды — сондықтан әр
 * қойынды осы екеуінің бір ЖҰБЫН таңдайды. «Стена …» — жаңа функция емес,
 * `src/core/room.ts`-тегі `roomWalls()` төрт қабырғасының СЫРТЫНАН қарайтын
 * элевация («Scene.tsx»-тегі `WALL_VIEW_TARGET`); компас әрпі `WallId`-мен
 * бірдей: north=С, west=З, south=Ю, east=В.
 */
const VIEW_TABS: {
  key: string
  ruLabel: string
  preset: CameraPreset
  /** Көрсетілмесе — қазіргі проекция сол күйі қалады (жоспар, мысалы). */
  projection?: 'perspective' | 'ortho'
}[] = [
  { key: 'perspective', ruLabel: 'Перспектива', preset: 'three-quarter', projection: 'perspective' },
  { key: 'axo', ruLabel: 'Аксонометрия', preset: 'three-quarter', projection: 'ortho' },
  { key: 'plan', ruLabel: 'План', preset: 'plan' },
  { key: 'wall-north', ruLabel: 'Стена С', preset: 'wall-north', projection: 'ortho' },
  { key: 'wall-west', ruLabel: 'Стена З', preset: 'wall-west', projection: 'ortho' },
  { key: 'wall-south', ruLabel: 'Стена Ю', preset: 'wall-south', projection: 'ortho' },
  { key: 'wall-east', ruLabel: 'Стена В', preset: 'wall-east', projection: 'ortho' },
]

/** C1 бюджеті: 40 панельге дейін параметр өзгерісі < 100 мс. */
const BUDGET_MS = 100

/** Деталировка тақтасы ашық па — браузерде сақталады (адамның өз ыңғайы). */
const CUT_OPEN_KEY = 'furniture-configurator:cutlist-open'

export function Workspace() {
  const cabinet = useConfigurator((s) => s.cabinets.find((entry) => entry.id === s.activeId))
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
  const galleryOpen = useConfigurator((s) => s.galleryOpen)
  const setAiOpen = useConfigurator((s) => s.setAiOpen)
  const setRoomOpen = useConfigurator((s) => s.setRoomOpen)
  const room = useConfigurator((s) => s.room)
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const projectSettings = useConfigurator((s) => s.projectSettings)
  const projectLoadError = useConfigurator((s) => s.projectLoadError)
  const historyRestoreError = useConfigurator((s) => s.historyRestoreError)
  const dismissHistoryRestoreError = useConfigurator((s) => s.dismissHistoryRestoreError)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const duplicateCabinet = useConfigurator((s) => s.duplicateCabinet)
  const mirrorCabinet = useConfigurator((s) => s.mirrorCabinet)
  const removeCabinet = useConfigurator((s) => s.removeCabinet)
  const addCabinet = useConfigurator((s) => s.addCabinet)
  const addBoard = useConfigurator((s) => s.addBoard)
  const removeBoard = useConfigurator((s) => s.removeBoard)
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
  const walk = useConfigurator((s) => s.walk)
  const setWalk = useConfigurator((s) => s.setWalk)
  const setOpenness = useConfigurator((s) => s.setOpenness)
  const setShowFronts = useConfigurator((s) => s.setShowFronts)
  const silhouette = useConfigurator((s) => s.silhouette)
  const setSilhouette = useConfigurator((s) => s.setSilhouette)
  const projection = useConfigurator((s) => s.projection)
  const setProjection = useConfigurator((s) => s.setProjection)
  const fitCamera = useConfigurator((s) => s.fitCamera)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  // Присадканы 3D-де көрсету. Әдепкіде ӨШІРУЛІ: клиентке көрсеткенде
  // тесіктер керек емес, ал цехта — керек.
  const showDrilling = useConfigurator((s) => s.showDrilling)
  const setShowDrilling = useConfigurator((s) => s.setShowDrilling)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const syncShare = useConfigurator((s) => s.syncShare)
  const setShareCodeOpen = useConfigurator((s) => s.setShareCodeOpen)
  const startShare = useConfigurator((s) => s.startShare)
  const setAccountOpen = useConfigurator((s) => s.setAccountOpen)
  const setRenderOpen = useConfigurator((s) => s.setRenderOpen)
  const assemblyStep = useConfigurator((s) => s.assemblyStep)
  const setAssemblyStep = useConfigurator((s) => s.setAssemblyStep)
  const selected = useConfigurator((s) => s.selected)
  const setSelected = useConfigurator((s) => s.setSelected)
  const openPanels = useConfigurator((s) => s.openPanels)
  const togglePanelOpen = useConfigurator((s) => s.togglePanelOpen)
  // Телефон/планшет: прогулкада джойстик пен саусақпен қарау.
  const touch = useMemo(isTouchDevice, [])

  const settings = projectSettings ?? shop.settings
  const { panels, error, ms, stale } = usePanels(cabinet, catalog, settings)
  const { scene, items, error: sceneError } = useTreeSceneItems(root, room, catalog, settings, layers)
  const production = useProjectProduction()
  const hasActiveCabinet = Boolean(cabinet)
  const activePanels = hasActiveCabinet ? panels : []
  const activeNode = findNode(root, activeId)
  const activeBoard = activeNode?.kind === 'board' ? activeNode : null
  const boardPanel = activeBoard ? production.scene.nodes.find((node) => node.nodeId === activeId)?.panels[0] : undefined
  const editableBoard = useMemo(() => {
    if (!activeBoard) return false
    try { assertTreeNodeEditable(root, activeId, layers); return true }
    catch (cause) { if (!(cause instanceof ConfigValidationError)) throw cause; return false }
  }, [root, activeId, layers, activeBoard])
  const activeEditable = useMemo(() => {
    if (!hasActiveCabinet) return false
    try {
      assertTreeNodeEditable(root, activeId, layers)
      return true
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return false
    }
  }, [root, activeId, layers, hasActiveCabinet])

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
      // Клиентке код берілген болса — оның экраны да жаңарсын (автожаңарту).
      syncShare()
    }, 500)
    return () => clearTimeout(timer)
  }, [room, root, layers, settings, catalog, cabinets, placements, saveProjectLocally, pushHistory, syncShare])

  /*
   * Кідірістегі сақтау бет ЖАБЫЛҒАНДА/АУЫСҚАНДА жоғалмауы керек.
   *
   * ⚠ 09-13: «Сброс»-тан кейін 500 мс-тық таймер 2 с ішінде де іске
   * қоспай (кадр `demand` режимінде headless Chrome таймерді кешіктірді),
   * бет ауысқан бойда жаңа күй жоғалып, ескі жоба қайта ашылатын — e2e-нің
   * үш тесті құлады. Адам үшін де сол: өрісті өзгертіп, бірден қойындыны
   * жапса, соңғы өзгеріс кететін. `pagehide` — жабылудың сенімді оқиғасы.
   */
  useEffect(() => {
    const flush = () => saveProjectLocally()
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [saveProjectLocally])

  // Цехтың пролёт шегі қойылмаса, бұл әрқашан бос тізім қайтарады.
  const spanWarnings = useMemo(() => shelfSpanWarnings(production.panels, shop), [production.panels, shop])

  // Габарит шектері де солай: цех қоймаса, ескерту мүлде шықпайды. Тексеру
  // БҮКІЛ жоба бойынша — жобадағы екінші корпус шектен шықса да көрінуі керек.
  const sizeWarnings = useMemo(() => dimensionWarnings(items.map((item) => item.cabinet), shop), [items, shop])

  // Смета БҮКІЛ жоба бойынша: цех парақты бір тапсырысқа бірге сатып алады.
  // id-лер корпустың атауымен префиксталады: бір жобадағы екі шкафта да
  // `side-left` бар, ал экспортта олар бөлек файл болуы керек.
  const projectPanels = production.panels
  const projectHardware = production.hardware
  const projectName = exportProject().name
  // Монтаж корпустардың ЕНІНІҢ қосындысымен саналады.
  const moduleWidths = production.moduleWidths

  /*
   * БАҒА ТАҚТАДА (qdesign сияқты — жоғарыда үнемі «763 490 ₸»). Бұрын баға
   * тек сметаны ашқанда көрінетін. Есеп сметамен БІР жолдан (nestPanels →
   * priceProject), сондықтан тақтадағы сан мен КП-дағы сан ажырамайды.
   * `useDeferredValue` — өріске сан теріп жатқанда раскрой есебі терудің
   * алдына түспеуі үшін (React оны бос уақытта санайды).
   */
  const deferredPanels = useDeferredValue(projectPanels)
  const liveTotal = useMemo((): { total: number } | { missing: true } | null => {
    if (production.error) return null
    try {
      const nesting = nestPanels(deferredPanels, catalog, nestingOptionsOf(shop))
      const price = priceProject(deferredPanels, nesting, shop, projectHardware, moduleWidths)
      return price.missingPrices.length > 0 ? { missing: true } : { total: price.total }
    } catch (error) {
      // Жарамсыз конфиг кезінде (теріп жатқанда) баға уақытша көрінбейді — бұл
      // қате емес: қатенің өзін тақтаның астындағы қызыл жолақ айтады.
      console.debug('Цена в тулбаре не посчитана', error)
      return null
    }
  }, [deferredPanels, catalog, shop, projectHardware, moduleWidths, production.error])
  const [shared, setShared] = useState<string | null>(null)
  const copyClientLink = async () => {
    let link: string
    if (cloudEnabled) {
      const result = await startShare()
      if (!result.ok) { setShared(result.error); return }
      link = `${window.location.origin}/view?c=${result.code}`
    } else {
      link = shareLink(window.location.origin, exportProject())
    }
    void navigator.clipboard.writeText(link).then(
      () => setShared(link.length > SHARE_LINK_WARN_LENGTH
        ? tr('Ссылка скопирована, но она длинная: мессенджер может её обрезать. Надёжнее отправить файл проекта.')
        : tr('Ссылка скопирована')),
      () => setShared(tr('Не удалось скопировать — разрешите доступ к буферу обмена')),
    )
  }

  /*
   * Деталировка — 3D-нің астындағы ЖИЫЛАТЫН тақта (09-13, qdesign сияқты
   * макет). Бұрын 460 px баған болып 3D-ні тарылтатын. Күйі браузерде
   * сақталады, гидратациядан КЕЙІН оқылады (сервер мен клиент бірдей басталсын).
   */
  const [cutOpen, setCutOpen] = useState(false)
  useEffect(() => {
    try {
      setCutOpen(window.localStorage.getItem(CUT_OPEN_KEY) === '1')
    } catch { /* жады жоқ болса — жабық қалады, қате емес */ }
  }, [])
  const toggleCut = () => {
    const next = !cutOpen
    setCutOpen(next)
    try {
      window.localStorage.setItem(CUT_OPEN_KEY, next ? '1' : '0')
    } catch { /* күй тек осы сессияда тұрады — қате емес */ }
  }
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
      // Escape — 3D-дегі таңдауды алу. Хоткейлер тізіміне кірмейді: бұл
      // «әрекет» емес, кез келген жерден шығудың әдеттегі жолы.
      if (e.key === 'Escape') {
        if (selected) { e.preventDefault(); setSelected(null) }
        return
      }
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
      {activeEditable ? <SketchEditor /> : null}
      {activeEditable || editableBoard ? <DrillEditor panels={activeBoard ? (boardPanel ? [boardPanel] : []) : activePanels} catalog={catalog} /> : null}
      {activeEditable ? <CustomParts catalog={catalog} /> : null}
      <ProjectPanel panels={projectPanels} catalog={catalog} />
      <HelpPanel />
      <HistoryPanel />
      <ShareCodeDialog />
      {cloudEnabled && <AccountPanel />}
      {!production.error ? <QuoteView
        panels={projectPanels}
        hardware={projectHardware}
        projectName={projectName}
        moduleWidths={moduleWidths}
      /> : null}
      {/*
        PRO100-ДЕГІ МӘЗІР ЖОЛАҒЫ (docs/pro100/ui-design.md, §1: «Файл · Правка ·
        Вид · Элемент · Инструменты · Справка»). Мұнда ЖАҢА ӘРЕКЕТ жоқ — әр
        пункт төмендегі `<header>`-дегі БАР батырмалар шақыратын СОЛ store
        әрекетін шақырады.

        ⚠ Ескі «Создать ▾» / «Проект ▾» мәзірлері (төменде, өзгеріссіз)
        ӘДЕЙІ ҚАЛДЫРЫЛДЫ: e2e (`scripts/e2e.mjs`-тегі `h.menu('Создать', …)`
        / `h.menu('Проект', …)`) мен оқыту турына (`Tour.tsx`,
        `[data-tour="export"]` / `[data-tour="shop"]`) нақ солардың мәтіні
        мен орны бойынша тіреледі. Бұл жолақ — ҮСТІНЕ қосылған, PRO100-ге
        таныс навигация, ескісін алмастырмайды.
      */}
      <nav className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        <Menu label={tr('Файл')} size="sm">
          <MenuItem onClick={() => setGalleryOpen(true)}>{tr('Готовые шаблоны')}</MenuItem>
          <MenuItem onClick={() => setAiOpen(true)}>{tr('Техзадание (словами)')}</MenuItem>
          <MenuItem onClick={() => setSketchOpen(true)} disabled={!activeEditable}>{tr('Нарисовать мышью')}</MenuItem>
          <MenuItem onClick={() => setPartsOpen(true)} disabled={!activeEditable}>{tr('Своя деталь')}</MenuItem>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <MenuItem
            onClick={() => {
              const file = exportProject()
              const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${file.name || 'проект'}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            {tr('Сохранить проект')}
          </MenuItem>
          {/*
            Файлды таңдау терезесі ЕКІНШІ РЕТ жазылмайды: `ProjectMenu.tsx`-тегі
            жасырын input-тың `id`-і бойынша соны басамыз (логика біреу ғана).
          */}
          <MenuItem onClick={() => document.getElementById('project-open-input')?.click()}>
            {tr('Открыть проект')}
          </MenuItem>
          {/* Экспорт та солай: `ExportMenu`-дің өз батырмасын басамыз — xlsx/csv/dxf
              логикасы (ауыр динамик импорт) бір ғана жерде қалады. */}
          <MenuItem
            onClick={() => document.querySelector<HTMLButtonElement>('[data-tour="export"] button')?.click()}
          >
            {tr('Экспорт для цеха')}
          </MenuItem>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <MenuItem
            onClick={() => void copyClientLink()}
          >
            {tr('Ссылка клиенту')}
          </MenuItem>
          <MenuItem onClick={() => setShareCodeOpen(true)}>{tr('Код для клиента')}</MenuItem>
          <MenuItem onClick={reset}>{tr('Сброс')}</MenuItem>
        </Menu>

        <Menu label={tr('Правка')} size="sm">
          <MenuItem onClick={undo} disabled={!canUndo}>
            {tr('Отменить')} <span className="ml-auto text-neutral-400">Ctrl+Z</span>
          </MenuItem>
          <MenuItem onClick={redo} disabled={!canRedo}>
            {tr('Повторить')} <span className="ml-auto text-neutral-400">Ctrl+⇧Z</span>
          </MenuItem>
          <MenuItem onClick={() => setHistoryOpen(true)}>{tr('История изменений')}</MenuItem>
        </Menu>

        <Menu label={tr('Вид')} size="sm">
          {PRESETS.map((p) => (
            <MenuItem key={p.value} active={cameraPreset === p.value} onClick={() => setCameraPreset(p.value)}>
              {p.label}
            </MenuItem>
          ))}
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            {tr('Разнести')}
            <Slider value={exploded} onChange={setExploded} />
          </label>
          <MenuItem
            active={viewMode !== 'solid'}
            onClick={() => setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid')}
          >
            {viewMode === 'solid' ? tr('Прозрачность') : viewMode === 'ghost' ? tr('Полупрозрачно') : tr('Контур')}
          </MenuItem>
          <MenuItem active={!showFronts} onClick={() => setShowFronts(!showFronts)}>
            {showFronts ? tr('Скрыть фасады') : tr('Показать фасады')}
          </MenuItem>
          <MenuItem
            active={projection === 'ortho'}
            onClick={() => setProjection(projection === 'perspective' ? 'ortho' : 'perspective')}
          >
            {projection === 'perspective' ? tr('Ортогональная проекция') : tr('Перспектива')}
          </MenuItem>
          <MenuItem active={showDimensions} onClick={() => setShowDimensions(!showDimensions)}>
            {tr('Размеры на сцене')}
          </MenuItem>
          <MenuItem active={showDrilling} onClick={() => setShowDrilling(!showDrilling)}>
            {tr('Присадка на сцене')}
          </MenuItem>
          <MenuItem onClick={fitCamera}>{tr('Вписать в кадр')}</MenuItem>
          <MenuItem active={silhouette.on} onClick={() => setSilhouette({ on: !silhouette.on })}>
            {tr('Человек для масштаба')}
          </MenuItem>
        </Menu>

        <Menu label={tr('Элемент')} size="sm">
          <MenuItem onClick={addCabinet}>{tr('Новый корпус')}</MenuItem>
          <MenuItem onClick={addBoard}>{tr('Добавить свободную доску')}</MenuItem>
          <MenuItem onClick={() => removeBoard(activeId)} disabled={!editableBoard}>{tr('Удалить доску')}</MenuItem>
          <MenuItem onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable}>{tr('Дублировать')}</MenuItem>
          <MenuItem onClick={() => mirrorCabinet(activeId)} disabled={!activeEditable}>{tr('Зеркальная копия')}</MenuItem>
          <MenuItem
            onClick={() => { removeCabinet(activeId); setSelected(null) }}
            disabled={cabinets.length < 2 || !activeEditable}
          >
            {tr('Удалить корпус')}
          </MenuItem>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <MenuItem active={openness > 0} onClick={() => setOpenness(openness > 0 ? 0 : 1)}>
            {openness > 0 ? tr('Закрыть створки') : tr('Распахнуть')}
          </MenuItem>
          <MenuItem active={assemblyStep !== null} onClick={() => setAssemblyStep(assemblyStep === null ? 1 : null)}>
            {tr('Сборка')}
          </MenuItem>
        </Menu>

        <Menu label={tr('Инструменты')} size="sm">
          <MenuItem onClick={() => setShopOpen(true)}>{tr('Цех: материалы и цены')}</MenuItem>
          <MenuItem onClick={() => setProjectOpen(true)}>{tr('Материалы и сборка')}</MenuItem>
          <MenuItem onClick={() => setQuoteOpen(true)} disabled={Boolean(production.error)}>{tr('Смета и раскрой')}</MenuItem>
          <MenuItem onClick={() => setDrillOpen(true)} disabled={!activeEditable && !editableBoard}>{tr('Присадка')}</MenuItem>
          <MenuItem onClick={() => setRoomOpen(true)}>{tr('Стены и комната')}</MenuItem>
          <MenuItem onClick={() => { window.location.href = '/cut' }}>{tr('Раскрой (отдельный экран)')}</MenuItem>
        </Menu>

        <Menu label={tr('Справка')} size="sm" align="right">
          <MenuItem onClick={() => setHelpOpen(true)}>
            {tr('Горячие клавиши')} <span className="ml-auto text-neutral-400">?</span>
          </MenuItem>
          <MenuItem onClick={() => { window.location.href = '/' }}>{tr('На главную')}</MenuItem>
        </Menu>
      </nav>

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

        {/* Тақырыпта ЖОБА; таңдалған модуль мен оның габариті — оң панельде. */}
        <h1 className="max-w-72 truncate text-sm font-semibold" title={projectName}>{projectName}</h1>

        {/*
          ТОПТАЛҒАН ТАҚТА: бұрын 30+ батырма қатар тұрып «каша» болатын. Енді
          жасау мен жоба құралдары ашылмалы мәзірге жиналды — тек жиі керегі
          көзде. Клиентке сілтеме де осында.
        */}
        <div className="flex items-center gap-1">
          <Menu label={tr('Создать')} title={tr('С чего начать корпус')}>
            <MenuItem onClick={() => setGalleryOpen(true)}>{tr('Готовые шаблоны')}</MenuItem>
            <MenuItem onClick={() => setAiOpen(true)}>{tr('Техзадание (словами)')}</MenuItem>
            <MenuItem onClick={() => setSketchOpen(true)} disabled={!activeEditable}>{tr('Нарисовать мышью')}</MenuItem>
            <MenuItem onClick={() => setPartsOpen(true)} disabled={!activeEditable}>{tr('Своя деталь')}</MenuItem>
          </Menu>
          <Menu label={tr('Проект')} title={tr('Материалы, раскрой, присадка, смета')}>
            <MenuItem onClick={() => setProjectOpen(true)}>{tr('Материалы и сборка')}</MenuItem>
            <MenuItem onClick={() => setQuoteOpen(true)} disabled={Boolean(production.error)}>{tr('Смета и раскрой')}</MenuItem>
            <MenuItem onClick={() => setDrillOpen(true)} disabled={!activeEditable && !editableBoard}>{tr('Присадка')}</MenuItem>
            <MenuItem onClick={() => setRoomOpen(true)}>{tr('Стены и комната')}</MenuItem>
            <MenuItem onClick={() => setHistoryOpen(true)}>{tr('История')}</MenuItem>
            <MenuItem onClick={() => void copyClientLink()}>{tr('Ссылка клиенту')}</MenuItem>
            {/* qdesign «3D-көріністе ашу» сияқты: 6 таңбалы код, 24 сағат, автожаңарту. */}
            <MenuItem onClick={() => setShareCodeOpen(true)}>{tr('Код для клиента')}</MenuItem>
            <MenuItem onClick={reset}>{tr('Сброс')}</MenuItem>
          </Menu>
          <Button onClick={() => setShopOpen(true)} tour="shop" title={tr('Материалы, цены и правила цеха')}>{tr('Цех')}</Button>
          {/* Раскрой — БӨЛЕК бет (цех станогы қасында ашады), сондықтан тікелей. */}
          <Link
            href="/cut"
            title={tr('Отдельный экран раскроя: КИМ, резы, бирки')}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-300"
          >
            {tr('Раскрой')}
          </Link>
          <Button onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶</Button>
          <Button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">↷</Button>
        </div>

        <ProjectMenu />

        {/* Сирек керегі оң жақта; көрініс құралдары 3D-нің өз үстіне көшті. */}
        <div className="ml-auto flex items-center gap-1">
          {/* БАҒА (qdesign сияқты): басу — смета; баға қойылмаса — цех профилі. */}
          {liveTotal ? (
            'total' in liveTotal ? (
              <Button onClick={() => setQuoteOpen(true)} title={tr('Итого клиенту — открыть смету')}>
                <span className="tabular-nums font-semibold">{formatTenge(liveTotal.total)}</span>
              </Button>
            ) : (
              <Button onClick={() => setShopOpen(true)} title={tr('Задайте цены материалов в профиле цеха')}>
                <span className="whitespace-nowrap">{tr('Цены не заданы')}</span>
              </Button>
            )
          ) : null}
          {cabinet && !production.error ? <ExportMenu cabinet={cabinet} panels={activePanels} /> : null}
          {cloudEnabled && (
            <Button onClick={() => setAccountOpen(true)} title={tr('Аккаунт и проекты в облаке')}>{tr('Аккаунт')}</Button>
          )}
          <AppearanceSwitch />
          <LangSwitch />
        </div>

        <span
          className={
            mounted && ms > BUDGET_MS
              ? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] tabular-nums text-red-800 dark:bg-red-950 dark:text-red-300'
              : 'rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-500 dark:bg-neutral-800'
          }
          title={`Бюджет: ${BUDGET_MS} мс`}
        >
          {projectPanels.length} панелей{cabinets.length > 1 ? ` · корпусов: ${cabinets.length}` : ''}{mounted ? ` · ${ms.toFixed(1)} мс` : ''}
        </span>
      </header>

      {projectLoadError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <span className="flex-1">
            {projectLoadError.includes('сақтық көшірме жазылмады')
              ? tr('Сохранённый проект не открылся. Исходный файл пока остаётся в браузере.')
              : tr('Сохранённый проект не открылся. Исходный файл сохранён отдельно.')} {projectLoadError}
          </span>
          <Button size="sm" onClick={() => setHistoryOpen(true)}>{tr('Восстановить из истории')}</Button>
          <Button size="sm" onClick={reset}>{tr('Начать новый проект')}</Button>
        </div>
      )}
      {historyRestoreError && (
        <div role="alert" className="flex items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <span className="flex-1">{historyRestoreError}</span>
          <Button size="sm" onClick={dismissHistoryRestoreError}>{tr('Закрыть')}</Button>
        </div>
      )}

      {/*
        PRO100-ДЕГІ ЕКІ ҰСАҚ БЕЛГІШЕ ҚАТАРЫ (docs/pro100/ui-design.md, §2).
        Бұрын «Рендер · Прогулка · AR · VR · Распахнуть · Сборка · Вид»
        3D көрінісінің ҮСТІНДЕ қалқып тұратын (`absolute bottom-3/top-3`) —
        енді осында, PRO100-дегідей тұрақты қатарда. Модуль КРУД-ы
        (жаңа/дубль/айна/өшіру) — аяста да қалды (астыңғы «Модуль» тобы),
        мұнда тек ЖЫЛДАМ белгіше нұсқасы.
      */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1 dark:border-neutral-800">
        <Button size="sm" onClick={addCabinet} title={tr('Новый корпус')}>+</Button>
        <Button size="sm" onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable} title={tr('Дублировать корпус')}>⧉</Button>
        <Button size="sm" onClick={() => mirrorCabinet(activeId)} disabled={!activeEditable} title={tr('Зеркальная копия')}>⇋</Button>
        <Button
          size="sm"
          onClick={() => { removeCabinet(activeId); setSelected(null) }}
          disabled={cabinets.length < 2 || !activeEditable}
          title={tr('Удалить корпус')}
        >
          ✕
        </Button>
        <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <Button size="sm" onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶</Button>
        <Button size="sm" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">↷</Button>
        <Button
          size="sm"
          active={viewMode !== 'solid'}
          onClick={() => setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid')}
          title={`${tr('Прозрачность')} (T)`}
        >
          {viewMode === 'solid' ? tr('Тело') : viewMode === 'ghost' ? tr('Полупрозрачно') : tr('Контур')}
        </Button>
        <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <Button size="sm" onClick={() => setRenderOpen(true)} title={tr('Фотореалистичная картинка для клиента')}>
          {tr('Рендер')}
        </Button>
        <Button
          size="sm"
          active={walk}
          title={tr('Пройтись внутри: WASD — идти, мышь — осмотр, E — открыть дверцы')}
          onClick={() => setWalk(!walk)}
        >
          {tr('Прогулка')}
        </Button>
        {hasActiveCabinet && !sceneError && !projectLoadError ? <ArButton /> : null}
        <VrButton />
        <Button
          size="sm"
          active={openness > 0}
          title={`${tr('Открыть или закрыть двери и ящики')} (E)`}
          onClick={() => setOpenness(openness > 0 ? 0 : 1)}
        >
          {openness > 0 ? tr('Закрыть створки') : tr('Распахнуть')}
        </Button>
        <Button
          size="sm"
          active={assemblyStep !== null}
          title={tr('Показать сборку по шагам')}
          onClick={() => setAssemblyStep(assemblyStep === null ? 1 : null)}
        >
          {tr('Сборка')}
        </Button>
        {assemblyStep !== null ? (
          <span className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              type="range"
              aria-label={tr('Показать сборку по шагам')}
              className="w-20 accent-neutral-900 dark:accent-neutral-100"
              min={1}
              max={Math.max(1, projectPanels.length)}
              value={Math.min(assemblyStep, projectPanels.length)}
              onChange={(e) => setAssemblyStep(Number(e.target.value))}
            />
            <span className="text-[10px] tabular-nums text-neutral-500">
              {Math.min(assemblyStep, projectPanels.length)} / {projectPanels.length}
            </span>
          </span>
        ) : null}
      </div>

      {/* Екінші қатар: сирек баптаулар («Вид»), силуэт биіктігі, анықтама. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1 dark:border-neutral-800">
        <Menu label={tr('Вид')} size="sm" title={tr('Прозрачность, фасады, проекция, масштаб')}>
          <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            {tr('Разнести')}
            <Slider value={exploded} onChange={setExploded} />
          </label>
          <MenuItem active={!showFronts} onClick={() => setShowFronts(!showFronts)}>
            {showFronts ? tr('Скрыть фасады') : tr('Показать фасады')}
          </MenuItem>
          <MenuItem
            active={projection === 'ortho'}
            onClick={() => setProjection(projection === 'perspective' ? 'ortho' : 'perspective')}
          >
            {projection === 'perspective' ? tr('Ортогональная проекция') : tr('Перспектива')}
          </MenuItem>
          <MenuItem active={showDimensions} onClick={() => setShowDimensions(!showDimensions)}>
            {tr('Размеры на сцене')}
          </MenuItem>
          <MenuItem active={showDrilling} onClick={() => setShowDrilling(!showDrilling)}>
            {tr('Присадка на сцене')}
          </MenuItem>
          <MenuItem onClick={fitCamera}>{tr('Вписать в кадр')}</MenuItem>
          <MenuItem active={silhouette.on} onClick={() => setSilhouette({ on: !silhouette.on })}>
            {tr('Человек для масштаба')}
          </MenuItem>
        </Menu>
        {silhouette.on ? (
          <input
            type="number"
            className="w-16 rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
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
        <Button size="sm" onClick={() => setHelpOpen(true)} title={tr('Горячие клавиши')}>?</Button>
      </div>

      {production.error ? (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {production.error}
        </div>
      ) : null}

      {hasActiveCabinet && error ? (
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

      <Tour paused={galleryOpen} />
      <BusyOverlay />
      <RenderPanel />
      {/*
        3D-де БАСЫП таңдалған деталь: цехтың сұрағы «мынау қандай деталь»
        деп басталады, ал жауап әрқашан бір жерде тұруы керек.
      */}
      {selected ? (() => {
        // Іздеу ЖОБА тізімінен: бір жобадағы екі шкафтың детальі де осында.
        const part = projectPanels.find((p) => p.id === selected)
        if (!part) return null
        return (
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <b>{part.label}</b>
            <span className="tabular-nums text-neutral-500">
              {tr('Готовый · клиент')}: {part.finishedLength}×{part.finishedWidth}
            </span>
            <span className="tabular-nums text-amber-600 dark:text-amber-400">
              {tr('Рез · цех')}: {part.cutLength}×{part.cutWidth}
            </span>
            <span className="tabular-nums text-neutral-500">
              {part.drilling.length} {tr('отв.')}
            </span>
            {part.note ? <span className="truncate text-neutral-400">{part.note}</span> : null}
            {/* Корпус әрекеттері (көшіру/айна/өшіру) енді оң панельдің астында — әрқашан көзде. */}
            <div className="ml-auto flex items-center gap-1">
              {/* Есік/ящик — осы жерден бір-бірлеп ашылады (екі рет басу да солай). */}
              {part.opening ? (
                <Button active={Boolean(openPanels[part.id])} onClick={() => togglePanelOpen(part.id)}>
                  {openPanels[part.id] ? tr('Закрыть дверцу') : tr('Открыть дверцу')}
                </Button>
              ) : null}
              <Button onClick={() => setSelected(null)}>{tr('Закрыть')}</Button>
            </div>
          </div>
        )
      })() : null}

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

      {/*
        МАКЕТ (09-13, qdesign сияқты): ортада 3D — сол жақта модульдер тізімі,
        оң жақ жоғарыда көрініс құралдары, астында жиылатын деталировка; оң
        жақта таңдалған модульдің қасиеттері мен әрекеттері. Бұрын: сол жақта
        ұзын форма, оң жақта 460 px деталировка — 3D тарылып, тақта екі қатар.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[28px_minmax(0,1fr)_340px]">
        {/*
          СОЛ ЖАҚТАҒЫ ТАР ТІК ҚҰРАЛДАР ЖОЛАҒЫ (docs/pro100/ui-design.md, §3).
          Бізде PRO100-дегідей БӨЛЕК режим жүйесі (таңдау/жылжыту курсоры)
          ЖОҚ — таңдау сахнада басу арқылы, ал орынды ауыстыру сахнадағы
          сүйреумен өзі істелінеді (`Scene.tsx`-тегі қабырғаға сүйреу).
          Сондықтан бұл жолақ жаңа режим ОЙЛАП ТАППАЙДЫ, тек бар екеуін
          көрсетеді: «Выбор» — нақты әрекет (Escape эквиваленті), «Сместить»
          — үнсіз ескерту (сахнада тартып апарыңыз), батырма емес.
          Телефонда жасырын: PRO100 макеті десктопқа арналған.
        */}
        <div className="hidden border-r border-neutral-200 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:py-1.5 dark:border-neutral-800">
          <Button
            size="sm"
            active={!selected}
            title={tr('Выбор — щёлкните по модулю в сцене, Esc — снять выделение')}
            onClick={() => setSelected(null)}
          >
            ⊙
          </Button>
          <Button size="sm" disabled title={tr('Переместить — перетащите выбранный модуль по стене прямо в 3D-сцене')}>
            ✥
          </Button>
        </div>
        <div className="flex min-h-0 flex-col">
        {/* Телефонда 3D экранның жартысынан астам: 256 px-те ештеңе көрінбейтін. */}
        <main className="relative min-h-[55vh] flex-1 lg:min-h-64" data-tour="scene">
          {/* absolute inset-0 — канвас өлшемі бірінші кадрда-ақ анық болуы үшін */}
          <div className="absolute inset-0">
            <Scene items={items} room={room} activeId={activeId} catalog={catalog} flatScene={scene} />
          </div>
          {/* Бір канондық ағаш: корпус, еркін тақта, топ және қабаттар. */}
          {walk ? null : <div className="pointer-events-auto absolute left-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] lg:w-72"><TreeDock /></div>}
          {/*
            КӨРІНІС құралдары ЖОҒАРҒЫ ЕКІ ҚАТАРҒА көшті (docs/pro100/ui-design.md,
            §2): PRO100-де олар сахнаның үстінде қалқымайды, тар белгіше
            қатарында тұрады. Бұрын осында `absolute bottom-3/top-3` тобы
            болатын («Рендер · Прогулка · AR · VR · Распахнуть · Сборка · Вид») —
            енді төмендегі `<header>`-ден кейінгі екі қатарда.
          */}
          {walk ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              {/* Жалпақ: тұтас түс, blur жоқ (пайдаланушының дизайн ережесі). */}
              <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900/90 px-4 py-2 text-xs text-white">
                <span>{touch
                  ? tr('Джойстик — идти · проведите пальцем — осмотр · коснитесь дверцы — открыть')
                  : tr('Кликните для обзора · WASD — идти · E — дверцы · Esc — курсор')}</span>
                <button
                  type="button"
                  className="rounded-full bg-white/15 px-2.5 py-1 hover:bg-white/25"
                  onClick={() => setWalk(false)}
                >
                  {tr('Выйти')}
                </button>
              </div>
            </div>
          ) : null}
          {/* Телефонда прогулканың жүрісі — джойстик (перне жоқ). */}
          {walk && touch ? <TouchJoystick /> : null}
        </main>
        {/*
          АСТЫҢҒЫ КӨРІНІС ҚОЙЫНДЫЛАРЫ (docs/pro100/ui-design.md, §4 — «ЕҢ
          ҚҰНДЫСЫ»): Перспектива · Аксонометрия · План · Стена С · З · Ю · В.
          Соңғы төртеуі — БАР бөлме қабырғаларының (`src/core/room.ts`,
          `WallId`) сыртынан қарайтын элевация (`Scene.tsx`-тегі
          `WALL_VIEW_TARGET`), жаңа камера пресеттері. `cameraPreset` мен
          `projection` бөлек күй болғандықтан, әр қойынды екеуінің де жұбын
          қояды — активтілік те содан есептеледі.
        */}
        <div
          className="flex items-center gap-0.5 overflow-x-auto border-t border-neutral-200 bg-neutral-50 px-1 py-1 dark:border-neutral-800 dark:bg-neutral-900"
          data-tour="viewtabs"
        >
          {VIEW_TABS.map((v) => {
            const isActive = cameraPreset === v.preset && (v.projection === undefined || projection === v.projection)
            return (
              <Button
                key={v.key}
                size="sm"
                active={isActive}
                onClick={() => {
                  setCameraPreset(v.preset)
                  if (v.projection) setProjection(v.projection)
                }}
              >
                {tr(v.ruLabel)}
              </Button>
            )
          })}
        </div>
        <section
          className={cn('border-t border-neutral-200 dark:border-neutral-800', cutOpen && 'h-72')}
          data-tour="cutlist"
        >
          <CutListTable panels={projectPanels} catalog={catalog} collapsed={!cutOpen} onToggle={toggleCut} />
        </section>
        </div>
        <aside className="flex min-h-0 flex-col border-l border-neutral-200 dark:border-neutral-800">
          {/* Қай модуль өңделіп жатыр — панельдің басында, қатесіз оқылатындай. */}
          <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              {tr('Модуль')}
              {cabinet && cabinets.length > 1
                ? ` ${String(cabinets.findIndex((c) => c.id === activeId) + 1).padStart(2, '0')} / ${cabinets.length}`
                : ''}
            </div>
            {cabinet ? <>
              <div className="truncate text-sm font-semibold" title={cabinet.name}>{cabinet.name}</div>
              <div className="text-[11px] tabular-nums text-neutral-500">
                {cabinet.height} (H) × {cabinet.width} (W) × {cabinet.depth} (D)
              </div>
            </> : activeBoard ? <>
              <div className="truncate text-sm font-semibold" title={activeBoard.name}>{activeBoard.name}</div>
              {catalog.materials.find((item) => item.id === activeBoard.board.materialId) && (() => {
                const size = boardDimensions(activeBoard.board, catalog.materials.find((item) => item.id === activeBoard.board.materialId)!)
                return <div className="text-[11px] tabular-nums text-neutral-500">{size.height} (H) × {size.width} (W) × {size.depth} (D)</div>
              })()}
            </> : <div className="text-sm text-neutral-500">{tr('Выберите корпус в структуре проекта')}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <Dense>
              {/*
                МОДУЛЬДІҢ ОРНЫ (qdesign «Модуль орны, мм»: X/Y/Z, Бұрылыс) енді
                Configurator-дың ІШІНДЕ, «Общее» қосымшасында — PRO100-дың
                «бәрі бір терезеде» идеясы бойынша (docs/pro100/ui-design.md).
                Бұрын осында бөлек Collapsible еді.
              */}
              {hasActiveCabinet ? (
                <fieldset disabled={!activeEditable}>
                  <Configurator invalidField={error?.field ?? null} panels={activePanels} />
                </fieldset>
              ) : activeBoard ? (
                <fieldset disabled={!editableBoard}>
                  <BoardProperties key={activeBoard.id} node={activeBoard} panel={boardPanel} catalog={catalog} />
                </fieldset>
              ) : null}
            </Dense>
          </div>
          {/* Корпус әрекеттері әрқашан көзде (qdesign-дің астыңғы қатары сияқты). */}
          <div className="flex flex-wrap gap-1 border-t border-neutral-200 p-2 dark:border-neutral-800">
            <Button onClick={addCabinet}>{tr('+ корпус')}</Button>
            <Button onClick={addBoard}>{tr('+ доска')}</Button>
            {activeBoard && <Button onClick={() => removeBoard(activeId)} disabled={!editableBoard}>{tr('Удалить доску')}</Button>}
            <Button onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable} title={tr('Дублировать корпус')}>{tr('Дублировать')}</Button>
            <Button onClick={() => mirrorCabinet(activeId)} disabled={!activeEditable} title={tr('Зеркальная копия')}>{tr('Зеркало')}</Button>
            <Button
              onClick={() => { removeCabinet(activeId); setSelected(null) }}
              disabled={cabinets.length < 2 || !activeEditable}
              title={tr('Удалить корпус')}
            >
              {tr('Удалить')}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
