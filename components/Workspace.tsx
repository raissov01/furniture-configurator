'use client'

import { getLang, setLang, t as tr, tf } from '@/lib/i18n'
import { panelDisplayLabel } from '@/lib/panelDisplay'
import { drillLegend } from '@/lib/drillLegend'
import { contextActions } from '@/lib/contextActions'
import { menuPosition } from '@/lib/menuPosition'
import Link from 'next/link'
import { SITE } from '@/lib/site'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button, Dense, Menu, MenuItem, Slider } from '@/components/ui'
import { cn } from '@/lib/cn'
import { modalBlocksHotkeys } from '@/lib/modalStack'
import { getModalStack } from '@/lib/useModalLayer'
import { downloadPanorama } from '@/lib/panorama'
import { hasDraftErrors, updateDraftErrors } from '@/lib/numberDraft'
import { freeMirrorAvailability } from '@/lib/freeMirrorAction'
import { Configurator } from '@/components/Configurator'
import { BoardProperties } from '@/components/BoardProperties'
import { SolidProperties } from '@/components/SolidProperties'
import { AnnotationProperties } from '@/components/AnnotationProperties'
import { PropertiesDialog } from '@/components/PropertiesDialog'
import { TemplateGallery } from '@/components/TemplateGallery'
import { AiPanel } from '@/components/AiPanel'
import { RoomPlan } from '@/components/RoomPlan'
import { ShopSettings } from '@/components/ShopSettings'
import { classicToolTip } from '@/lib/f00kToolTip'
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
import { deleteAction, resetDecision } from '@/lib/workspaceActions'
import { assertUniqueToolbarRows, compactToolbarRows } from '@/lib/classicToolbar'
import { mobileViewLabel } from '@/lib/mobileViewTabs'
import { classicToolStatus, selectedStatusName } from '@/lib/classicStatus'
import { AccountPanel } from '@/components/AccountPanel'
import { LangSwitch } from '@/components/LangSwitch'
import { AppearanceSwitch } from '@/components/AppearanceSwitch'
import { ArButton } from '@/components/ArButton'
import { VrButton } from '@/components/VrButton'
import { Tour } from '@/components/Tour'
import { RenderPanel } from '@/components/RenderPanel'
import { classicMenus, type ClassicCommand, type ClassicPanel } from '@/lib/classicMenu'
import { classicMenuItemTitle } from '@/lib/classicMenuUi'
import { classicShopTools } from '@/lib/classicShopTools'
import { classicDockTools } from '@/lib/classicDockTools'
import { canToggleSelectedDoor, classicWorkspaceStyle } from '@/lib/classicWorkspaceUi'
import { propertiesNodeSupported } from '@/lib/propertiesNodeUi'
import { runShopExport } from '@/lib/shopExport'
import { selectShopExportPanels } from '@/lib/shopExportScope'
import { downloadProjectFile, pickProjectFile, projectFileErrorMessage } from '@/lib/projectFile'
import { approvalPrice } from '@/lib/f22ShareUi'
import { cloudEnabled } from '@/lib/cloud'
import { THEME_EVENT, chooseTheme, readTheme, saveQuality, type Theme } from '@/lib/appearance'
import {
  MAX_SILHOUETTE_HEIGHT, MIN_SILHOUETTE_HEIGHT, SHARE_LINK_WARN_LENGTH, shareLink,
  ConfigValidationError, canMirror, formatTengeExact,
  boardDimensions, findNode,
} from '@/src/core/index'
import { assertTreeNodeEditable } from '@/src/core/treeEditing'
import { ExportMenu } from '@/components/ExportMenu'
import { CutListTable } from '@/components/CutListTable'
import { TreeDock } from '@/components/panels/TreeDock'
import { nextDockRequest, type DockRequest } from '@/lib/treeDockUi'
import { WorkspaceDock } from '@/components/dock/WorkspaceDock'
import { ClassicStructureWindow } from '@/components/ClassicStructureWindow'
import { ClassicIcon, type ClassicIconName } from '@/components/ClassicIcon'
import { BusyOverlay, Spinner } from '@/components/BusyOverlay'
import { TouchJoystick } from '@/components/TouchJoystick'
import { isTouchDevice } from '@/lib/walkInput'
import { usePanels } from '@/lib/usePanels'
import { useTreeSceneItems } from '@/lib/useTreeSceneItems'
import { useProjectProduction } from '@/lib/useProjectProduction'
import { bytesToBase64, parseObjSolidForScene, parseTdsSolid } from '@/lib/meshImport'
import { MAX_IMPORTED_MODEL_BYTES, MAX_IMPORTED_TEXTURE_BYTES } from '@/src/core/import/tds'
import { productionAvailability } from '@/lib/productionAvailability'
import { assemblyStepView } from '@/lib/assemblyStepView'
import { parseSilhouetteHeight } from '@/lib/silhouetteInput'
import {
  DIMENSION_AXIS_LABEL, dimensionWarningTemplate, dimensionWarnings, shelfSpanWarnings,
} from '@/src/core/index'
import { PROJECT_META_KEY, useConfigurator } from '@/store/configurator'
import { classicSceneLook, useClassicView } from '@/store/classicView'
import { ClassicLibraryDock, dropDraggedLibraryTile, hasDraggedLibraryTile, type LibraryAction } from '@/components/ClassicLibraryDock'
import { ClassicRoomDialog } from '@/components/ClassicRoomDialog'
import { ClassicLightDialog } from '@/components/ClassicLightDialog'
import { ClassicReportsDialog } from '@/components/ClassicReportsDialog'
import { ClassicStartGuide } from '@/components/ClassicStartGuide'
import { ClassicPartDialog } from '@/components/ClassicPartDialog'
import { OPEN_DOCK_PANEL_EVENT } from '@/components/dock/DockHost'
import type { CabinetConfig, Material } from '@/src/core/index'
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
  /** Қойындының нақты проекциясы. */
  projection?: 'perspective' | 'ortho'
}[] = [
  { key: 'perspective', ruLabel: 'Перспектива', preset: 'three-quarter', projection: 'perspective' },
  { key: 'axo', ruLabel: 'Аксонометрия', preset: 'three-quarter', projection: 'ortho' },
  // PRO100 (орысша): «Вид сверху | Вид спереди | Вид справа | Вид сзади | Вид слева».
  // Камера тұрған жақ: алдынан → солтүстік қабырғаға (артқы) қарайды, т.с.с.
  { key: 'plan', ruLabel: 'Вид сверху', preset: 'plan', projection: 'ortho' },
  { key: 'wall-north', ruLabel: 'Вид спереди', preset: 'wall-north', projection: 'ortho' },
  { key: 'wall-west', ruLabel: 'Вид справа', preset: 'wall-west', projection: 'ortho' },
  { key: 'wall-south', ruLabel: 'Вид сзади', preset: 'wall-south', projection: 'ortho' },
  { key: 'wall-east', ruLabel: 'Вид слева', preset: 'wall-east', projection: 'ortho' },
]

/** C1 бюджеті: 40 панельге дейін параметр өзгерісі < 100 мс. */
const BUDGET_MS = 100

/** Деталировка тақтасы ашық па — браузерде сақталады (адамның өз ыңғайы). */
const CUT_OPEN_KEY = 'furniture-configurator:cutlist-open'
const WORKSPACE_STYLE_KEY = 'furniture-configurator:workspace-style'

type ClassicToolSpec = { icon: ClassicIconName; label: string; action: () => void; disabled?: boolean; disabledReason?: string; active?: boolean; id?: string; hint?: string; separator?: boolean; onHover?: (label: string | null) => void }

function ClassicTool({ icon, label, action, disabled, disabledReason, active, id, hint, onHover }: ClassicToolSpec) {
  const tip = classicToolTip(label, disabled, disabledReason)
  // Күй жолағы PRO100-дегідей: атауы және «не істейді» (hint).
  const status = hint ? `${tip} — ${hint}` : tip
  // disabled button hover оқиғасын жібермейді; сыртқы span подсказканы сақтайды.
  return <span className="inline-flex" title={tip} tabIndex={disabled ? 0 : undefined}
    aria-label={disabled ? tip : undefined} onMouseEnter={() => onHover?.(status)} onMouseLeave={() => onHover?.(null)}
    onFocus={() => onHover?.(status)} onBlur={() => onHover?.(null)}>
    <button type="button" className="p100-icon-button" title={tip} aria-label={tip} aria-pressed={active || undefined}
      data-testid={id ? `classic-tool-${id}` : undefined} disabled={disabled} onClick={action}>
      <ClassicIcon name={icon} />
    </button>
  </span>
}

/** Бос бөлмелі жаңа жоба: әдепкі баптаулар сақталады, ағашта корпус жоқ. */
function loadEmptyProject(reset: () => void, loadProject: (file: unknown) => void) {
  reset()
  const blank = useConfigurator.getState().exportProject()
  loadProject({ ...blank, name: tr('Новый проект'), root: { ...blank.root, name: tr('Новый проект'), children: [] } })
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
  const addSpecialPart = useConfigurator((s) => s.addSpecialPart)
  const addImportedSolid = useConfigurator((s) => s.addImportedSolid)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importUnit, setImportUnit] = useState(1)
  const [specialError, setSpecialError] = useState<string | null>(null)
  const insertSpecialPart = (kind: 'lathe' | 'bent') => {
    try { addSpecialPart(kind); setSpecialError(null) }
    catch (cause) { setSpecialError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const importSolidFiles = async (files: FileList | null) => {
    if (!files) return
    try {
      const selected = Array.from(files)
      const models = selected.filter((file) => /\.(?:3ds|obj)$/i.test(file.name))
      if (models.length !== 1) throw new Error(tr('Выберите один файл 3DS или OBJ'))
      const model = models[0]!
      if (model.size > MAX_IMPORTED_MODEL_BYTES) throw new Error(tr('Файл 3D превышает лимит 2 МБ'))
      const textureFiles = selected.filter((file) => /\.(?:png|jpe?g|webp)$/i.test(file.name))
      if (textureFiles.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORTED_TEXTURE_BYTES) {
        throw new Error(tr('Текстуры превышают лимит 4 МБ'))
      }
      const textures: Record<string, string> = {}
      for (const file of textureFiles) {
        const mime = /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg'
        textures[file.name.toLowerCase()] = `data:${mime};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`
      }
      const id = `import-${crypto.randomUUID()}`
      const options = { id, name: model.name.replace(/\.(?:3ds|obj)$/i, ''), mmPerUnit: importUnit }
      const bytes = new Uint8Array(await model.arrayBuffer())
      const node = /\.3ds$/i.test(model.name)
        ? parseTdsSolid(bytes, options, textures).node
        : parseObjSolidForScene(new TextDecoder().decode(bytes), options)
      addImportedSolid(node)
      setSpecialError(null)
    } catch (cause) {
      setSpecialError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }
  const addAnnotation = useConfigurator((s) => s.addAnnotation)
  const removeBoard = useConfigurator((s) => s.removeBoard)
  const removeAnnotation = useConfigurator((s) => s.removeAnnotation)
  const ungroup = useConfigurator((s) => s.ungroup)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const priceOverrides = useConfigurator((s) => s.priceOverrides)
  const setShopOpen = useConfigurator((s) => s.setShopOpen)
  const hydrateShop = useConfigurator((s) => s.hydrateShop)
  const hydrateProject = useConfigurator((s) => s.hydrateProject)
  const saveProjectLocally = useConfigurator((s) => s.saveProjectLocally)
  const localSaveError = useConfigurator((s) => s.localSaveError)
  const localConflict = useConfigurator((s) => s.localConflict)
  const checkLocalRevision = useConfigurator((s) => s.checkLocalRevision)
  const resolveLocalConflict = useConfigurator((s) => s.resolveLocalConflict)
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
  const [silhouetteDraft, setSilhouetteDraft] = useState(() => String(silhouette.height))
  useEffect(() => setSilhouetteDraft(String(silhouette.height)), [silhouette.height])
  const silhouetteError = parseSilhouetteHeight(silhouetteDraft).error
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
  const xray = useConfigurator((s) => s.xray)
  const setXray = useConfigurator((s) => s.setXray)
  const pushHistory = useConfigurator((s) => s.pushHistory)
  const syncShare = useConfigurator((s) => s.syncShare)
  const setShareCodeOpen = useConfigurator((s) => s.setShareCodeOpen)
  const shareCodeOpen = useConfigurator((s) => s.shareCodeOpen)
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
  const activeAnnotation = activeNode?.kind === 'annotation' ? activeNode : null
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
  const [hoveredToolLabel, setHoveredToolLabel] = useState<string | null>(null)
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

  const deleteSelected = () => {
    let editable = false
    try { assertTreeNodeEditable(root, activeId, layers); editable = true }
    catch (cause) { if (!(cause instanceof ConfigValidationError)) throw cause }
    const action = deleteAction(activeNode?.kind ?? null, editable, cabinets.length, Boolean(activeBoardJoint))
    if (action === 'board') removeBoard(activeId)
    if (action === 'annotation') removeAnnotation(activeId)
    if (action === 'cabinet') removeCabinet(activeId)
    if (action) setSelected(null)
  }
  const requestReset = () => {
    if (resetDecision(window.confirm(tr('Сбросить текущий проект?'))) === 'reset') reset()
  }
  /** PRO100 «Новый проект» (Ctrl+N): бос бөлме, корпуссыз; бұрынғы күй тарихта қалады. */
  const newProject = () => {
    if (resetDecision(window.confirm(tr('Начать новый проект с пустой комнаты?'))) !== 'reset') return
    loadEmptyProject(reset, loadProject)
    setSelected(null)
    useClassicView.getState().setStartGuideOpen(true)
  }
  /** «Сохранить как…»: файл атауын сұрап жүктеу (жоба күйі өзгермейді). */
  const saveProjectAs = () => {
    const file = exportProject()
    const name = window.prompt(tr('Имя файла проекта'), file.name)?.trim()
    if (name) downloadProjectFile({ ...file, name })
  }

  // Генерация уақыты серверде де, браузерде де әртүрлі шығады — гидратация
  // сәйкессіздігін болдырмау үшін оны тек браузерде көрсетеміз.
  const classic = true
  const [structureOpen, setStructureOpen] = useState(false)
  const [fileOpenError, setFileOpenError] = useState<string | null>(null)
  const openProjectPicker = () => {
    setFileOpenError(null)
    pickProjectFile(loadProject, (error) => setFileOpenError(projectFileErrorMessage(error)))
  }
  const [dockRequest, setDockRequest] = useState<DockRequest>({ tab: 'structure', revision: 0 })
  const openDockTab = (tab: DockRequest['tab']) => {
    setDockRequest((current) => nextDockRequest(current, tab))
    if (window.matchMedia('(min-width: 1024px)').matches) setStructureOpen(true)
  }
  const [propertiesNodeId, setPropertiesNodeId] = useState<string | null>(null)
  const [partDialogId, setPartDialogId] = useState<string | null>(null)
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ panelId: string; nodeId: string }>).detail
      const node = findNode(useConfigurator.getState().root, detail.nodeId)
      // Еркін доска — өз терезесі (Длина/Ширина, материал, кромка өңделеді).
      if (node && node.kind !== 'cabinet') setPropertiesNodeId(detail.nodeId)
      else setPartDialogId(detail.panelId)
    }
    window.addEventListener('furniture:open-part-properties', open)
    return () => window.removeEventListener('furniture:open-part-properties', open)
  }, [])
  const [sceneContext, setSceneContext] = useState<{ panelId: string; nodeId: string | null; x: number; y: number } | null>(null)
  const sceneContextRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const open = (event: Event) => setSceneContext((event as CustomEvent<{ panelId: string; nodeId: string | null; x: number; y: number }>).detail)
    window.addEventListener('furniture:scene-context', open)
    return () => window.removeEventListener('furniture:scene-context', open)
  }, [])
  useEffect(() => {
    if (!sceneContext) return
    const dismiss = (event: PointerEvent) => { if (!sceneContextRef.current?.contains(event.target as Node)) setSceneContext(null) }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); setSceneContext(null)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key) }
  }, [sceneContext])
  const [draftState, setDraftState] = useState<{ id: string; errors: Record<string, boolean> }>({ id: activeId, errors: {} })
  const draftInvalid = draftState.id === activeId && hasDraftErrors(draftState.errors)
  const productionState = productionAvailability(production.error, draftInvalid)
  const onDraftValidityChange = (field: string, invalid: boolean) =>
    setDraftState((current) => ({ id: activeId, errors: updateDraftErrors(current.id === activeId ? current.errors : {}, field, invalid) }))
  useEffect(() => {
    try { window.localStorage.setItem(WORKSPACE_STYLE_KEY, classicWorkspaceStyle(window.localStorage.getItem(WORKSPACE_STYLE_KEY))) }
    catch (cause) { console.debug('Workspace style storage unavailable', cause) }
  }, [])
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
    // Десктопта (PRO100 жұмыс орны) — оң жақта Библиотека және «Начало работы»
    // (Свойства помещения → Библиотека → модуль қою); телефонда — шаблон галереясы.
    if (useConfigurator.getState().firstRun) {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        // PRO100 бос бөлмемен ашылады: шақырылмаған әдепкі корпус қойылмайды.
        const state = useConfigurator.getState()
        loadEmptyProject(state.reset, state.loadProject)
        useClassicView.getState().setLibraryOpen(true)
        useClassicView.getState().setStartGuideOpen(true)
        useConfigurator.getState().setFirstRun(false)
      } else setGalleryOpen(true)
    }
  }, [hydrateShop, hydrateProject, setGalleryOpen])

  // Автосақтау: бетті жаңартқанда жұмыс жоғалмауы керек. Кідіріс — өріске
  // сан теріп жатқанда әр таңбаға жазбау үшін.
  useEffect(() => {
    if (propertiesNodeId) return
    const timer = setTimeout(() => {
      const saveError = saveProjectLocally()
      // Тарихқа да жазамыз: автосақтау бір ғана кілтті қайта жазады да,
      // жарты сағат бұрынғы күйге қайтуға мүмкіндік қалмайды.
      if (!saveError) pushHistory()
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

  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === PROJECT_META_KEY) checkLocalRevision() }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [checkLocalRevision])

  // Цехтың пролёт шегі қойылмаса, бұл әрқашан бос тізім қайтарады.
  const spanWarnings = useMemo(() => shelfSpanWarnings(production.panels, shop), [production.panels, shop])

  // Габарит шектері де солай: цех қоймаса, ескерту мүлде шықпайды. Тексеру
  // БҮКІЛ жоба бойынша — жобадағы екінші корпус шектен шықса да көрінуі керек.
  const sizeWarnings = useMemo(() => dimensionWarnings(items.map((item) => item.cabinet), shop), [items, shop])

  // Смета БҮКІЛ жоба бойынша: цех парақты бір тапсырысқа бірге сатып алады.
  // id-лер корпустың атауымен префиксталады: бір жобадағы екі шкафта да
  // `side-left` бар, ал экспортта олар бөлек файл болуы керек.
  const projectPanels = production.panels
  const selectedPart = projectPanels.find((panel) => panel.id === selected)
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
      const price = approvalPrice(deferredPanels, catalog, shop, projectHardware, moduleWidths, priceOverrides, production.manualItems, production.specialParts)
      return price.kind === 'missing' ? { missing: true } : { total: price.total }
    } catch (error) {
      // Жарамсыз конфиг кезінде (теріп жатқанда) баға уақытша көрінбейді — бұл
      // қате емес: қатенің өзін тақтаның астындағы қызыл жолақ айтады.
      console.debug('Цена в тулбаре не посчитана', error)
      return null
    }
  }, [deferredPanels, catalog, shop, projectHardware, moduleWidths, priceOverrides, production.manualItems, production.specialParts, production.error])
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
      const dialogState = useConfigurator.getState()
      if (propertiesNodeId || modalBlocksHotkeys(getModalStack())) return
      if (dialogState.galleryOpen || dialogState.shopOpen || dialogState.quoteOpen || dialogState.drillOpen || dialogState.roomOpen) return

      if (isTyping(e.target)) return
      // Escape — 3D-дегі таңдауды алу. Хоткейлер тізіміне кірмейді: бұл
      // «әрекет» емес, кез келген жерден шығудың әдеттегі жолы.
      if (e.key === 'Escape') {
        if (selected) { e.preventDefault(); setSelected(null) }
        return
      }
      // PRO100: Ctrl+G — «Структурада» белгіленген элементтерді топтау.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g' && selectionIds.length >= 2) {
        e.preventDefault(); groupTree(); return
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
        case 'xray': setXray(!xray); break
        case 'fronts': setShowFronts(!showFronts); break
        case 'openness': setOpenness(openness > 0 ? 0 : 1); break
        case 'projection': setProjection(projection === 'perspective' ? 'ortho' : 'perspective'); break
        case 'dimensions': setShowDimensions(!showDimensions); break
        case 'help': setHelpOpen(true); break
        case 'undo': undo(); break
        case 'redo': redo(); break
        case 'delete': deleteSelected(); break
        case 'newCabinet': addCabinet(); break
        case 'newProject': newProject(); break
        case 'openProject': openProjectPicker(); break
        case 'saveProject': downloadProjectFile(exportProject()); break
        case 'printProject':
          if (pdfCabinet && productionState.exportsAvailable) runClassicCommand({ type: 'export', format: 'pdf', scope: 'project' })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /*
   * ═══ PRO100 ҚҰРАЛДАРЫ (классикалық жолақтар мен мәзір) ═══
   * Бұрыннан бар әрекеттер (arrangeNodes, groupSelected, setNodeTransform,
   * movePlacement, setNodeHidden) PRO100 орналасуымен жолаққа шықты. Қате
   * болса (құлыпталған, қабырғаға тірелмеген шкаф т.б.) — күй жолағының
   * үстінде себебімен көрсетіледі, үнсіз жұтылмайды.
   */
  const treeSelection = useClassicView((s) => s.treeSelection)
  const setLibraryOpen = useClassicView((s) => s.setLibraryOpen)
  const libraryOpen = useClassicView((s) => s.libraryOpen)
  const setRoomDialogOpen = useClassicView((s) => s.setRoomDialogOpen)
  const setLightDialogOpen = useClassicView((s) => s.setLightDialogOpen)
  const setReportsOpen = useClassicView((s) => s.setReportsOpen)
  const realisticView = useClassicView((s) => s.realisticView)
  const setRealisticView = useClassicView((s) => s.setRealisticView)
  const hydrateClassicView = useClassicView((s) => s.hydrate)
  const startGuideOpen = useClassicView((s) => s.startGuideOpen)
  const setStartGuideOpen = useClassicView((s) => s.setStartGuideOpen)
  useEffect(() => { hydrateClassicView() }, [hydrateClassicView])
  const sceneRealistic = classicSceneLook(true, Boolean(room.finish), realisticView) === 'realistic'
  const arrangeNodes = useConfigurator((s) => s.arrangeNodes)
  const groupSelectedNodes = useConfigurator((s) => s.groupSelected)
  const setNodeHidden = useConfigurator((s) => s.setNodeHidden)
  const setNodeLocked = useConfigurator((s) => s.setNodeLocked)
  const setNodeTransform = useConfigurator((s) => s.setNodeTransform)
  const movePlacement = useConfigurator((s) => s.movePlacement)
  const appendCabinet = useConfigurator((s) => s.appendCabinet)
  const loadSet = useConfigurator((s) => s.loadSet)
  const editCabinet = useConfigurator((s) => s.edit)
  const editBoard = useConfigurator((s) => s.editBoard)
  const [toolError, setToolError] = useState<string | null>(null)
  useEffect(() => setToolError(null), [activeId])
  const guarded = (run: () => void) => {
    try { run(); setToolError(null) }
    catch (cause) { setToolError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const selectionIds = treeSelection.filter((id) => findNode(root, id))
  const arrange = (axis: 'x' | 'y' | 'z', mode: 'min' | 'center' | 'max' | 'distribute') =>
    guarded(() => arrangeNodes(selectionIds, axis, mode))
  const groupTree = () => guarded(() => groupSelectedNodes(selectionIds, `group-${crypto.randomUUID()}`, tr('Группа')))
  const canUngroup = activeNode?.kind === 'group' && activeNode.id !== root.id
  const ungroupActive = () => guarded(() => { if (canUngroup) { ungroup(activeId); setSelected(null) } })
  const canHideSelected = Boolean(activeNode && activeNode.id !== root.id)
  const hideSelected = () => guarded(() => { setNodeHidden(activeId, true); setSelected(null) })
  const canRotate = Boolean(activeNode && ['cabinet', 'group', 'board', 'solid'].includes(activeNode.kind) && activeNode.id !== root.id)
  /** PRO100 «Повернуть на 90°»: бұрыш (−180, 180] аралығында қалады. */
  const rotateSelected = (degrees: 90 | -90) => guarded(() => {
    const node = findNode(root, activeId)
    if (!node) throw new Error(tr('Выберите элемент'))
    const turn = (angle: number) => { const next = ((angle + degrees + 180) % 360 + 360) % 360 - 180; return next === -180 ? 180 : next }
    if (node.kind === 'cabinet') {
      const placement = placements.find((entry) => entry.cabinetId === activeId)
      movePlacement(activeId, { rotate: turn(placement?.rotate ?? 0) })
    } else setNodeTransform(activeId, { ...node.transform, rot: { x: 0, y: turn(node.transform.rot.y), z: 0 } })
  })
  const canDeleteSelected = Boolean(activeNode && ['cabinet', 'board', 'annotation'].includes(activeNode.kind)
    && (activeNode.kind !== 'cabinet' || activeEditable))
  /** Камераны тінтуір дөңгелегімен бірдей жақындату/алыстату (OrbitControls өзі өңдейді). */
  const zoomScene = (direction: 1 | -1) => {
    const canvas = document.querySelector('#scene-3d canvas') // Scene.tsx SCENE_CANVAS_ID; Scene бұл жерде статикалық импортталмайды
    canvas?.dispatchEvent(new WheelEvent('wheel', { deltaY: direction * -240, bubbles: true, cancelable: true }))
  }
  /** Библиотекадан корпус қою: таңдалған қабырғаның келесі бос орнына (PRO100 «вставить»). */
  const insertCabinet = (config: CabinetConfig): string | null => {
    try {
      appendCabinet({ ...config, id: `cabinet-${crypto.randomUUID()}` })
      setSelected(null)
      return null
    } catch (cause) { return cause instanceof Error ? cause.message : String(cause) }
  }
  const loadTemplateSet = (id: string) => {
    if (window.confirm(tr('Набор заменит текущий проект. Продолжить?'))) guarded(() => loadSet(id))
  }
  /** Библиотекадағы материалды таңдалған элементке қою (PRO100-де материалды элементке сүйрейді). */
  const applyMaterial = (material: Material): string | null => {
    try {
      if (activeNode?.kind === 'board') { editBoard(activeId, { materialId: material.id }); return null }
      if (activeNode?.kind === 'cabinet') {
        if (material.slab || material.thickness < 10) return tr('Для корпуса нужна плита толщиной от 10 мм')
        const key = selectedPart?.role === 'front' ? 'frontMaterialId' : 'carcassMaterialId'
        editCabinet(key, { [key]: material.id })
        return null
      }
      return tr('Сначала выберите корпус или доску в 3D')
    } catch (cause) { return cause instanceof Error ? cause.message : String(cause) }
  }
  const libraryElements: LibraryAction[] = [
    { id: 'cabinet', label: tr('Новый корпус'), icon: 'insert', action: addCabinet },
    { id: 'board', label: tr('Добавить свободную доску'), icon: 'board', action: addBoard },
    { id: 'solid', label: tr('Добавить декоративный блок'), icon: 'decor', action: addSolid },
    { id: 'lathe', label: tr('Токарная деталь'), icon: 'lathe', action: () => insertSpecialPart('lathe') },
    { id: 'bent', label: tr('Гнутая деталь'), icon: 'bent', action: () => insertSpecialPart('bent') },
    { id: 'text', label: tr('Добавить текст'), icon: 'text', action: addAnnotation },
    { id: 'import', label: tr('Импорт → 3DS/OBJ'), icon: 'import', action: () => importInputRef.current?.click() },
    { id: 'parts', label: tr('Своя деталь'), icon: 'parts', action: () => setPartsOpen(true), disabled: !activeEditable },
    { id: 'my-library', label: tr('Моя библиотека'), icon: 'library', action: () => openDockTab('library') },
  ]
  const libraryOther: LibraryAction[] = [
    { id: 'room-props', label: tr('Свойства помещения…'), icon: 'room', action: () => setRoomDialogOpen(true) },
    { id: 'walls', label: tr('Стены и комната'), icon: 'projectInfo', action: () => setRoomOpen(true) },
    { id: 'light', label: tr('Свет…'), icon: 'sun', action: () => setLightDialogOpen(true) },
    { id: 'person', label: tr('Человек для масштаба'), icon: 'person', action: () => setSilhouette({ on: !silhouette.on }) },
    { id: 'gallery', label: tr('Готовые шаблоны'), icon: 'catalog', action: () => setGalleryOpen(true) },
    { id: 'ai', label: tr('Техзадание (словами)'), icon: 'sketch', action: () => setAiOpen(true) },
  ]

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
      case 'openProject': openProjectPicker(); break
      case 'export':
        if (draftInvalid) break
        setExportError(null)
        void runShopExport(command.format, {
          cabinet: command.format === 'pdf' && command.scope === 'project' ? pdfCabinet : command.scope === 'cabinet' ? cabinet : undefined,
          panels: selectShopExportPanels(command.scope, command.format, activePanels, projectPanels),
          specialParts: command.scope === 'project' ? production.specialParts : [],
          pdfAssembly: command.scope === 'project' ? pdfAssembly : undefined,
          catalog, settings, projectInfo,
          exportId: command.scope === 'project' ? 'project' : undefined,
          exportName: command.scope === 'project' ? projectName : undefined,
        })
          .catch((cause: unknown) => setExportError(cause instanceof Error ? cause.message : String(cause)))
        break
      case 'panorama':
        setExportError(null)
        requestAnimationFrame(() => {
          try {
            const context = useConfigurator.getState().liveRenderContext
            if (!context) throw new Error(tr('Сцена ещё не готова'))
            downloadPanorama(context)
          } catch (cause) { setExportError(cause instanceof Error ? cause.message : tr('Не удалось создать панораму')) }
        })
        break
      case 'clientLink': void copyClientLink(); break
      case 'reset': newProject(); break
      case 'saveProjectAs': saveProjectAs(); break
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
      case 'xray': setXray(!xray); break
      case 'fit': fitCamera(); break
      case 'toggleSilhouette': setSilhouette({ on: !silhouette.on }); break
      case 'toggleWalk': setWalk(!walk); break
      case 'addCabinet': addCabinet(); break
      case 'addBoard': addBoard(); break
      case 'addSolid': addSolid(); break
      case 'addSpecialPart': insertSpecialPart(command.kind); break
      case 'importSolid': importInputRef.current?.click(); break
      case 'removeBoard': if (editableBoard && !activeBoardJoint) removeBoard(activeId); break
      case 'duplicate': duplicateCabinet(activeId); break
      case 'mirror': mirrorSelected(); break
      case 'removeCabinet': removeCabinet(activeId); setSelected(null); break
      case 'toggleOpen': setOpenness(openness > 0 ? 0 : 1); break
      case 'toggleAssembly': setAssemblyStep(assemblyStep === null ? 1 : null); break
      case 'toggleSelectedDoor': if (selected && canToggleSelectedDoor(projectPanels.find((part) => part.id === selected))) togglePanelOpen(selected); break
      case 'navigate': window.location.href = command.href; break
      case 'theme': setTheme(command.theme); chooseTheme(command.theme); break
      case 'quality': setQuality(command.quality); saveQuality(command.quality); break
      case 'lang': setLang(command.lang); break
      case 'roomDialog': setRoomDialogOpen(true); break
      case 'lightDialog': setLightDialogOpen(true); break
      case 'library': setLibraryOpen(!libraryOpen); break
      case 'reports': setReportsOpen(true); break
      case 'properties': if (propertiesNodeSupported(activeNode?.kind)) setPropertiesNodeId(activeId); break
      case 'dockTab': openDockTab(command.tab); break
      case 'dockPanel': window.dispatchEvent(new CustomEvent(OPEN_DOCK_PANEL_EVENT, { detail: command.id })); break
      case 'toggleRealistic': setRealisticView(!realisticView); break
      case 'rotate': rotateSelected(command.degrees); break
      case 'group': groupTree(); break
      case 'ungroup': ungroupActive(); break
      case 'hideSelected': hideSelected(); break
      case 'deleteSelected': deleteSelected(); break
      case 'align': arrange(command.axis, command.mode); break
      case 'startGuide': setStartGuideOpen(true); break
    }
  }
  const menus = classicMenus({
    canUndo, canRedo, activeEditable, canMirrorSelected, editableBoard: editableBoard && !activeBoardJoint,
    canRemoveCabinet: cabinets.length >= 1 && activeEditable,
    canExport: (projectPanels.length > 0 || production.specialParts.length > 0) && productionState.exportsAvailable,
    canExportPanels: projectPanels.length > 0 && productionState.exportsAvailable,
    canExportDxf: (projectPanels.length > 0 || production.specialParts.some((part) => part.section === 'Иілген деталь')) && productionState.exportsAvailable,
    canExportPdf: Boolean(pdfCabinet) && productionState.exportsAvailable,
    canExportActiveCabinet: hasActiveCabinet && productionState.exportsAvailable,
    productionError: Boolean(production.error),
    cameraPreset, viewMode, showFronts, projection, showDimensions, showDrilling, showFittings, xray,
    silhouetteOn: silhouette.on, walk, open: openness > 0, assembly: assemblyStep !== null,
    theme, quality, lang: getLang(),
    price: liveTotal === null ? null : 'total' in liveTotal ? { total: formatTengeExact(liveTotal.total) } : { missing: true },
    cloud: cloudEnabled, selectedDoor: canToggleSelectedDoor(projectPanels.find((part) => part.id === selected)), selectedDoorOpen: Boolean(selected && openPanels[selected]),
    realistic: sceneRealistic, canProperties: propertiesNodeSupported(activeNode?.kind), canRotate, canDelete: canDeleteSelected,
    canHide: canHideSelected, selectionCount: selectionIds.length, canUngroup,
  })

  const needSelection = tr('Выделите 2 и более элемента в «Структуре» (Ctrl+щелчок)')
  const needThree = tr('Выделите 3 и более элемента в «Структуре» (Ctrl+щелчок)')
  const alignTool = (icon: ClassicIconName, axis: 'x' | 'y' | 'z', mode: 'min' | 'center' | 'max' | 'distribute', separator = false) => ({
    icon, axis, mode, separator,
    disabled: selectionIds.length < (mode === 'distribute' ? 3 : 2),
    disabledReason: mode === 'distribute' ? needThree : needSelection,
  })
  /*
   * PRO100 ҚҰРАЛ ЖОЛАҚТАРЫ (эталон `base-inserted.png`, «Вид → Панели
   * инструментов»): Стандартная · Вид · Выравнивание · Элемент. Әр әрекеттің
   * бір батырмасы, әр батырманың өз белгішесі (`assertUniqueToolbarRows`).
   * `hint` — күй жолағында «бұл не істейді».
   */
  const align = [
    alignTool('alignLeft', 'x', 'min'), alignTool('alignCenterX', 'x', 'center'), alignTool('alignRight', 'x', 'max', true),
    alignTool('alignBottom', 'y', 'min'), alignTool('alignMiddleY', 'y', 'center'), alignTool('alignTop', 'y', 'max', true),
    alignTool('alignFront', 'z', 'min'), alignTool('alignCenterZ', 'z', 'center'), alignTool('alignBack', 'z', 'max', true),
    alignTool('distributeX', 'x', 'distribute'), alignTool('distributeY', 'y', 'distribute'), alignTool('distributeZ', 'z', 'distribute'),
  ]
  const classicToolRows: ClassicToolSpec[][] = assertUniqueToolbarRows<ClassicToolSpec>([
    [
      { icon: 'new', label: tr('Новый проект'), action: newProject, id: 'new-project', hint: tr('Пустая комната, как в PRO100 (Ctrl+N)') },
      { icon: 'open', label: tr('Открыть проект'), action: openProjectPicker, hint: tr('Открыть сохранённый файл проекта') },
      { icon: 'save', label: tr('Сохранить проект'), action: () => downloadProjectFile(exportProject()), id: 'save', hint: tr('Скачать проект одним файлом'), separator: true },
      { icon: 'room', label: tr('Свойства помещения…'), action: () => setRoomDialogOpen(true), id: 'room-props', hint: tr('Длина, ширина и высота комнаты, пол'), separator: true },
      { icon: 'print', label: tr('PDF — весь проект'), action: () => runClassicCommand({ type: 'export', format: 'pdf', scope: 'project' }), disabled: !(pdfCabinet && productionState.exportsAvailable), disabledReason: tr('Нет корпуса для чертежа'), id: 'print', hint: tr('Чертёж и деталировка для печати') },
      { icon: 'projectInfo', label: tr('Отчёты…'), action: () => setReportsOpen(true), disabled: Boolean(production.error), disabledReason: tr('Исправьте ошибки проекта'), id: 'reports', hint: tr('Список деталей, корпусов и расход материалов'), separator: true },
      { icon: 'duplicate', label: tr('Дублировать корпус'), action: () => duplicateCabinet(activeId), disabled: !activeEditable, disabledReason: tr('Выберите редактируемый корпус'), hint: tr('Копия выбранного корпуса рядом с ним') },
      { icon: 'delete', label: tr('Удалить'), action: deleteSelected, disabled: !canDeleteSelected, disabledReason: tr(activeNode?.kind === 'cabinet' ? 'Выбранный корпус заблокирован' : 'Выберите элемент'), id: 'delete', hint: tr('Удалить выбранный элемент (Del)'), separator: true },
      { icon: 'undo', label: tr('Отменить'), action: undo, disabled: !canUndo, disabledReason: tr('Нет действий для отмены'), id: 'undo', hint: 'Ctrl+Z' },
      { icon: 'redo', label: tr('Повторить'), action: redo, disabled: !canRedo, disabledReason: tr('Нет действий для повтора'), id: 'redo', hint: 'Ctrl+Shift+Z', separator: true },
      { icon: 'shop', label: tr('Цех: материалы и цены'), action: () => setShopOpen(true), hint: tr('Материалы, кромка, фурнитура и цены цеха') },
      { icon: 'properties', label: tr('Свойства'), action: () => setPropertiesNodeId(activeId), disabled: !propertiesNodeSupported(activeNode?.kind), disabledReason: tr('Выберите элемент'), id: 'properties', hint: tr('Размеры, материал и положение выбранного элемента'), separator: true },
      { icon: 'catalog', label: tr('Библиотека'), action: () => setLibraryOpen(!libraryOpen), active: libraryOpen, id: 'library', hint: tr('Мебель, элементы и материалы — панель справа') },
      { icon: 'find', label: tr('Найти'), action: () => openDockTab('find'), id: 'find', hint: tr('Поиск детали по имени, материалу или размеру') },
      { icon: classicDockTools.structure.icon, label: tr(classicDockTools.structure.label), action: () => openDockTab('structure'), active: structureOpen && dockRequest.tab === 'structure', id: 'structure', hint: tr('Дерево проекта: группы, корпуса, детали') },
      { icon: 'replace', label: tr('Замена'), action: () => openDockTab('replace'), id: 'replace', hint: tr('Заменить материал во всём проекте') },
      { icon: 'sun', label: tr('Свет…'), action: () => setLightDialogOpen(true), id: 'light', hint: tr('Эффекты, общий свет, камера и солнце') },
      { icon: 'render', label: tr('Рендер'), action: () => setRenderOpen(true), hint: tr('Картинка для клиента') },
      { icon: classicShopTools.nesting.icon, label: tr(classicShopTools.nesting.label), action: () => { window.location.href = '/cut' }, id: 'cut', hint: tr('Раскрой листов на отдельном экране'), separator: true },
      { icon: classicShopTools.quote.icon, label: tr(classicShopTools.quote.label), action: () => setQuoteOpen(true), disabled: Boolean(production.error), disabledReason: tr('Исправьте ошибки проекта'), id: 'quote', hint: tr('Цена для клиента, листы и раскрой') },
    ],
    [
      { icon: 'wire', label: tr('Контур'), action: () => setViewMode('wire'), active: viewMode === 'wire', hint: tr('Показать только рёбра') },
      { icon: 'ghost', label: tr('Полупрозрачно'), action: () => setViewMode('ghost'), active: viewMode === 'ghost', id: 'ghost', hint: tr('Видно, что внутри корпуса') },
      { icon: 'box', label: tr('Тело'), action: () => setViewMode('solid'), active: viewMode === 'solid', hint: tr('Обычный сплошной вид') },
      { icon: 'texture', label: tr('Реалистичный вид'), action: () => setRealisticView(!realisticView), active: sceneRealistic, id: 'realistic', hint: tr('Пол, стены и тени; без него пустая комната — сетка'), separator: true },
      { icon: 'xray', label: tr('Присадка (рентген)'), action: () => setXray(!xray), active: xray, id: 'xray', hint: tr('Отверстия и крепёж сквозь детали (X)') },
      { icon: 'fronts', label: tr('Скрыть фасады'), action: () => setShowFronts(!showFronts), active: !showFronts, id: 'fronts', hint: tr('Убрать двери и ящики, чтобы видеть полки') },
      { icon: 'doors', label: openness > 0 ? tr('Закрыть створки') : tr('Распахнуть'), action: () => setOpenness(openness > 0 ? 0 : 1), active: openness > 0, id: 'open-all' },
      { icon: 'door', label: selected && openPanels[selected] ? tr('Закрыть дверцу') : tr('Открыть дверцу'), action: () => { if (selected) togglePanelOpen(selected) }, disabled: !canToggleSelectedDoor(projectPanels.find((part) => part.id === selected)), disabledReason: tr('Выберите фасад'), id: 'door', separator: true },
      { icon: 'measure', label: tr('Размеры на сцене'), action: () => setShowDimensions(!showDimensions), active: showDimensions, hint: tr('Размерные линии в 3D') },
      { icon: 'magnet', label: tr('Привязка'), action: () => {
        if (snapOptions.grid > 0 || snapOptions.tolerance > 0) {
          previousSnapOptions.current = snapOptions
          setSnapOptions({ grid: 0, tolerance: 0 })
        } else setSnapOptions(previousSnapOptions.current)
      }, active: snapOptions.grid > 0 || snapOptions.tolerance > 0, hint: tr('Прилипание к сетке и соседям при перетаскивании') },
      { icon: 'person', label: tr('Человек для масштаба'), action: () => setSilhouette({ on: !silhouette.on }), active: silhouette.on, id: 'person', hint: tr('Силуэт человека рядом с мебелью'), separator: true },
      { icon: 'view', label: tr('Перспектива'), action: () => { setCameraPreset('three-quarter'); setProjection('perspective') }, hint: tr('Вся комната в перспективе') },
      { icon: 'zoomOut', label: tr('Отдалить'), action: () => zoomScene(-1), id: 'zoom-out', hint: tr('Как колесо мыши назад') },
      { icon: 'zoomIn', label: tr('Приблизить'), action: () => zoomScene(1), id: 'zoom-in', hint: tr('Как колесо мыши вперёд'), separator: true },
      { icon: 'walk', label: tr('Прогулка'), action: () => setWalk(!walk), active: walk, id: 'walk', hint: tr('Пройти по комнате (WASD)') },
    ],
    [
      { ...align[0]!, label: tr('Выровнять влево'), action: () => arrange('x', 'min'), id: 'align-x-min' },
      { ...align[1]!, label: tr('Выровнять по центру (X)'), action: () => arrange('x', 'center'), id: 'align-x-center' },
      { ...align[2]!, label: tr('Выровнять вправо'), action: () => arrange('x', 'max'), id: 'align-x-max' },
      { ...align[3]!, label: tr('Выровнять вниз'), action: () => arrange('y', 'min'), id: 'align-y-min' },
      { ...align[4]!, label: tr('Выровнять по центру (Y)'), action: () => arrange('y', 'center'), id: 'align-y-center' },
      { ...align[5]!, label: tr('Выровнять вверх'), action: () => arrange('y', 'max'), id: 'align-y-max' },
      { ...align[6]!, label: tr('Выровнять вперёд'), action: () => arrange('z', 'min'), id: 'align-z-min' },
      { ...align[7]!, label: tr('Выровнять по центру (Z)'), action: () => arrange('z', 'center'), id: 'align-z-center' },
      { ...align[8]!, label: tr('Выровнять назад'), action: () => arrange('z', 'max'), id: 'align-z-max' },
      { ...align[9]!, label: tr('Распределить по X'), action: () => arrange('x', 'distribute'), id: 'distribute-x' },
      { ...align[10]!, label: tr('Распределить по Y'), action: () => arrange('y', 'distribute'), id: 'distribute-y' },
      { ...align[11]!, label: tr('Распределить по Z'), action: () => arrange('z', 'distribute'), id: 'distribute-z' },
    ],
    [
      { icon: 'group', label: tr('Группировать'), action: groupTree, disabled: selectionIds.length < 2, disabledReason: needSelection, id: 'group', hint: 'Ctrl+G' },
      { icon: 'ungroup', label: tr('Разгруппировать'), action: ungroupActive, disabled: !canUngroup, disabledReason: tr('Выберите группу'), id: 'ungroup', separator: true },
      { icon: 'rotateCcw', label: tr('Повернуть на 90° против часовой'), action: () => rotateSelected(90), disabled: !canRotate, disabledReason: tr('Выберите элемент'), id: 'rotate-ccw' },
      { icon: 'rotateCw', label: tr('Повернуть на 90° по часовой'), action: () => rotateSelected(-90), disabled: !canRotate, disabledReason: tr('Выберите элемент'), id: 'rotate-cw' },
      { icon: 'mirror', label: tr('Зеркальная копия'), action: mirrorSelected, disabled: !canMirrorSelected, disabledReason: freeMirrorCheck?.reason ?? tr('Выберите редактируемый объект'), hint: tr('Отзеркалить корпус: петли и ящики на другую сторону'), separator: true },
      { icon: 'hide', label: tr('Скрыть'), action: hideSelected, disabled: !canHideSelected, disabledReason: tr('Выберите элемент'), id: 'hide', hint: tr('Вернуть — в «Структуре»') },
      { icon: 'lock', label: tr('Заблокировать'), action: () => guarded(() => setNodeLocked(activeId, !activeNode?.locked)), active: Boolean(activeNode?.locked), disabled: !canHideSelected, disabledReason: tr('Выберите элемент'), id: 'lock', hint: tr('Запретить случайные изменения'), separator: true },
      { icon: 'assembly', label: tr('Сборка'), action: () => setAssemblyStep(assemblyStep === null ? 1 : null), active: assemblyStep !== null, hint: tr('Показать сборку по шагам') },
      { icon: 'drill', label: tr('Присадка'), action: () => setDrillOpen(true), disabled: !activeEditable && !editableBoard, disabledReason: tr('Выберите корпус или доску'), id: 'drill', hint: tr('Отверстия выбранного корпуса или доски'), separator: true },
      { icon: 'help', label: tr('Горячие клавиши'), action: () => setHelpOpen(true), hint: '?' },
    ],
  ]).map((row) => [...row])

  return (
    <div className="p100-workspace flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100" data-workspace-style="classic">
      {propertiesNodeId && <PropertiesDialog nodeId={propertiesNodeId} catalog={catalog} panels={activePanels} boardPanel={boardPanel} error={error ?? null} onClose={() => { setPropertiesNodeId(null); setDraftState({ id: activeId, errors: {} }) }} />}
      <TemplateGallery />
      <AiPanel />
      <RoomPlan />
      <ShopSettings />
      {activeEditable ? <SketchEditor /> : null}
      {activeEditable || editableBoard ? <DrillEditor panels={activeBoard ? (boardPanel ? [boardPanel] : []) : activePanels} catalog={catalog} propertiesOpen={propertiesNodeId !== null} /> : null}
      {activeEditable ? <CustomParts catalog={catalog} /> : null}
      <ProjectPanel panels={projectPanels} catalog={catalog} />
      <HelpPanel classic={classic} />
      <ClassicRoomDialog />
      {partDialogId && projectPanels.some((panel) => panel.id === partDialogId) ? <ClassicPartDialog
        panel={projectPanels.find((panel) => panel.id === partDialogId)!} catalog={catalog}
        onClose={() => setPartDialogId(null)}
        onCabinetProperties={() => { setPartDialogId(null); setPropertiesNodeId(activeId) }}
        onDrilling={activeEditable ? () => { setPartDialogId(null); setDrillOpen(true) } : null} /> : null}
      <ClassicLightDialog />
      <ClassicReportsDialog
        groups={production.scene.nodes.map((node) => ({ name: findNode(root, node.nodeId)?.name ?? node.nodeId, panels: node.panels }))}
        cabinets={items.map((item) => ({ name: item.cabinet.name, height: item.cabinet.height, width: item.cabinet.width, depth: item.cabinet.depth, parts: item.panels.length }))}
        materials={catalog.materials}
        total={liveTotal && 'total' in liveTotal ? formatTengeExact(liveTotal.total) : null}
        onOpenQuote={() => setQuoteOpen(true)} />
      <HistoryPanel />
      {shareCodeOpen && <ShareCodeDialog />}
      {cloudEnabled && <AccountPanel />}
      {sceneContext && (() => {
        const nodeId = sceneContext.nodeId ?? activeId
        const node = findNode(root, nodeId)
        const part = projectPanels.find((item) => item.id === sceneContext.panelId)
        const allowed = contextActions(node?.kind ?? 'part', 1, cabinets.length, Boolean(node?.locked))
        const position = menuPosition({ left: sceneContext.x, right: sceneContext.x, top: sceneContext.y, bottom: sceneContext.y },
          window.innerWidth, window.innerHeight, 210, 'left')
        const item = (label: string, enabled: boolean, action: () => void) => <button type="button" role="menuitem" key={label}
          disabled={!enabled} className="block min-h-9 w-full border border-transparent px-3 text-left text-sm hover:bg-neutral-100 disabled:opacity-40"
          onClick={() => { setSceneContext(null); action() }}>{tr(label)}</button>
        return <div ref={sceneContextRef} role="menu" aria-label={tr('Элемент')}
          className="fixed z-[1000] w-[210px] overflow-y-auto border border-neutral-400 bg-white p-1 text-neutral-900"
          style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}>
          {item('Свойства', Boolean(node && propertiesNodeSupported(node.kind)), () => setPropertiesNodeId(nodeId))}
          {item('Копировать', allowed.copy, () => duplicateCabinet(nodeId))}
          {item('Удалить', allowed.delete, () => {
            if (node?.kind === 'cabinet') removeCabinet(nodeId)
            else if (node?.kind === 'board') removeBoard(nodeId)
            else if (node?.kind === 'annotation') removeAnnotation(nodeId)
            setSelected(null)
          })}
          {item('Группа', false, () => openDockTab('structure'))}
          {item('Разгруппировать', allowed.ungroup, () => ungroup(nodeId))}
          {item('Открыть дверцу', Boolean(part?.opening), () => togglePanelOpen(sceneContext.panelId))}
        </div>
      })()}
      {!production.error ? <QuoteView
        propertiesOpen={propertiesNodeId !== null}
        panels={projectPanels}
        hardware={projectHardware}
        manualItems={production.manualItems}
        projectName={projectName}
        moduleWidths={moduleWidths}
        specialParts={production.specialParts}
      /> : null}
      {/*
        PRO100-ДЕГІ МӘЗІР ЖОЛАҒЫ (docs/pro100/ui-design.md, §1: «Файл · Правка ·
        Вид · Элемент · Инструменты · Справка»). Пункттер `lib/classicMenu.ts`-те
        деректер ретінде сипатталады, ал `runClassicCommand` оларды store
        әрекетіне ТІКЕЛЕЙ аударады.

        ⚠ Жасырын header батырмасын `.click()` етуге БОЛМАЙДЫ: классикалық
        режимде ол header `display:none`, «Файл → Экспорт для цеха» ештеңе
        ашпайтын (аудит 09-26, P0-1). Ескі «Создать ▾» / «Проект ▾» мәзірлері
        Шағын экранда бұл қатарлар ықшам редактордың басқаруы болып қалады.
      */}

      <nav role="menubar" aria-label={tr('Главное меню')} data-tour="menubar" data-testid="classic-menubar" className="hidden lg:flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        <Link href="/" title={`${SITE.name} — ${tr('На главную')}`} className="mr-1 hidden items-center lg:inline-flex" data-testid="classic-brand">
          <img src="/brand/aismebel-mark.svg" width={16} height={16} alt={SITE.name} />
        </Link>
        {menus.map((menu) => <Menu key={menu.id} label={tr(menu.label)} size="sm" heightCap={1000} {...(menu.align ? { align: menu.align } : {})}>
          {menu.items.map((entry, index) => {
            if (entry.kind === 'separator') return <div key={`sep-${index}`} className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
            if (entry.kind === 'heading') return <div key={entry.id} className="px-2.5 pt-1 text-[10px] uppercase tracking-wide text-neutral-500">{tr(entry.label)}</div>
            if (entry.kind === 'slider') return <label key={entry.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300">
              {tr(entry.label)}
              <Slider value={exploded} onChange={setExploded} />
            </label>
            if (entry.kind === 'silhouetteHeight') return <label key={entry.id} className="flex flex-col gap-1 px-2.5 py-1.5 text-xs" data-testid="classic-silhouette-height">
              {tr(entry.label)}
              <input type="text" inputMode="numeric" value={silhouetteDraft} aria-invalid={Boolean(silhouetteError)}
                className={cn('w-24 border px-1.5 py-1 tabular-nums', silhouetteError ? 'border-red-600 text-red-700' : 'border-neutral-400')}
                onChange={(event) => {
                  const raw = event.target.value
                  setSilhouetteDraft(raw)
                  const parsed = parseSilhouetteHeight(raw)
                  if (parsed.value !== undefined) setSilhouette({ height: parsed.value })
                }} />
              {silhouetteError && <span role="alert" className="text-red-700">{tr(entry.label)}: {tr('Допустимо целое число в диапазоне')} {MIN_SILHOUETTE_HEIGHT}…{MAX_SILHOUETTE_HEIGHT} мм</span>}
            </label>
            return <MenuItem key={entry.id} active={entry.active ?? false} disabled={entry.disabled ?? false}
              title={classicMenuItemTitle(entry.raw ? entry.label : tr(entry.label), entry.hint)}
              onClick={() => runClassicCommand(entry.command)}>
              <span data-menu-item={entry.id}>{entry.raw ? entry.label : tr(entry.label)}</span>
              {entry.detail ? <span className="tabular-nums font-semibold">{entry.detail}</span> : null}
              {entry.hint ? <span className="ml-auto text-neutral-400">{entry.hint}</span> : null}

            </MenuItem>

          })}
        </Menu>)}

        <span data-testid="classic-project-title" className="ml-3 max-w-64 truncate border-l border-neutral-300 pl-3 font-semibold" title={projectName}>{projectName}</span>
      </nav>

      {cloudEnabled && <ApprovalBanner code={shareCode} />}

      <div className="p100-toolbar hidden lg:block" data-testid="classic-toolbar">
        {classicToolRows.map((row, index) => <div className="p100-toolbar-row" key={index} role="toolbar"
          aria-label={tr(['Стандартная', 'Вид', 'Выравнивание', 'Элемент'][index] ?? 'Панель инструментов')}>
          <span className="p100-toolbar-band">
          <span className="p100-toolbar-gripper" aria-hidden="true" />
          {row.map((tool) => <span key={`${tool.icon}-${tool.label}`} className="p100-toolbar-cell">
            <ClassicTool {...tool} onHover={setHoveredToolLabel} />
            {tool.separator && <span className="p100-toolbar-separator" aria-hidden="true" />}
          </span>)}
          </span>
          {index === classicToolRows.length - 1 && assemblyStep !== null && <label className="ml-2 flex items-center gap-1 border border-neutral-400 px-1 text-xs" data-testid="classic-assembly-step">
            <span>{tr('Сборка')}</span>
            <input type="range" aria-label={tr('Показать сборку по шагам')} min={1}
              max={assemblyStepView(assemblyStep, projectPanels.length).max}
              value={assemblyStepView(assemblyStep, projectPanels.length).value}
              onChange={(event) => setAssemblyStep(Number(event.target.value))} />
            <span className="tabular-nums">{assemblyStepView(assemblyStep, projectPanels.length).label}</span>
          </label>}
          {index === classicToolRows.length - 1 && <div className="p100-xr-tools">
            {hasActiveCabinet && !sceneError && !projectLoadError ? <span data-testid="classic-ar"><ArButton /></span> : null}
            <span data-testid="classic-vr"><VrButton /></span>
          </div>}
        </div>)}
      </div>
      <header className="compact-tools flex shrink-0 flex-wrap items-center gap-1 overflow-visible border-b border-neutral-200 px-2 py-1 dark:border-neutral-800">
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
        <h1 className="ml-auto max-w-[55vw] truncate text-sm font-semibold" title={projectName}>{projectName}</h1>

        {/*
          ТОПТАЛҒАН ТАҚТА: бұрын 30+ батырма қатар тұрып «каша» болатын. Енді
          жасау мен жоба құралдары ашылмалы мәзірге жиналды — тек жиі керегі
          көзде. Клиентке сілтеме де осында.
        */}
        <div data-testid="mobile-tool-row" className="flex w-full flex-nowrap items-center gap-1">
          <Menu label={tr('Создать')} title={tr('С чего начать корпус')}>
            <MenuItem onClick={() => setGalleryOpen(true)}>{tr('Готовые шаблоны')}</MenuItem>
            <MenuItem onClick={() => setAiOpen(true)}>{tr('Техзадание (словами)')}</MenuItem>
            <MenuItem onClick={() => setSketchOpen(true)} disabled={!activeEditable}>{tr('Нарисовать мышью')}</MenuItem>
            <MenuItem onClick={() => setPartsOpen(true)} disabled={!activeEditable}>{tr('Своя деталь')}</MenuItem>
          </Menu>
          <Menu label={tr('Проект')} title={tr('Материалы, раскрой, присадка, смета')}>
            <MenuItem onClick={() => downloadProjectFile(exportProject())}>{tr('Сохранить')}</MenuItem>
            <MenuItem onClick={openProjectPicker}>{tr('Открыть')}</MenuItem>
            <MenuItem onClick={() => setProjectOpen(true)}>{tr('Материалы и сборка')}</MenuItem>
            <MenuItem onClick={() => setShopOpen(true)}>{tr('Цех')}</MenuItem>
            <MenuItem onClick={() => openDockTab('library')}>{tr('Библиотека')}</MenuItem>
            <MenuItem onClick={() => setQuoteOpen(true)} disabled={Boolean(production.error)}>{tr('Смета и раскрой')}</MenuItem>
            <MenuItem onClick={() => setDrillOpen(true)} disabled={!activeEditable && !editableBoard}>{tr('Присадка')}</MenuItem>
            <MenuItem onClick={() => setRoomOpen(true)}>{tr('Стены и комната')}</MenuItem>
            <MenuItem onClick={() => setHistoryOpen(true)}>{tr('История')}</MenuItem>
            <MenuItem onClick={() => void copyClientLink()}>{tr('Ссылка клиенту')}</MenuItem>
            {/* qdesign «3D-көріністе ашу» сияқты: 6 таңбалы код, 24 сағат, автожаңарту. */}
            <MenuItem onClick={() => setShareCodeOpen(true)}>{tr('Код для клиента')}</MenuItem>
            <MenuItem onClick={() => { window.location.assign('/cut') }}>{tr('Раскрой')}</MenuItem>
            <MenuItem onClick={requestReset}>{tr('Сброс')}</MenuItem>
          </Menu>
          <div data-testid="mobile-more-tools" className="sm:hidden">
            <Menu label="⋯" title={tr('Дополнительные инструменты')} ariaLabel={tr('Дополнительные инструменты')} align="right">
              <MenuItem onClick={() => setHelpOpen(true)}>{tr('Горячие клавиши')}</MenuItem>
              <MenuItem onClick={undo} disabled={!canUndo}>{tr('Отменить')}</MenuItem>
              <MenuItem onClick={redo} disabled={!canRedo}>{tr('Повторить')}</MenuItem>
              <MenuItem onClick={() => setShowDimensions(!showDimensions)} active={showDimensions}>{tr('Размеры на сцене')}</MenuItem>
              <MenuItem onClick={fitCamera}>{tr('Вписать в кадр')}</MenuItem>
              <MenuItem onClick={() => setShowFronts(!showFronts)} active={!showFronts}>{showFronts ? tr('Скрыть фасады') : tr('Показать фасады')}</MenuItem>
              {(projectPanels.length > 0 || production.specialParts.length > 0) && productionState.exportsAvailable ? <ExportMenu inline cabinet={cabinet ?? undefined} pdfCabinet={pdfCabinet} pdfAssembly={pdfAssembly} panels={activePanels} projectPanels={projectPanels} specialParts={production.specialParts} projectName={projectName} onError={setExportError} /> : null}
              {cloudEnabled && <MenuItem onClick={() => setAccountOpen(true)}>{tr('Аккаунт')}</MenuItem>}
              <AppearanceSwitch menu />
              <LangSwitch inline />
            </Menu>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <Button onClick={() => setHelpOpen(true)} title={tr('Горячие клавиши')}>?</Button>
            <Button onClick={undo} disabled={!canUndo} title="Ctrl+Z">↶</Button>
            <Button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">↷</Button>
          </div>
        </div>

        <div className="hidden"><ProjectMenu /></div>
        <div data-testid="workspace-view-menu" className="hidden sm:block"><Menu label={tr('Вид')} size="sm" title={tr('Прозрачность, фасады, проекция, масштаб')}>
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
          <MenuItem active={xray} onClick={() => setXray(!xray)}>{tr('Присадка (рентген)')} · X</MenuItem>
          <MenuItem onClick={fitCamera}>{tr('Вписать в кадр')}</MenuItem>
          <MenuItem active={silhouette.on} onClick={() => setSilhouette({ on: !silhouette.on })}>
            {tr('Человек для масштаба')}
          </MenuItem>
          <MenuItem onClick={() => setViewMode(viewMode === 'solid' ? 'ghost' : viewMode === 'ghost' ? 'wire' : 'solid')}>
            {viewMode === 'solid' ? tr('Тело') : viewMode === 'ghost' ? tr('Полупрозрачно') : tr('Контур')}
          </MenuItem>
          <MenuItem onClick={() => setRenderOpen(true)}>{tr('Рендер')}</MenuItem>
          <MenuItem onClick={() => setWalk(!walk)}>{tr('Прогулка')}</MenuItem>
          <MenuItem onClick={() => setOpenness(openness > 0 ? 0 : 1)}>{openness > 0 ? tr('Закрыть створки') : tr('Распахнуть')}</MenuItem>
          <MenuItem onClick={() => setAssemblyStep(assemblyStep === null ? 1 : null)}>{tr('Сборка')}</MenuItem>
          {assemblyStep !== null ? <label className="flex items-center gap-2 px-2 py-1 text-sm">
            {tr('Показать сборку по шагам')}
            <input type="range" min={1} max={Math.max(1, projectPanels.length)}
              value={Math.min(assemblyStep, projectPanels.length)}
              onChange={(event) => setAssemblyStep(Number(event.target.value))} />
            <span>{Math.min(assemblyStep, projectPanels.length)} / {projectPanels.length}</span>
          </label> : null}
          <div className="flex gap-1 border-t border-neutral-200 px-2 py-1">
            {hasActiveCabinet && !sceneError && !projectLoadError ? <ArButton /> : null}
            <VrButton />
          </div>
        </Menu></div>
        {silhouette.on ? <div className="hidden flex-col gap-0.5 sm:flex">
          <input type="text" inputMode="numeric" aria-label={tr('Рост человека, мм')}
            aria-invalid={Boolean(silhouetteError)} aria-describedby={silhouetteError ? 'silhouette-height-error' : undefined}
            className={cn('w-20 border bg-white px-1.5 py-1 text-xs tabular-nums dark:bg-neutral-900',
              silhouetteError ? 'border-red-600 text-red-700' : 'border-neutral-300 dark:border-neutral-700')}
            value={silhouetteDraft} title={tr('Рост человека, мм')}
            onChange={(event) => {
              const raw = event.target.value
              setSilhouetteDraft(raw)
              const parsed = parseSilhouetteHeight(raw)
              if (parsed.value !== undefined) setSilhouette({ height: parsed.value })
            }} />
          {silhouetteError ? <span id="silhouette-height-error" role="alert" className="text-xs text-red-700">
            {tr('Рост человека, мм')}: {tr('Допустимо целое число в диапазоне')} {MIN_SILHOUETTE_HEIGHT}…{MAX_SILHOUETTE_HEIGHT} мм
          </span> : null}
        </div> : null}
        {/* Сирек керегі оң жақта; көрініс құралдары 3D-нің өз үстіне көшті. */}
        <div className="hidden min-w-0 flex-wrap items-center gap-1 sm:ml-auto sm:flex">
          {/* БАҒА (qdesign сияқты): басу — смета; баға қойылмаса — цех профилі. */}
          {liveTotal ? (
            'total' in liveTotal ? (
              <Button onClick={() => setQuoteOpen(true)} title={tr('Итого клиенту — открыть смету')}>
                <span className="tabular-nums font-semibold">{formatTengeExact(liveTotal.total)}</span>
              </Button>
            ) : (
              <Button onClick={() => setShopOpen(true)} title={tr('Задайте цены материалов в профиле цеха')}>
                <span className="whitespace-nowrap">{tr('Цены не заданы')}</span>
              </Button>
            )
          ) : null}
          {(projectPanels.length > 0 || production.specialParts.length > 0) && productionState.exportsAvailable ? <ExportMenu cabinet={cabinet ?? undefined} pdfCabinet={pdfCabinet} pdfAssembly={pdfAssembly} panels={activePanels} projectPanels={projectPanels} specialParts={production.specialParts} projectName={projectName} /> : null}
          {cloudEnabled && (
            <Button onClick={() => setAccountOpen(true)} title={tr('Аккаунт и проекты в облаке')}>{tr('Аккаунт')}</Button>
          )}
          <AppearanceSwitch />
          <LangSwitch />
        </div>

        <span className={cn('hidden',
            mounted && ms > BUDGET_MS
              ? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] tabular-nums text-red-800 dark:bg-red-950 dark:text-red-300'
              : 'rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-600 dark:bg-neutral-800'
          )}
          title={`Бюджет: ${BUDGET_MS} мс`}
        >
          {projectPanels.length} панелей{cabinets.length > 1 ? ` · корпусов: ${cabinets.length}` : ''}{mounted ? ` · ${ms.toFixed(1)} мс` : ''}
        </span>
      </header>

      {/* 390 px экранда canvas-тан бөлек тұратын тұрақты қасиет батырмасы. */}
      {(activeBoard || activeSolid || cabinet) && <div data-testid="mobile-properties-trigger"
        className="relative z-30 flex shrink-0 flex-col gap-1 border-b border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
        <span data-testid="mobile-module-name" className="text-xs font-medium" title={activeNode?.name ?? cabinet?.name ?? activeBoard?.name ?? activeSolid?.name}>{activeNode?.name ?? cabinet?.name ?? activeBoard?.name ?? activeSolid?.name}</span>
        {cabinet && <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
          <Button tour="mobile-size" size="sm" onClick={() => setPropertiesNodeId(activeId)}>{tr('Габариты')}</Button>
          <Button tour="mobile-sections" size="sm" onClick={() => setPropertiesNodeId(activeId)}>{tr('Секции модуля')}</Button>
          <Button tour="mobile-cutlist" size="sm" onClick={() => {
            if (!cutOpen) toggleCut()
            document.querySelector('[data-tour="cutlist"]')?.scrollIntoView({ block: 'nearest' })
          }}>{tr('Деталировка')}</Button>
        </div>}
        {!cabinet && <Button onClick={() => setPropertiesNodeId(activeId)}>{tr('Свойства')}</Button>}
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
      {fileOpenError && <div role="alert" className="flex items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
        <span className="flex-1">{fileOpenError}</span>
        <Button size="sm" onClick={() => setFileOpenError(null)}>{tr('Закрыть')}</Button>
      </div>}
      {historyRestoreError && (
        <div role="alert" className="flex items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <span className="flex-1">{historyRestoreError}</span>
          <Button size="sm" onClick={dismissHistoryRestoreError}>{tr('Закрыть')}</Button>
        </div>
      )}
      {localConflict && <div role="alert" className="relative z-30 flex flex-wrap items-center gap-2 border-b border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <span className="w-full">{tr('Проект изменён в другой вкладке. Какую версию сохранить?')}</span>
        <Button size="sm" onClick={() => resolveLocalConflict('other')}>{tr('Открыть версию другой вкладки')}</Button>
        <Button size="sm" onClick={() => resolveLocalConflict('mine')}>{tr('Сохранить мою версию')}</Button>
        <Button size="sm" onClick={() => downloadProjectFile(exportProject())}>{tr('Скачать копию JSON')}</Button>
      </div>}
      {localSaveError && !localConflict && <div role="alert" className="relative z-30 flex flex-wrap items-center gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:bg-red-950 dark:text-red-100">
        <span className="flex-1">{localSaveError}</span>
        <Button size="sm" onClick={() => downloadProjectFile(exportProject())}>{tr('Скачать копию JSON')}</Button>
        <Button size="sm" onClick={() => saveProjectLocally()}>{tr('Повторить сохранение')}</Button>
      </div>}

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
      <RenderPanel panels={projectPanels} cabinets={items.map((item) => item.cabinet)} />
      {/*
        3D-де БАСЫП таңдалған деталь: цехтың сұрағы «мынау қандай деталь»
        деп басталады, ал жауап әрқашан бір жерде тұруы керек.
      */}
      {selected ? (() => {
        // Іздеу ЖОБА тізімінен: бір жобадағы екі шкафтың детальі де осында.
        const part = projectPanels.find((p) => p.id === selected)
        if (!part) return null
        return (
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
            <b>{panelDisplayLabel(part.label)}</b>
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
      <div data-library-open={libraryOpen ? 'true' : undefined} className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[max-content_max-content] overflow-y-auto overscroll-contain lg:grid-cols-[28px_minmax(0,1fr)_340px] lg:grid-rows-none lg:overflow-hidden">
        {/*
          СОЛ ЖАҚТАҒЫ ТАР ТІК ҚҰРАЛДАР ЖОЛАҒЫ (docs/pro100/ui-design.md, §3).
          Бұл жолақ бар әрекеттерге жылдам жол ашады; таңдау сахнада басу,
          жылжыту сахнада сүйреу арқылы орындалады.
          Телефонда жасырын: PRO100 макеті десктопқа арналған.
        */}
        <div className="p100-side-tools hidden border-r border-neutral-200 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:py-1.5 dark:border-neutral-800" data-testid="classic-side-tools" role="toolbar" aria-orientation="vertical" aria-label={tr('Панель элементов')}>
            <ClassicTool icon="select" label={tr('Выбор')} action={() => setSelected(null)} active={!selected} hint={tr('Щелчок — выбрать, двойной щелчок — свойства')} onHover={setHoveredToolLabel} />
            <span className="p100-side-separator" aria-hidden="true" />
            <ClassicTool icon="insert" label={tr('Новый корпус')} action={addCabinet} id="new" hint={tr('Добавить корпус к стене комнаты')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="board" label={tr('Добавить свободную доску')} action={addBoard} hint={tr('Прямоугольная деталь в любом месте')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="decor" label={tr('Добавить декоративный блок')} action={addSolid} hint={tr('Объём без деталировки: техника, декор')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="text" label={tr('Добавить текст')} action={addAnnotation} id="annotation" hint={tr('Надпись в комнате, не идёт в раскрой')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="lathe" label={tr('Токарная деталь')} action={() => insertSpecialPart('lathe')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="bent" label={tr('Гнутая деталь')} action={() => insertSpecialPart('bent')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="import" label={tr('Импорт → 3DS/OBJ')} action={() => importInputRef.current?.click()} hint={tr('Вставить 3D-модель из файла')} onHover={setHoveredToolLabel} />
            <span className="p100-side-separator" aria-hidden="true" />
            <ClassicTool icon="sketch" label={tr('Нарисовать мышью')} action={() => setSketchOpen(true)} disabled={!activeEditable} disabledReason={tr('Выберите редактируемый корпус')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="parts" label={tr('Своя деталь')} action={() => setPartsOpen(true)} disabled={!activeEditable} disabledReason={tr('Выберите редактируемый корпус')} onHover={setHoveredToolLabel} />
            <ClassicTool icon="cutlist" label={tr('Деталировка')} action={toggleCut} active={cutOpen} hint={tr('Таблица деталей под сценой')} onHover={setHoveredToolLabel} />
            <span className="p100-side-separator" aria-hidden="true" />
            <ClassicTool icon="fit" label={tr('Вписать в кадр')} action={fitCamera} hint={tr('Приблизить камеру к мебели')} onHover={setHoveredToolLabel} />
        </div>
        <div className="flex min-h-0 flex-col overflow-y-auto lg:overflow-hidden">
        {/* Телефонда 3D көрінеді, ал секция редакторына бөлек scroll биіктігі қалады. */}
        {!walk && <div data-testid="mobile-tree-dock" className="relative z-20 shrink-0 px-2 pt-1 lg:hidden"><TreeDock request={dockRequest} /></div>}
        <main className="relative isolate h-[50dvh] min-h-[370px] flex-none overflow-hidden lg:h-auto lg:min-h-64 lg:max-h-none lg:flex-1" data-tour="scene"
          // PRO100: модульді Библиотекадан сахнаға сүйреп тастау.
          onDragOver={(event) => { if (hasDraggedLibraryTile()) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }}
          onDrop={(event) => { if (hasDraggedLibraryTile()) { event.preventDefault(); dropDraggedLibraryTile() } }}>

          <WorkspaceDock>
          {/* absolute inset-0 — канвас өлшемі бірінші кадрда-ақ анық болуы үшін */}
          <div className="absolute inset-0">
            <Scene items={items} room={room} activeId={activeId} catalog={catalog} flatScene={scene} classic={classic} />
          </div>
          {/* 3D-де таңдалған деталь жайлы ақпарат сахна өлшемін өзгертпейді. */}
          {selected ? (() => {
            // Іздеу ЖОБА тізімінен: бір жобадағы екі шкафтың детальі де осында.
            const part = selectedPart
            if (!part) return null
            return (
              <div data-testid="selected-info-overlay" className="p100-selection-bar pointer-events-auto absolute lg:hidden inset-x-2 bottom-2 z-20 flex max-h-[45%] flex-wrap items-center gap-2 overflow-y-auto px-3 py-1.5 text-xs">
                <b>{panelDisplayLabel(part.label)}</b>
                <span className="p100-muted tabular-nums">
                  {tr('Готовый · клиент')}: {part.finishedLength} (L) × {part.finishedWidth} (W)
                </span>
                <span className="p100-cut tabular-nums">
                  {tr('Рез · цех')}: {part.cutLength} (L) × {part.cutWidth} (W)
                </span>
                <span className="p100-muted tabular-nums">
                  {part.drilling.length} {tr('отв.')}
                </span>
                {part.note ? <span className="p100-muted truncate">{part.note}</span> : null}
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
          <ClassicStartGuide onRoom={() => setRoomDialogOpen(true)} onLibrary={() => setLibraryOpen(true)} />
          {/* Бір канондық ағаш: корпус, еркін тақта, топ және қабаттар. */}
          {walk ? null : structureOpen ? <ClassicStructureWindow onClose={() => setStructureOpen(false)} dockRequest={dockRequest}
            canOpenProperties={propertiesNodeSupported(activeNode?.kind)} onProperties={() => setPropertiesNodeId(activeId)} /> : null}
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
              <div className="pointer-events-auto flex items-center gap-3 border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-white">
                <span>{touch
                  ? tr('Джойстик: идти · проведите пальцем: осмотр · коснитесь дверцы: открыть')
                  : tr('Кликните для обзора · WASD: идти · E: дверцы · Esc: курсор')}</span>
                <button
                  type="button"
                  className="border border-neutral-500 bg-neutral-800 px-2.5 py-1 hover:bg-neutral-700"
                  onClick={() => setWalk(false)}
                >
                  {tr('Выйти')}
                </button>
              </div>
            </div>
          ) : null}
          {/* Телефонда прогулканың жүрісі — джойстик (перне жоқ). */}
          {walk && touch ? <TouchJoystick /> : null}
          </WorkspaceDock>
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
          className="p100-view-tabs flex items-center gap-0.5 overflow-x-auto border-t border-neutral-200 bg-neutral-50 px-1 py-1 dark:border-neutral-800 dark:bg-neutral-900"
          data-tour="viewtabs"
        >
          {VIEW_TABS.map((v, index) => {
            const isActive = cameraPreset === v.preset && (v.projection === undefined || projection === v.projection)
            return (
              <span key={v.key} className="p100-view-tab-cell">
              {index > 0 && <span className="p100-view-tab-divider" aria-hidden="true">|</span>}
              <button type="button" className="p100-view-tab min-h-11 sm:min-h-0" aria-current={isActive ? 'page' : undefined}
                key={v.key}
                aria-label={tr(v.ruLabel)}
                onClick={() => {
                  setCameraPreset(v.preset)
                  if (v.projection) setProjection(v.projection)
                }}
              >
                <span className="shrink-0 whitespace-nowrap sm:hidden">{mobileViewLabel(v.key, getLang(), tr(v.ruLabel))}</span>
                <span className="hidden sm:inline">{tr(v.ruLabel)}</span>
              </button>
              </span>
            )
          })}
          {/* PRO100 «Камера 1»: ағымдағы камера; басу — жиһазға кадрлау. */}
          <button type="button" className="p100-camera-tab hidden lg:inline-flex" data-testid="classic-camera-tab"
            title={tr('Текущая камера — щелчок: вписать мебель в кадр')} onClick={fitCamera}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="5.5" width="9" height="6" fill="none" stroke="currentColor" /><path d="M3.5 5.5V3.5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" /></svg>
            {tr('Камера 1')}
          </button>
        </div>
        <section
          className={cn('border-t border-neutral-200 dark:border-neutral-800', cutOpen && 'h-72', classic && !cutOpen && 'lg:hidden')}
          data-tour="cutlist"
          data-tour-mobile="cutlist"
        >
          {productionState.cutListAvailable
            ? <CutListTable panels={projectPanels} catalog={catalog} specialParts={production.specialParts} collapsed={!cutOpen} onToggle={toggleCut} />
            : <div role="status" className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {tr('Деталировка временно недоступна. Экспорт заблокирован.')}
            </div>}
        </section>
        </div>
        <aside className="relative z-10 flex h-[30dvh] min-h-0 flex-col overflow-hidden border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">

          {/* Қай модуль өңделіп жатыр — панельдің басында, қатесіз оқылатындай. */}
          <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800 lg:hidden">
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
            </> : activeAnnotation ? <div className="truncate text-sm font-semibold" title={activeAnnotation.name}>{activeAnnotation.name}</div>
              : <div className="text-sm text-neutral-500">{tr('Выберите корпус в структуре проекта')}</div>}
            {propertiesNodeSupported(activeNode?.kind) && <Button size="sm" onClick={() => setPropertiesNodeId(activeId)}>{tr('Свойства')}</Button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:hidden">
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
              ) : activeAnnotation ? (
                <AnnotationProperties node={activeAnnotation} />
              ) : null}
            </Dense>
          </div>
          {/* Корпус әрекеттері әрқашан көзде (qdesign-дің астыңғы қатары сияқты). */}
          <div className="flex shrink-0 flex-nowrap gap-1 overflow-x-auto whitespace-nowrap border-t border-neutral-200 p-2 dark:border-neutral-800 lg:hidden">
            <Button onClick={addCabinet}>{tr('+ корпус')}</Button>
            <Button onClick={addBoard}>{tr('+ доска')}</Button>
            <Button onClick={addSolid}>{tr('+ блок')}</Button>
            <Button onClick={() => insertSpecialPart('lathe')}>{tr('Токарная деталь')}</Button>
            <Button onClick={() => insertSpecialPart('bent')}>{tr('Гнутая деталь')}</Button>
            <label className="text-xs">{tr('Единица 3D')}
              <select className="ml-1 border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
                value={importUnit} onChange={(event) => setImportUnit(Number(event.target.value))}>
                <option value={1}>мм</option><option value={10}>см</option><option value={1000}>м</option>
              </select>
            </label>
            <Button onClick={() => importInputRef.current?.click()}>{tr('Импорт → 3DS/OBJ')}</Button>
            <input ref={importInputRef} type="file" accept=".3ds,.obj,.png,.jpg,.jpeg,.webp" multiple className="sr-only"
              aria-label={tr('Файлы 3DS/OBJ и текстуры')} onChange={(event) => { void importSolidFiles(event.target.files) }} />
            <Button onClick={addAnnotation} testId="add-annotation">{tr('+ текст')}</Button>
            {activeBoard && <Button onClick={() => removeBoard(activeId)}
              disabled={!editableBoard || Boolean(activeBoardJoint)}>{tr('Удалить доску')}</Button>}
            <Button onClick={() => duplicateCabinet(activeId)} disabled={!activeEditable} title={tr('Дублировать корпус')}>{tr('Дублировать')}</Button>
            <Button onClick={mirrorSelected} disabled={!canMirrorSelected} title={freeMirrorCheck?.reason ?? tr('Зеркальная копия')}>{tr('Зеркало')}</Button>
            <Button
              onClick={() => { removeCabinet(activeId); setSelected(null) }}
              disabled={cabinets.length < 1 || !activeEditable}
              title={tr('Удалить корпус')}
            >
              {tr('Удалить')}
            </Button>
          </div>
          {specialError && <p role="alert" className="border-t border-red-200 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-300">{specialError}</p>}
        </aside>
        {libraryOpen ? <div className="p100-library-slot hidden lg:flex">
          <ClassicLibraryDock catalog={catalog} onClose={() => setLibraryOpen(false)} onInsertCabinet={insertCabinet}
            onLoadSet={loadTemplateSet} onApplyMaterial={applyMaterial} elements={libraryElements} other={libraryOther} />
        </div> : null}
      </div>
      {xray && <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-neutral-300 bg-white px-2 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-950"
        role="status" data-testid="xray-legend" aria-label={tr('Присадка (рентген)')}>
        {drillLegend.map((entry) => <span key={entry.purpose} className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span className="h-2.5 w-2.5 border border-neutral-500" style={{ backgroundColor: entry.color }} />
          {tr(entry.label)}
        </span>)}
      </div>}
      {toolError ? <div role="alert" className="p100-tool-error hidden lg:flex" data-testid="classic-tool-error">
        <span>{toolError}</span>
        <button type="button" onClick={() => setToolError(null)}>{tr('Закрыть')}</button>
      </div> : null}
      <footer className="p100-status hidden lg:flex" role="status" data-testid="p100-status">
        {/* PRO100: слева — подсказка инструмента или «Выбран элемент: "…"», справа — положение и габарит. */}
        <span className="p100-status-text">{classicToolStatus(hoveredToolLabel, selected,
          selectedStatusName(selected, activeNode, selectedPart, tr) === null ? null : `"${selectedStatusName(selected, activeNode, selectedPart, tr)}"`,
          tr('Выбран элемент'), tr('Элемент не выбран — щёлкните по мебели или откройте «Библиотеку»'))}
          {!hoveredToolLabel && selected ? <span className="p100-status-hint"> · {tr('двойной щелчок — «Свойства», Del — удалить')}</span> : null}
        </span>
        {selected && selectedPart ? <span className="ml-auto flex items-center gap-3 tabular-nums">
          <span title={tr('Готовый · клиент')}>{tr('Готовый · клиент')}: {selectedPart.finishedLength} (L) × {selectedPart.finishedWidth} (W)</span>
          <span title={tr('Рез · цех')}>{tr('Рез · цех')}: {selectedPart.cutLength} (L) × {selectedPart.cutWidth} (W)</span>
        </span> : selected && activeNode && <span className="ml-auto flex items-center gap-3 tabular-nums">
          <span className="p100-status-metric" title={tr('Положение')}>
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11"><path d="M1.5 3V1.5H3M8 1.5h1.5V3M9.5 8v1.5H8M3 9.5H1.5V8" fill="none" stroke="currentColor" /></svg>
            X {activeNode.transform.pos.x} · Y {activeNode.transform.pos.y} · Z {activeNode.transform.pos.z}
            {activeNode.transform.rot.y ? ` · ${tr('Поворот')} ${activeNode.transform.rot.y}°` : ''}
          </span>
          <span className="p100-status-metric" title={tr('Размеры')}>
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11"><path d="M1.5 1.5h8v8h-8z" fill="none" stroke="currentColor" strokeDasharray="2 1" /><path d="M3 8l5-5M6 3h2v2" fill="none" stroke="currentColor" /></svg>
            {activeNode.kind === 'cabinet'
              ? `${activeNode.config.height} (H) × ${activeNode.config.width} (W) × ${activeNode.config.depth} (D)`
              : activeNode.kind === 'board' && catalog.materials.find((material) => material.id === activeNode.board.materialId)
                ? (() => { const size = boardDimensions(activeNode.board, catalog.materials.find((material) => material.id === activeNode.board.materialId)!); return `${size.height} (H) × ${size.width} (W) × ${size.depth} (D)` })()
                : activeNode.kind === 'solid' ? `${activeNode.solid.size.y} (H) × ${activeNode.solid.size.x} (W) × ${activeNode.solid.size.z} (D)` : '—'} мм
          </span>
        </span>}
        {/* Баға күй жолағында да (P0-5): басу — смета, баға қойылмаса — цех профилі. */}
        {liveTotal && <button type="button" data-testid="p100-status-price" className={cn('p100-status-price', !(selected && activeNode) && 'ml-auto')}
          onClick={() => ('total' in liveTotal ? setQuoteOpen(true) : setShopOpen(true))}
          title={'total' in liveTotal ? tr('Итого клиенту — открыть смету') : tr('Задайте цены материалов в профиле цеха')}>
          {'total' in liveTotal ? <span className="tabular-nums">{tr('Итого клиенту')}: <b>{formatTengeExact(liveTotal.total)}</b></span> : tr('Цены не заданы')}
        </button>}
      </footer>
    </div>
  )
}
