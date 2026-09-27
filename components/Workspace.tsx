'use client'

import { getLang, setLang, t as tr, tf } from '@/lib/i18n'
import Link from 'next/link'
import { SITE } from '@/lib/site'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, Dense, Menu, MenuItem, Slider } from '@/components/ui'
import { cn } from '@/lib/cn'
import { hasDraftErrors, updateDraftErrors } from '@/lib/numberDraft'
import { freeMirrorAvailability } from '@/lib/freeMirrorAction'
import { Configurator } from '@/components/Configurator'
import { BoardProperties } from '@/components/BoardProperties'
import { SolidProperties } from '@/components/SolidProperties'
import { PropertiesDialog } from '@/components/PropertiesDialog'
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
import { ApprovalBanner } from '@/components/ApprovalBanner'
import { isTyping, matchHotkey } from '@/lib/hotkeys'
import { AccountPanel } from '@/components/AccountPanel'
import { LangSwitch } from '@/components/LangSwitch'
import { AppearanceSwitch } from '@/components/AppearanceSwitch'
import { ArButton } from '@/components/ArButton'
import { VrButton } from '@/components/VrButton'
import { Tour } from '@/components/Tour'
import { RenderPanel } from '@/components/RenderPanel'
import { classicMenus, type ClassicCommand, type ClassicPanel } from '@/lib/classicMenu'
import { runShopExport } from '@/lib/shopExport'
import { selectShopExportPanels } from '@/lib/shopExportScope'
import { downloadProjectFile, pickProjectFile } from '@/lib/projectFile'
import { cloudEnabled } from '@/lib/cloud'
import { THEME_EVENT, chooseTheme, readTheme, saveQuality, type Theme } from '@/lib/appearance'
import {
  MAX_SILHOUETTE_HEIGHT, MIN_SILHOUETTE_HEIGHT, SHARE_LINK_WARN_LENGTH, shareLink,
  ConfigValidationError, canMirror, formatTenge, nestPanels, nestingOptionsOf, priceProject,
  boardDimensions, findNode,
} from '@/src/core/index'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { ExportMenu } from '@/components/ExportMenu'
import { CutListTable } from '@/components/CutListTable'
import { TreeDock } from '@/components/panels/TreeDock'
import { ClassicStructureWindow } from '@/components/ClassicStructureWindow'
import { ClassicIcon, type ClassicIconName } from '@/components/ClassicIcon'
import { BusyOverlay, Spinner } from '@/components/BusyOverlay'
import { TouchJoystick } from '@/components/TouchJoystick'
import { isTouchDevice } from '@/lib/walkInput'
import { usePanels } from '@/lib/usePanels'
import { useTreeSceneItems } from '@/lib/useTreeSceneItems'
import { useProjectProduction } from '@/lib/useProjectProduction'
import { productionAvailability } from '@/lib/productionAvailability'
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
const WORKSPACE_STYLE_KEY = 'furniture-configurator:workspace-style'

type ClassicToolSpec = { icon: ClassicIconName; label: string; action: () => void; disabled?: boolean; active?: boolean; id?: string }

function ClassicTool({ icon, label, action, disabled, active, id }: ClassicToolSpec) {
  return <button type="button" className="p100-icon-button" title={label} aria-label={label} aria-pressed={active || undefined}
    data-testid={id ? `classic-tool-${id}` : undefined} disabled={disabled} onClick={action}><ClassicIcon name={icon} /></button>
}

export function Workspace() {
  const cabinet = useConfigurator((s) => s.cabinets.find((entry) => entry.id === s.activeId))
  const undo = useConfigurator((s) => s.undo)
  const redo = useConfigurator((s) => s.redo)
  const reset = useConfigurator((s) => s.reset)
  const loadProject = useConfigurator((s) => s.loadProject)
  const projectInfo = useConfigurator((s) => s.projectInfo)
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
  const autoJoints = useConfigurator((s) => s.autoJoints)
  const projectSettings = useConfigurator((s) => s.projectSettings)
  const projectLoadError = useConfigurator((s) => s.projectLoadError)
  const historyRestoreError = useConfigurator((s) => s.historyRestoreError)
  const dismissHistoryRestoreError = useConfigurator((s) => s.dismissHistoryRestoreError)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const activeId = useConfigurator((s) => s.activeId)
  const duplicateCabinet = useConfigurator((s) => s.duplicateCabinet)
  const mirrorCabinet = useConfigurator((s) => s.mirrorCabinet)
  const mirrorFreeNode = useConfigurator((s) => s.mirrorFreeNode)
  const removeCabinet = useConfigurator((s) => s.removeCabinet)
  const addCabinet = useConfigurator((s) => s.addCabinet)
  const addBoard = useConfigurator((s) => s.addBoard)
  const addSolid = useConfigurator((s) => s.addSolid)
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
  const showFittings = useConfigurator((s) => s.showFittings)
  const setShowFittings = useConfigurator((s) => s.setShowFittings)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const syncShare = useConfigurator((s) => s.syncShare)
  const setShareCodeOpen = useConfigurator((s) => s.setShareCodeOpen)
  const startShare = useConfigurator((s) => s.startShare)
  const shareCode = useConfigurator((s) => s.shareSession?.code ?? null)
  const setAccountOpen = useConfigurator((s) => s.setAccountOpen)
  const setRenderOpen = useConfigurator((s) => s.setRenderOpen)
  const assemblyStep = useConfigurator((s) => s.assemblyStep)
  const setAssemblyStep = useConfigurator((s) => s.setAssemblyStep)
  const selected = useConfigurator((s) => s.selected)
  const quality = useConfigurator((s) => s.quality)
  const setQuality = useConfigurator((s) => s.setQuality)
  const snapOptions = useConfigurator((s) => s.snapOptions)
  const setSnapOptions = useConfigurator((s) => s.setSnapOptions)
  const previousSnapOptions = useRef(snapOptions)
  const setSelected = useConfigurator((s) => s.setSelected)
  const openPanels = useConfigurator((s) => s.openPanels)
  const togglePanelOpen = useConfigurator((s) => s.togglePanelOpen)
  // Телефон/планшет: прогулкада джойстик пен саусақпен қарау.
  const touch = useMemo(isTouchDevice, [])

  const settings = projectSettings ?? shop.settings
  const { panels, error, ms, stale } = usePanels(cabinet, catalog, settings)
  const { scene, items, error: sceneError } = useTreeSceneItems(root, room, catalog, settings, layers, autoJoints)
  const production = useProjectProduction()
  const hasActiveCabinet = Boolean(cabinet)
  const activePanels = hasActiveCabinet ? panels : []
  const activeNode = findNode(root, activeId)
  const activeBoard = activeNode?.kind === 'board' ? activeNode : null
  const activeSolid = activeNode?.kind === 'solid' ? activeNode : null
  const activeBoardJoint = activeBoard ? autoJoints.find((joint) => joint.boardIds.includes(activeId)) : undefined
  const boardPanel = activeBoard ? production.scene.nodes.find((node) => node.nodeId === activeId)?.panels[0] : undefined
  const editableBoard = useMemo(() => {
    if (!activeBoard) return false
    try { assertTreeNodeEditable(root, activeId, layers); return true }
    catch (cause) { if (!(cause instanceof ConfigValidationError)) throw cause; return false }
  }, [root, activeId, layers, activeBoard])
  const editableSolid = useMemo(() => {
    if (!activeSolid) return false
    try { assertTreeNodeEditable(root, activeId, layers); return true }
    catch (cause) { if (!(cause instanceof ConfigValidationError)) throw cause; return false }
  }, [root, activeId, layers, activeSolid])
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
  const freeMirrorCheck = useMemo(() => activeNode && activeNode.kind !== 'cabinet'
    ? freeMirrorAvailability(root, activeId, catalog, layers, settings) : null,
    [activeNode, root, activeId, catalog, layers, settings])
  const canMirrorSelected = cabinet ? activeEditable && canMirror(cabinet).ok : Boolean(freeMirrorCheck?.ok)
  const [mirrorError, setMirrorError] = useState<string | null>(null)
  useEffect(() => setMirrorError(null), [activeId])
  const mirrorSelected = () => {
    try {
      if (cabinet) mirrorCabinet(activeId)
      else mirrorFreeNode(activeId)
      setMirrorError(null)
    } catch (cause) {
      setMirrorError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  // Генерация уақыты серверде де, браузерде де әртүрлі шығады — гидратация
  // сәйкессіздігін болдырмау үшін оны тек браузерде көрсетеміз.
  const [classic, setClassic] = useState(true)
  const [structureOpen, setStructureOpen] = useState(false)
  const [propertiesNodeId, setPropertiesNodeId] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<{ id: string; errors: Record<string, boolean> }>({ id: activeId, errors: {} })
  const draftInvalid = draftState.id === activeId && hasDraftErrors(draftState.errors)
  const productionState = productionAvailability(production.error, draftInvalid)
  const onDraftValidityChange = (field: string, invalid: boolean) =>
    setDraftState((current) => ({ id: activeId, errors: updateDraftErrors(current.id === activeId ? current.errors : {}, field, invalid) }))
  useEffect(() => {
    try { setClassic(window.localStorage.getItem(WORKSPACE_STYLE_KEY) !== 'ours') }
    catch (cause) { console.debug('Workspace style storage unavailable', cause) }
  }, [])
  const changeStyle = (next: boolean) => {
    setClassic(next)
    try { window.localStorage.setItem(WORKSPACE_STYLE_KEY, next ? 'classic' : 'ours') }
    catch (cause) { console.debug('Workspace style storage unavailable', cause) }
  }
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      if (id) setPropertiesNodeId(id)
    }
    window.addEventListener('furniture:open-properties', open)
    return () => window.removeEventListener('furniture:open-properties', open)
  }, [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Тема браузерде сақталады — гидратациядан кейін оқимыз; header қосқышымен синхрон.
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    setTheme(readTheme())
    const onTheme = (event: Event) => setTheme((event as CustomEvent<Theme>).detail)
    window.addEventListener(THEME_EVENT, onTheme)
    return () => window.removeEventListener(THEME_EVENT, onTheme)
  }, [])

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
    if (propertiesNodeId) return
    const timer = setTimeout(() => {
      saveProjectLocally()
      // Тарихқа да жазамыз: автосақтау бір ғана кілтті қайта жазады да,
      // жарты сағат бұрынғы күйге қайтуға мүмкіндік қалмайды.
      pushHistory()
      // Клиентке код берілген болса — оның экраны да жаңарсын (автожаңарту).
      syncShare()
    }, 500)
    return () => clearTimeout(timer)
  }, [room, root, layers, autoJoints, settings, catalog, cabinets, placements, propertiesNodeId, saveProjectLocally, pushHistory, syncShare])

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
    const flush = () => { if (!propertiesNodeId) saveProjectLocally() }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [saveProjectLocally, propertiesNodeId])

  // Цехтың пролёт шегі қойылмаса, бұл әрқашан бос тізім қайтарады.
  const spanWarnings = useMemo(() => shelfSpanWarnings(production.panels, shop), [production.panels, shop])

  // Габарит шектері де солай: цех қоймаса, ескерту мүлде шықпайды. Тексеру
  // БҮКІЛ жоба бойынша — жобадағы екінші корпус шектен шықса да көрінуі керек.
  const sizeWarnings = useMemo(() => dimensionWarnings(items.map((item) => item.cabinet), shop), [items, shop])

  // Смета БҮКІЛ жоба бойынша: цех парақты бір тапсырысқа бірге сатып алады.
  // id-лер корпустың атауымен префиксталады: бір жобадағы екі шкафта да
  // `side-left` бар, ал экспортта олар бөлек файл болуы керек.
  const projectPanels = production.panels
  const pdfNode = production.scene.nodes.find((node) => node.nodeId === activeId && findNode(root, node.nodeId)?.kind === 'cabinet')
    ?? production.scene.nodes.find((node) => findNode(root, node.nodeId)?.kind === 'cabinet')
  const pdfCabinet = pdfNode ? cabinets.find((entry) => entry.id === pdfNode.nodeId) : undefined
  const pdfAssembly = pdfNode ? { nodeId: pdfNode.nodeId, panels: pdfNode.panels, nodeCount: production.scene.nodes.length } : undefined
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

  const openPanel = (panel: ClassicPanel) => {
    switch (panel) {
      case 'gallery': setGalleryOpen(true); break
      case 'ai': setAiOpen(true); break
      case 'sketch': setSketchOpen(true); break
      case 'parts': setPartsOpen(true); break
      case 'history': setHistoryOpen(true); break
      case 'shop': setShopOpen(true); break
      case 'project': setProjectOpen(true); break
      case 'quote': setQuoteOpen(true); break
      case 'drill': setDrillOpen(true); break
      case 'room': setRoomOpen(true); break
      case 'help': setHelpOpen(true); break
      case 'shareCode': setShareCodeOpen(true); break
      case 'account': setAccountOpen(true); break
    }
  }
  const [exportError, setExportError] = useState<string | null>(null)
  const runClassicCommand = (command: ClassicCommand) => {
    switch (command.type) {
      case 'open': openPanel(command.panel); break
      case 'saveProject': downloadProjectFile(exportProject()); break
      case 'openProject': pickProjectFile(loadProject); break
      case 'export':
        if (draftInvalid) break
        setExportError(null)
        void runShopExport(command.format, {
          cabinet: command.format === 'pdf' && command.scope === 'project' ? pdfCabinet : command.scope === 'cabinet' ? cabinet : undefined,
          panels: selectShopExportPanels(command.scope, command.format, activePanels, projectPanels),
          pdfAssembly: command.scope === 'project' ? pdfAssembly : undefined,
          catalog, settings, projectInfo,
          exportId: command.scope === 'project' ? 'project' : undefined,
          exportName: command.scope === 'project' ? projectName : undefined,
        })
          .catch((cause: unknown) => setExportError(cause instanceof Error ? cause.message : String(cause)))
        break
      case 'clientLink': void copyClientLink(); break
      case 'reset': reset(); break
      case 'undo': undo(); break
      case 'redo': redo(); break
      case 'preset': setCameraPreset(command.preset); break
      case 'cycleViewMode': setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid'); break
      case 'toggleFronts': setShowFronts(!showFronts); break
      case 'toggleProjection': setProjection(projection === 'perspective' ? 'ortho' : 'perspective'); break
      case 'toggleDimensions': setShowDimensions(!showDimensions); break
      case 'fittings':
        setShowDrilling(command.show === 'drilling')
        setShowFittings(command.show === 'fittings')
        break
      case 'fit': fitCamera(); break
      case 'toggleSilhouette': setSilhouette({ on: !silhouette.on }); break
      case 'addCabinet': addCabinet(); break
      case 'addBoard': addBoard(); break
      case 'addSolid': addSolid(); break
      case 'removeBoard': if (editableBoard && !activeBoardJoint) removeBoard(activeId); break
      case 'duplicate': duplicateCabinet(activeId); break
      case 'mirror': mirrorSelected(); break
      case 'removeCabinet': removeCabinet(activeId); setSelected(null); break
      case 'toggleOpen': setOpenness(openness > 0 ? 0 : 1); break
      case 'toggleAssembly': setAssemblyStep(assemblyStep === null ? 1 : null); break
      case 'navigate': window.location.href = command.href; break
      case 'theme': setTheme(command.theme); chooseTheme(command.theme); break
      case 'quality': setQuality(command.quality); saveQuality(command.quality); break
      case 'lang': setLang(command.lang); break
      case 'workspaceStyle': changeStyle(command.classic); break
    }
  }
  const menus = classicMenus({
    canUndo, canRedo, activeEditable, canMirrorSelected, editableBoard: editableBoard && !activeBoardJoint,
    canRemoveCabinet: cabinets.length >= 2 && activeEditable,
    canExport: projectPanels.length > 0 && productionState.exportsAvailable,
    canExportPdf: Boolean(pdfCabinet) && productionState.exportsAvailable,
    canExportActiveCabinet: hasActiveCabinet && productionState.exportsAvailable,
    productionError: Boolean(production.error),
    cameraPreset, viewMode, showFronts, projection, showDimensions, showDrilling, showFittings,
    silhouetteOn: silhouette.on, open: openness > 0, assembly: assemblyStep !== null,
    theme, quality, lang: getLang(),
    price: liveTotal === null ? null : 'total' in liveTotal ? { total: formatTenge(liveTotal.total) } : { missing: true },
    cloud: cloudEnabled, classic,
  })

  const classicToolRows: ClassicToolSpec[][] = classic ? [
    [
      { icon: 'new', label: tr('Новый корпус'), action: addCabinet, id: 'new' },
      { icon: 'open', label: tr('Открыть проект'), action: () => pickProjectFile(loadProject) },
      { icon: 'save', label: tr('Сохранить проект'), action: () => downloadProjectFile(exportProject()), id: 'save' },
      { icon: 'print', label: tr('Смета и раскрой'), action: () => setQuoteOpen(true), disabled: Boolean(production.error) },
      { icon: 'cut', label: tr('Раскрой'), action: () => { window.location.href = '/cut' } },
      { icon: 'copy', label: tr('Дублировать корпус'), action: () => duplicateCabinet(activeId), disabled: !activeEditable },
      { icon: 'delete', label: tr('Удалить корпус'), action: () => { removeCabinet(activeId); setSelected(null) }, disabled: cabinets.length < 2 || !activeEditable },
      { icon: 'undo', label: tr('Отменить'), action: undo, disabled: !canUndo },
      { icon: 'redo', label: tr('Повторить'), action: redo, disabled: !canRedo },
      { icon: 'settings', label: tr('Цех: материалы и цены'), action: () => setShopOpen(true) },
    ],
    [
      { icon: 'box', label: tr('Тело'), action: () => setViewMode('solid'), active: viewMode === 'solid' },
      { icon: 'wire', label: tr('Контур'), action: () => setViewMode('wire'), active: viewMode === 'wire' },
      { icon: 'eye', label: tr('Размеры на сцене'), action: () => setShowDimensions(!showDimensions), active: showDimensions },
      { icon: 'magnet', label: tr('Привязка'), action: () => {
        if (snapOptions.grid > 0 || snapOptions.tolerance > 0) {
          previousSnapOptions.current = snapOptions
          setSnapOptions({ grid: 0, tolerance: 0 })
        } else setSnapOptions(previousSnapOptions.current)
      }, active: snapOptions.grid > 0 || snapOptions.tolerance > 0 },
      { icon: 'light', label: tr('Рендер'), action: () => setRenderOpen(true) },
      { icon: 'measure', label: tr('Размеры на сцене'), action: () => setShowDimensions(!showDimensions), active: showDimensions },
      { icon: 'fit', label: tr('Вписать в кадр'), action: fitCamera },
      { icon: 'view', label: tr('Перспектива'), action: () => { setCameraPreset('three-quarter'); setProjection('perspective') } },
    ],
    [
      { icon: 'structure', label: tr('Структура'), action: () => setStructureOpen(true), active: structureOpen, id: 'structure' },
      { icon: 'layers', label: tr('Слои'), action: () => setStructureOpen(true) },
      { icon: 'library', label: tr('Библиотека'), action: () => setStructureOpen(true) },
      { icon: 'duplicate', label: tr('Дублировать корпус'), action: () => duplicateCabinet(activeId), disabled: !activeEditable },
      { icon: 'mirror', label: tr('Зеркальная копия'), action: mirrorSelected, disabled: !canMirrorSelected },
      { icon: 'assembly', label: tr('Сборка'), action: () => setAssemblyStep(assemblyStep === null ? 1 : null), active: assemblyStep !== null },
      { icon: 'board', label: tr('Добавить свободную доску'), action: addBoard },
      { icon: 'box', label: tr('Добавить декоративный блок'), action: addSolid },
      { icon: 'room', label: tr('Стены и комната'), action: () => setRoomOpen(true) },
    ],
    [
      { icon: 'render', label: tr('Рендер'), action: () => setRenderOpen(true) },
      { icon: 'quote', label: tr('Смета и раскрой'), action: () => setQuoteOpen(true), disabled: Boolean(production.error) },
      { icon: 'drill', label: tr('Присадка'), action: () => setDrillOpen(true), disabled: !activeEditable && !editableBoard },
      { icon: 'help', label: tr('Горячие клавиши'), action: () => setHelpOpen(true) },
    ],
  ] : []

  return (
    <div className={cn("flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100", classic && "p100-workspace")} data-workspace-style={classic ? "classic" : "ours"}>
      {propertiesNodeId && <PropertiesDialog nodeId={propertiesNodeId} catalog={catalog} panels={activePanels} boardPanel={boardPanel} error={error ?? null} onClose={() => { setPropertiesNodeId(null); setDraftState({ id: activeId, errors: {} }) }} />}
      <TemplateGallery />
      <AiPanel />
      <RoomPlan />
      <ShopSettings />
      {activeEditable ? <SketchEditor /> : null}
      {activeEditable || editableBoard ? <DrillEditor panels={activeBoard ? (boardPanel ? [boardPanel] : []) : activePanels} catalog={catalog} propertiesOpen={propertiesNodeId !== null} /> : null}
      {activeEditable ? <CustomParts catalog={catalog} /> : null}
      <ProjectPanel panels={projectPanels} catalog={catalog} />
      <HelpPanel />
      <HistoryPanel />
      <ShareCodeDialog />
      {cloudEnabled && <AccountPanel />}
      {!production.error ? <QuoteView
        propertiesOpen={propertiesNodeId !== null}
        panels={projectPanels}
        hardware={projectHardware}
        projectName={projectName}
        moduleWidths={moduleWidths}
      /> : null}
      {/*
        PRO100-ДЕГІ МӘЗІР ЖОЛАҒЫ (docs/pro100/ui-design.md, §1: «Файл · Правка ·
        Вид · Элемент · Инструменты · Справка»). Пункттер `lib/classicMenu.ts`-те
        деректер ретінде сипатталады, ал `runClassicCommand` оларды store
        әрекетіне ТІКЕЛЕЙ аударады.

        ⚠ Жасырын header батырмасын `.click()` етуге БОЛМАЙДЫ: классикалық
        режимде ол header `display:none`, «Файл → Экспорт для цеха» ештеңе
        ашпайтын (аудит 09-26, P0-1). Ескі «Создать ▾» / «Проект ▾» мәзірлері
        «Наш» режимі мен e2e үшін өзгеріссіз қалды.
      */}

      <nav data-tour="menubar" data-testid="classic-menubar" className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        {classic && <Link href="/" title={`${SITE.name} — ${tr('На главную')}`} className="mr-1 hidden items-center lg:inline-flex" data-testid="classic-brand">
          <img src="/brand/aismebel-mark.svg" width={16} height={16} alt={SITE.name} />
        </Link>}
        {menus.map((menu) => <Menu key={menu.id} label={tr(menu.label)} size="sm" {...(menu.align ? { align: menu.align } : {})}>
          {menu.items.map((entry, index) => {
            if (entry.kind === 'separator') return <div key={`sep-${index}`} className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
            if (entry.kind === 'heading') return <div key={entry.id} className="px-2.5 pt-1 text-[10px] uppercase tracking-wide text-neutral-500">{tr(entry.label)}</div>
            if (entry.kind === 'slider') return <label key={entry.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300">
              {tr(entry.label)}
              <Slider value={exploded} onChange={setExploded} />
            </label>
            return <MenuItem key={entry.id} active={entry.active ?? false} disabled={entry.disabled ?? false} onClick={() => runClassicCommand(entry.command)}>
              <span data-menu-item={entry.id}>{entry.raw ? entry.label : tr(entry.label)}</span>
              {entry.detail ? <span className="tabular-nums font-semibold">{entry.detail}</span> : null}
              {entry.hint ? <span className="ml-auto text-neutral-400">{entry.hint}</span> : null}

            </MenuItem>

          })}
        </Menu>)}

      </nav>

      {cloudEnabled && <ApprovalBanner code={shareCode} />}

      {classic && <div className="p100-toolbar hidden lg:block" data-testid="classic-toolbar">
        {classicToolRows.map((row, index) => <div className="p100-toolbar-row" key={index}>
          {row.map((tool) => <ClassicTool key={`${tool.icon}-${tool.label}`} {...tool} />)}
          {index === 3 && <label className="p100-toolbar-style">{tr('Рабочее место')}
            <select aria-label={tr('Стиль рабочего места')} value="classic" onChange={(event) => changeStyle(event.target.value === 'classic')}>
              <option value="classic">{tr('Классический')}</option><option value="ours">{tr('Наш')}</option>
            </select>
          </label>}
        </div>)}
      </div>}
      <header className="legacy-tools flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <Link
          href="/"
          title={tr('На главную')}
          className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {/* Бренд белгісі (бұрын «РЕЗ» — платформаның жұмыс атауы еді, режим емес). */}
          <img src="/brand/aismebel-mark.svg" width={18} height={18} alt="" aria-hidden="true" data-testid="brand-mark" />
          {SITE.name}
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
        <div className="flex min-w-0 w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto">
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
          {projectPanels.length > 0 && productionState.exportsAvailable ? <ExportMenu cabinet={cabinet ?? undefined} pdfCabinet={pdfCabinet} pdfAssembly={pdfAssembly} panels={activePanels} projectPanels={projectPanels} projectName={projectName} /> : null}
          {cloudEnabled && (
            <Button onClick={() => setAccountOpen(true)} title={tr('Аккаунт и проекты в облаке')}>{tr('Аккаунт')}</Button>
          )}
          <label className="hidden items-center gap-1 text-xs lg:flex">
            <span>{tr('Рабочее место')}</span>
            <select aria-label={tr('Стиль рабочего места')} value={classic ? 'classic' : 'ours'} onChange={(event) => changeStyle(event.target.value === 'classic')} className="border border-neutral-300 bg-white px-1 py-1 text-xs">
              <option value="classic">{tr('Классический')}</option>
              <option value="ours">{tr('Наш')}</option>
            </select>
          </label>
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

      {/* 390 px экранда canvas-тан бөлек тұратын тұрақты қасиет батырмасы. */}
      {(activeBoard || activeSolid || cabinet) && <div data-testid="mobile-properties-trigger"
        className="relative z-30 flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
        <span className="min-w-0 truncate text-xs font-medium">{activeNode?.name ?? cabinet?.name ?? activeBoard?.name ?? activeSolid?.name}</span>
        <Button onClick={() => setPropertiesNodeId(activeId)}>{tr('Свойства')}</Button>
      </div>}

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
      <div className="legacy-tools flex flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1 dark:border-neutral-800">
        <Button size="sm" onClick={addCabinet} title={tr('Новый корпус')}>+</Button>
        <Button size="sm" onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable} title={tr('Дублировать корпус')}>⧉</Button>
        <Button size="sm" onClick={mirrorSelected} disabled={!canMirrorSelected} title={freeMirrorCheck?.reason ?? tr('Зеркальная копия')}>⇋</Button>
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
      <div className="legacy-tools flex flex-wrap items-center gap-1 border-b border-neutral-200 px-2 py-1 dark:border-neutral-800">
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
          <MenuItem active={!showDrilling && !showFittings} onClick={() => { setShowDrilling(false); setShowFittings(false) }}>
            {tr('Фурнитура: скрыть')}
          </MenuItem>
          <MenuItem active={showDrilling} onClick={() => setShowDrilling(true)}>{tr('Фурнитура: отверстия')}</MenuItem>
          <MenuItem active={showFittings} onClick={() => setShowFittings(true)}>{tr('Фурнитура: крепёж')}</MenuItem>
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
          {production.error} — {tr('Деталировка временно недоступна. Экспорт заблокирован.')}
        </div>
      ) : null}

      {draftInvalid && !production.error ? <div role="status" className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {tr('Исправьте поле. Показана последняя корректная модель. Деталировка временно недоступна. Экспорт заблокирован.')}
      </div> : null}

      {activeBoardJoint ? (
        <div role="status" className="border-b border-neutral-300 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
          <b className="font-mono">joint.boardIds</b> — {tr('Сначала удалите соединение')} ({activeBoardJoint.boardIds.join(', ')})
        </div>
      ) : null}

      {autoJoints.filter((joint) => joint.status === 'broken').map((joint) => (
        <div key={joint.id} role="alert" data-testid="broken-auto-joint"
          className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {tr('Автоматическая присадка нарушена')}: <b className="font-mono">{joint.error?.field ?? 'joint.boardIds'}</b> —
          {' '}{tr('Проверьте контакт досок и крепёж')} ({joint.boardIds.join(', ')})
        </div>
      ))}

      {hasActiveCabinet && error ? (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <b className="font-mono">{error.field}</b> — {error.message.replace(`${error.field}: `, '')}
          {stale ? <span className="ml-2 opacity-70">{tr('Показана последняя корректная модель.')}</span> : null}
        </div>
      ) : null}

      {exportError ? (
        <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span className="flex-1">{tr('Экспорт не удался')}: {exportError}</span>
          <Button size="sm" onClick={() => setExportError(null)}>{tr('Закрыть')}</Button>
        </div>
      ) : null}
      {(mirrorError || (activeNode && activeNode.kind !== 'cabinet' && freeMirrorCheck && !freeMirrorCheck.ok)) ? (
        <div role="status" className="border-b border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {tr('Зеркальная копия')}: {mirrorError ?? freeMirrorCheck?.reason}
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

      <Tour paused={galleryOpen} classic={classic} />
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
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_auto] overflow-y-auto overscroll-contain lg:grid-cols-[28px_minmax(0,1fr)_340px] lg:grid-rows-none lg:overflow-hidden">
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
        <div className="p100-side-tools hidden border-r border-neutral-200 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:py-1.5 dark:border-neutral-800">
          {classic ? <>
            <ClassicTool icon="view" label={tr('Выбор')} action={() => setSelected(null)} active={!selected} />
            <ClassicTool icon="board" label={tr('Добавить свободную доску')} action={addBoard} />
            <ClassicTool icon="box" label={tr('Добавить декоративный блок')} action={addSolid} />
            <ClassicTool icon="measure" label={tr('Размеры на сцене')} action={() => setShowDimensions(!showDimensions)} active={showDimensions} />
            <ClassicTool icon="structure" label={tr('Структура')} action={() => setStructureOpen(true)} id="structure-side" />
          </> : <>
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
          </>}
        </div>
        <div className="flex min-h-0 flex-col">
        {/* Телефонда 3D көрінеді, ал секция редакторына бөлек scroll биіктігі қалады. */}
        <main className="relative isolate h-[32dvh] min-h-[240px] max-h-[32dvh] flex-none overflow-hidden lg:h-auto lg:min-h-64 lg:max-h-none lg:flex-1" data-tour="scene">
          {/* absolute inset-0 — канвас өлшемі бірінші кадрда-ақ анық болуы үшін */}
          <div className="absolute inset-0">
            <Scene items={items} room={room} activeId={activeId} catalog={catalog} flatScene={scene} classic={classic} />
          </div>
          {/* Бір канондық ағаш: корпус, еркін тақта, топ және қабаттар. */}
          {walk ? null : classic ? <>
            <div className="pointer-events-auto absolute left-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] lg:hidden"><TreeDock /></div>
            {structureOpen ? <ClassicStructureWindow onClose={() => setStructureOpen(false)}
              canOpenProperties={Boolean(activeBoard || activeSolid || cabinet)} onProperties={() => setPropertiesNodeId(activeId)} /> : null}
          </> : <div className="pointer-events-auto absolute left-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] lg:w-72"><TreeDock /></div>}
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
          {productionState.cutListAvailable
            ? <CutListTable panels={projectPanels} catalog={catalog} collapsed={!cutOpen} onToggle={toggleCut} />
            : <div role="status" className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {tr('Деталировка временно недоступна. Экспорт заблокирован.')}
            </div>}
        </section>
        </div>
        <aside className="relative z-10 flex h-[60dvh] min-h-[360px] max-h-[60dvh] flex-col overflow-hidden border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none">
          {/* Қай модуль өңделіп жатыр — панельдің басында, қатесіз оқылатындай. */}
          <div className={cn("border-b border-neutral-200 px-3 py-2 dark:border-neutral-800", classic && "lg:hidden")}>
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
            </> : activeSolid ? <>
              <div className="truncate text-sm font-semibold" title={activeSolid.name}>{activeSolid.name}</div>
              <div className="text-[11px] tabular-nums text-neutral-500">
                {activeSolid.solid.size.y} (H) × {activeSolid.solid.size.x} (W) × {activeSolid.solid.size.z} (D)
              </div>
            </> : <div className="text-sm text-neutral-500">{tr('Выберите корпус в структуре проекта')}</div>}
            {classic && (activeBoard || activeSolid || cabinet) && <Button size="sm" onClick={() => setPropertiesNodeId(activeId)}>{tr('Свойства')}</Button>}
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-3 lg:overflow-auto", classic && "lg:hidden")}>
            <Dense>
              {/*
                МОДУЛЬДІҢ ОРНЫ (qdesign «Модуль орны, мм»: X/Y/Z, Бұрылыс) енді
                Configurator-дың ІШІНДЕ, «Общее» қосымшасында — PRO100-дың
                «бәрі бір терезеде» идеясы бойынша (docs/pro100/ui-design.md).
                Бұрын осында бөлек Collapsible еді.
              */}
              {propertiesNodeId ? null : hasActiveCabinet ? (
                <fieldset disabled={!activeEditable}>
                  <Configurator invalidField={error?.field ?? null} panels={activePanels} onDraftValidityChange={onDraftValidityChange} />
                </fieldset>
              ) : activeBoard ? (
                <fieldset disabled={!editableBoard}>
                  <BoardProperties key={activeBoard.id} node={activeBoard} panel={boardPanel} catalog={catalog} />
                </fieldset>
              ) : activeSolid ? (
                <fieldset disabled={!editableSolid}><SolidProperties key={activeSolid.id} node={activeSolid} /></fieldset>
              ) : null}
            </Dense>
          </div>
          {classic && <section className="p100-camera-pane hidden lg:block" aria-label={tr('Камера')}>
            <div className="p100-camera-title">{tr('Камера 1')}</div>
            <div className="p100-camera-controls">
              <Button size="sm" onClick={() => { setCameraPreset('three-quarter'); setProjection('perspective') }}>{tr('Перспектива')}</Button>
              <Button size="sm" onClick={() => { setCameraPreset('front'); setProjection('ortho') }}>{tr('Фас')}</Button>
              <Button size="sm" onClick={() => setCameraPreset('plan')}>{tr('План')}</Button>
              <Button size="sm" onClick={fitCamera}>{tr('Вписать в кадр')}</Button>
              {(activeBoard || activeSolid || cabinet) && <Button size="sm" onClick={() => setPropertiesNodeId(activeId)}>{tr('Свойства')}</Button>}
              <Button size="sm" onClick={addBoard}>{tr('+ доска')}</Button>
              <Button size="sm" onClick={addSolid}>{tr('+ блок')}</Button>
            </div>
          </section>}
          {/* Корпус әрекеттері әрқашан көзде (qdesign-дің астыңғы қатары сияқты). */}
          <div className={cn("flex flex-wrap gap-1 border-t border-neutral-200 p-2 dark:border-neutral-800", classic && "lg:hidden")}>
            <Button onClick={addCabinet}>{tr('+ корпус')}</Button>
            <Button onClick={addBoard}>{tr('+ доска')}</Button>
            <Button onClick={addSolid}>{tr('+ блок')}</Button>
            {activeBoard && <Button onClick={() => removeBoard(activeId)}
              disabled={!editableBoard || Boolean(activeBoardJoint)}>{tr('Удалить доску')}</Button>}
            <Button onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable} title={tr('Дублировать корпус')}>{tr('Дублировать')}</Button>
            <Button onClick={mirrorSelected} disabled={!canMirrorSelected} title={freeMirrorCheck?.reason ?? tr('Зеркальная копия')}>{tr('Зеркало')}</Button>
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
      {classic && <footer className="p100-status hidden lg:flex" role="status" data-testid="p100-status">
        <span>{selected ? `${tr('Выбран элемент')}: ${activeNode?.name ?? selected}` : tr('Элемент не выбран')}</span>
        {selected && activeNode && <span className="ml-auto tabular-nums">
          {tr('Положение')}: X {activeNode.transform.pos.x} · Y {activeNode.transform.pos.y} · Z {activeNode.transform.pos.z} мм
          {' · '}{tr('Размеры')}: {activeNode.kind === 'cabinet'
            ? `${activeNode.config.height} (H) × ${activeNode.config.width} (W) × ${activeNode.config.depth} (D)`
            : activeNode.kind === 'board' && catalog.materials.find((material) => material.id === activeNode.board.materialId)
              ? (() => { const size = boardDimensions(activeNode.board, catalog.materials.find((material) => material.id === activeNode.board.materialId)!); return `${size.height} (H) × ${size.width} (W) × ${size.depth} (D)` })()
              : '—'} мм
        </span>}
        {/* Баға күй жолағында да (P0-5): басу — смета, баға қойылмаса — цех профилі. */}
        {liveTotal && <button type="button" data-testid="p100-status-price" className={cn('p100-status-price', !(selected && activeNode) && 'ml-auto')}
          onClick={() => ('total' in liveTotal ? setQuoteOpen(true) : setShopOpen(true))}
          title={'total' in liveTotal ? tr('Итого клиенту — открыть смету') : tr('Задайте цены материалов в профиле цеха')}>
          {'total' in liveTotal ? <span className="tabular-nums">{tr('Итого клиенту')}: <b>{formatTenge(liveTotal.total)}</b></span> : tr('Цены не заданы')}
        </button>}
      </footer>}
    </div>
  )
}
