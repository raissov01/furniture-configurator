'use client'

/**
 * PRO100-дың «Библиотека» панелі — нобайлы тор (docs/pro100/ui-design.md §2,
 * скриншот: `Pictures/Screenshots/Screenshot from 2026-09-20 17-49-08.png`).
 * Эталон — оң жақтағы 4 таб + жол жолағы (ашылмалы) + 2 бағанды нобай торы.
 *
 * Дерек көзі: `src/core/data/pro100Catalog.ts` (PRO100 v7.08 кітапханасының
 * 5094 `.meb` атауынан талданған, ЕШТЕҢЕ ОЙДАН ШЫҒАРЫЛМАҒАН — тек атаудан
 * оқылатын өріс толтырылған) және `basisCatalog.ts` (бүгін импортталған
 * Базис материалдары, «Материалы» табы).
 *
 * ⚠ `components/dock/`-тың ІШІНДЕ тұруға арналған (DockHost панелі ретінде),
 * бірақ өзі докингке ТӘУЕЛДІ ЕМЕС — кез келген контейнерге сыяды.
 *
 * ⚠ СТОРҒА ТИМЕЙДІ (файл ретінде). `components/panels/ReplacePanel.tsx`
 * қолданған тәсілмен бірдей: `useConfigurator.setState(...)` — zustand-тың
 * ӨЗ статикалық API-і, `store/configurator.ts`-ке жаңа action қоспай-ақ.
 * Ол файл қазір бірнеше агенттің қолында (тапсырмадағы ескерту).
 */
import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useConfigurator } from '@/store/configurator'
import { findTemplate, templateToCabinet } from '@/src/core/index'
import { BASIS_EDGE_BANDS, BASIS_MATERIALS } from '@/src/core/data/basisCatalog'
import { addBasisCatalogItem } from './basisLibrarySelect'
import type { EdgeBand, Material } from '@/src/core/types'
import {
  PRO100_ACCESSORY_ITEMS,
  PRO100_CABINET_ITEMS,
} from '@/src/core/data/pro100Catalog'
import type { Pro100LibraryItem } from '@/src/core/data/pro100Catalog'
import {
  categoryLabel,
  categoryOptions,
  cabinetImportChoice,
  filterItems,
  LIBRARY_TABS,
  paginate,
  visibleCategoryOptions,
  BASIS_MODULE_ITEMS,
  BASIS_FITTING_ITEMS,
  basisModuleChoice,
  BASIS_FITTING_KIND_LABELS,
} from './libraryCatalogLogic'
import type { BasisFittingItem, BasisModuleItem, LibraryTabId } from './libraryCatalogLogic'
import { CatalogThumb } from './CatalogThumb'
import { PersonalLibraryPanel } from './PersonalLibraryPanel'
import { parsePropCoordinate } from '@/lib/propCoordinateUi'
import { makePropLibraryItem, placedProps, PROP_CATALOG, removePropNode } from '@/src/core/propCatalog'
import type { Vec3 } from '@/src/core/types'

const PAGE_SIZE = 60 // гоча №4: 5094 жолды бірден рендерлемеу — беттеу

export function LibraryPanel() {
  const [tab, setTab] = React.useState<LibraryTabId | 'mine'>('mebel')
  const [search, setSearch] = React.useState('')
  const [categoryPath, setCategoryPath] = React.useState<string | null>(null)
  const [categorySearch, setCategorySearch] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [lastAdded, setLastAdded] = React.useState<string | null>(null)
  const [pendingCabinet, setPendingCabinet] = React.useState<Pro100LibraryItem | null>(null)
  const [pendingBasis, setPendingBasis] = React.useState<BasisModuleItem | null>(null)
  const [propPosition, setPropPosition] = React.useState<Vec3>({ x: 0, y: 0, z: 0 })
  const [propDraft, setPropDraft] = React.useState<Record<keyof Vec3, string>>({ x: '0', y: '0', z: '0' })
  const [placedDraft, setPlacedDraft] = React.useState<Record<string, string>>({})
  const [coordErrors, setCoordErrors] = React.useState<Record<string, string>>({})
  const [propError, setPropError] = React.useState<string | null>(null)
  const [catalogError, setCatalogError] = React.useState<string | null>(null)

  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const root = useConfigurator((s) => s.root)
  const placed = React.useMemo(() => placedProps(root), [root])
  const propItems = React.useMemo(() => PROP_CATALOG.filter((prop) =>
    (categoryPath === null || prop.category === categoryPath) &&
    prop.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [categoryPath, search])

  const placeProp = (id: string) => {
    if (Object.keys(coordErrors).some((key) => key.startsWith('new:'))) return
    const prop = PROP_CATALOG.find((entry) => entry.id === id)
    if (!prop) return
    try {
      const before = new Set(placed.map((entry) => entry.id))
      useConfigurator.getState().placeLibraryItem(makePropLibraryItem(prop, propPosition, new Date().toISOString()))
      const inserted = placedProps(useConfigurator.getState().root).find((entry) => !before.has(entry.id))
      if (inserted) {
        useConfigurator.getState().setActive(inserted.id)
        useConfigurator.getState().setSelected(inserted.id)
      }
      setLastAdded(prop.name)
      setPropError(null)
    } catch (cause) { setPropError(cause instanceof Error ? cause.message : String(cause)) }
  }

  const moveProp = (id: string, current: Vec3, axis: keyof Vec3, next: number) => {
    if (!Number.isInteger(next)) { setPropError(tr('Координата должна быть целым мм.')); return }
    try {
      useConfigurator.getState().translateNodes([{ id, delta: { x: axis === 'x' ? next - current.x : 0,
        y: axis === 'y' ? next - current.y : 0, z: axis === 'z' ? next - current.z : 0 } }])
      setPropError(null)
    } catch (cause) { setPropError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const editCoordinate = (key: string, axis: keyof Vec3, raw: string, apply: (value: number) => void) => {
    const result = parsePropCoordinate(raw, axis.toUpperCase())
    if (!result.ok) { setCoordErrors((current) => ({ ...current, [key]: result.error })); return }
    setCoordErrors((current) => { const next = { ...current }; delete next[key]; return next })
    apply(result.value)
  }

  const deleteProp = (id: string) => {
    try {
      const state = useConfigurator.getState()
      const nextRoot = removePropNode(state.root, id)
      useConfigurator.setState({
        root: nextRoot,
        activeId: state.activeId === id ? state.cabinets[0]?.id ?? '' : state.activeId,
        selected: null,
        past: [...state.past, { room: state.room, projectName: state.projectName, root: state.root,
          layers: state.layers, projectSettings: state.projectSettings,
          projectMaterials: state.projectMaterials, projectEdgeBands: state.projectEdgeBands,
          lights: state.lights, autoJoints: state.autoJoints, activeId: state.activeId,
          projectInfo: state.projectInfo, priceOverrides: state.priceOverrides }].slice(-100),
        future: [], lastEditKey: null,
      })
      setPropError(null)
    } catch (cause) { setPropError(cause instanceof Error ? cause.message : String(cause)) }
  }

  // Таб ауысқанда іздеу/санат/бет тазаланады — әйтпесе «Мебель»-де тапқан
  // сөз «Материалы»-да бос тор көрсетер еді, бос екені түсініксіз болар еді.
  const changeTab = (next: LibraryTabId | 'mine') => {
    setTab(next)
    setSearch('')
    setCategoryPath(null)
    setCategorySearch('')
    setPage(0)
    setPendingCabinet(null)
    setPendingBasis(null)
  }

  const cabinetItems = React.useMemo(
    () => filterItems([...PRO100_CABINET_ITEMS, ...BASIS_MODULE_ITEMS], { search, categoryPath }),
    [search, categoryPath],
  )
  const accessoryItems = React.useMemo(
    () => filterItems([...PRO100_ACCESSORY_ITEMS, ...BASIS_FITTING_ITEMS], { search, categoryPath }),
    [search, categoryPath],
  )
  const materialItems = React.useMemo(
    () => filterItems([...BASIS_MATERIALS, ...BASIS_EDGE_BANDS], { search, categoryPath: null }),
    [search],
  )

  const activeItems: (Pro100LibraryItem | BasisModuleItem | BasisFittingItem | Material | EdgeBand)[] =
    tab === 'mebel' ? cabinetItems : tab === 'elementy' ? accessoryItems : tab === 'materialy' ? materialItems : []

  const categoryChoices = React.useMemo(() => {
    const source = tab === 'mebel' ? [...PRO100_CABINET_ITEMS, ...BASIS_MODULE_ITEMS] : tab === 'elementy' ? [...PRO100_ACCESSORY_ITEMS, ...BASIS_FITTING_ITEMS] : []
    return categoryOptions(source)
  }, [tab])
  const visibleCategories = React.useMemo(() => visibleCategoryOptions(categoryChoices, categorySearch, categoryPath),
    [categoryChoices, categorySearch, categoryPath])

  const { pageItems, totalPages, page: clampedPage } = paginate(activeItems, page, PAGE_SIZE)

  const pendingChoice = pendingCabinet ? cabinetImportChoice(pendingCabinet) : null
  const addCabinetToProject = (item: Pro100LibraryItem) => {
    const choice = cabinetImportChoice(item)
    if (!choice.allowed) return
    const template = findTemplate(choice.templateId)
    if (!template) return

    useConfigurator.getState().appendCabinet({
      ...templateToCabinet(template, catalog, choice.size),
      id: `cabinet-${crypto.randomUUID()}`,
      name: `${item.name} (PRO100)`,
    })
    setLastAdded(item.name)
    setPendingCabinet(null)
  }

  const addBasisToProject = (item: BasisModuleItem) => {
    const choice = basisModuleChoice(item.module)
    if (!choice.allowed) return
    const template = findTemplate(choice.templateId)
    if (!template) return
    const cabinet = templateToCabinet(template, catalog, choice.size)
    useConfigurator.getState().appendCabinet({
      ...cabinet, id: `cabinet-${crypto.randomUUID()}`, name: `${item.name} (Базис)`,
      sections: cabinet.sections.map((section) => ({ ...section, fronts: { count: choice.frontCount, mount: 'overlay' } })),
    })
    setLastAdded(item.name)
    setPendingBasis(null)
  }

  const addBasisToShop = (item: Material | EdgeBand) => {
    try {
      const state = useConfigurator.getState()
      state.setShop(addBasisCatalogItem(state.shop, item))
      setLastAdded(item.name)
      setCatalogError(null)
    } catch (cause) { setCatalogError(cause instanceof Error ? cause.message : String(cause)) }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      {/* Толық каталогтың бес қойындысы. */}
      <div className="flex shrink-0 border-b border-neutral-800">
        {[...LIBRARY_TABS, { id: 'mine' as const, label: tr('Моя библиотека') }].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => changeTab(t.id)}
            className={cn(
              'flex-1 border-r border-neutral-800 px-1 py-1.5 text-[10px] uppercase tracking-wider last:border-r-0',
              tab === t.id ? 'bg-neutral-900 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mine' ? <PersonalLibraryPanel /> : <>

      {/* Жол жолағы — эталондағы «Mobilier BUCATARIE\Corpuri...» ашылмалысы. */}
      {tab === 'mebel' || tab === 'elementy' || tab === 'raznoe' ? (
        <div className="shrink-0 border-b border-neutral-800 px-1.5 py-1">
          {(tab === 'mebel' || tab === 'elementy') && (
            <input type="search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)}
              placeholder={tr('Найти категорию')} aria-label={tr('Найти категорию')}
              className="mb-1 w-full border border-neutral-800 bg-neutral-900 px-1.5 py-1 text-[10px] text-neutral-200 outline-none focus:border-neutral-500" />
          )}
          <select
            value={categoryPath ?? ''}
            onChange={(e) => {
              setCategoryPath(e.target.value || null)
              setPage(0)
            }}
            className="w-full border border-neutral-800 bg-neutral-900 px-1.5 py-1 text-[10px] text-neutral-300 outline-none"
          >
            <option value="">{tr('Все категории')} ({tab === 'mebel' ? PRO100_CABINET_ITEMS.length + BASIS_MODULE_ITEMS.length : tab === 'elementy' ? PRO100_ACCESSORY_ITEMS.length + BASIS_FITTING_ITEMS.length : PROP_CATALOG.length})</option>
            {(tab === 'raznoe' ? [...new Set(PROP_CATALOG.map((prop) => prop.category))] : visibleCategories).map((c) => (
              <option key={c} value={c}>{c.split(' \\ ').map((part) => tr(part)).join(' \\ ')}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Іздеу — 5094 жолды сүзу үшін міндетті (тапсырма талабы). */}
      <div className="shrink-0 border-b border-neutral-800 px-1.5 py-1">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Іздеу…"
          className="w-full border border-neutral-800 bg-neutral-900 px-1.5 py-1 text-[11px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
        />
      </div>

      {pendingCabinet && pendingChoice?.allowed ? (
        <div className="shrink-0 space-y-1 border-b border-neutral-700 p-2 text-xs" role="region" aria-label={tr('Подтвердить шаблон')}>
          <p className="font-medium">{pendingCabinet.name}</p>
          <p>{tr('Будет добавлен приблизительный шаблон')}: {tr(pendingChoice.templateName)}</p>
          <p className="tabular-nums">{pendingChoice.dimensions.height} (H) × {pendingChoice.dimensions.width} (W) × {pendingChoice.dimensions.depth} (D) {tr('мм')}</p>
          <p className="text-amber-300">{tr('Высота, глубина и тип корпуса взяты из нашего шаблона, а не из PRO100.')}</p>
          <div className="flex gap-1">
            <button type="button" className="border border-neutral-500 px-2 py-1" onClick={() => addCabinetToProject(pendingCabinet)}>{tr('Добавить шаблон')}</button>
            <button type="button" className="border border-neutral-700 px-2 py-1" onClick={() => setPendingCabinet(null)}>{tr('Отмена')}</button>
          </div>
        </div>
      ) : null}

      {pendingBasis && basisModuleChoice(pendingBasis.module).allowed ? (
        <div className="shrink-0 space-y-1 border-b border-neutral-700 p-2 text-xs" role="region" aria-label={tr('Подтвердить модуль Базис')}>
          <p className="font-medium">{pendingBasis.name}</p>
          <p className="tabular-nums">{pendingBasis.module.height} (H) × {pendingBasis.module.width} (W) × {pendingBasis.module.depth} (D) {tr('мм')}</p>
          <p className="text-amber-300">{tr('Габариты и число фасадов взяты из названия. Полки, материал и конструкция — из шаблона AisMebel; проверьте перед раскроем.')}</p>
          <div className="flex gap-1">
            <button type="button" className="border border-neutral-500 px-2 py-1" onClick={() => addBasisToProject(pendingBasis)}>{tr('Добавить шаблон')}</button>
            <button type="button" className="border border-neutral-700 px-2 py-1" onClick={() => setPendingBasis(null)}>{tr('Отмена')}</button>
          </div>
        </div>
      ) : null}

      {/* Нобай торы — 2 баған. */}
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {tab === 'raznoe' ? (
          <div className="space-y-3 text-xs">
            <p className="text-neutral-400">{tr('Свой декор: не попадает в раскрой и смету.')}</p>
            <div className="flex gap-1">
              {(['x', 'y', 'z'] as const).map((axis) => <label key={axis} className="min-w-0 flex-1">
                {axis.toUpperCase()}, {tr('мм')}
                <input type="text" inputMode="numeric" value={propDraft[axis]} aria-invalid={Boolean(coordErrors[`new:${axis}`])}
                  onChange={(event) => { const raw = event.target.value; setPropDraft((current) => ({ ...current, [axis]: raw }))
                    editCoordinate(`new:${axis}`, axis, raw, (value) => setPropPosition((current) => ({ ...current, [axis]: value }))) }}
                  className={cn('w-full border bg-neutral-900 px-1 py-1', coordErrors[`new:${axis}`] ? 'border-red-600' : 'border-neutral-700')} />
              </label>)}
            </div>
            {(Object.keys(coordErrors).length > 0 || propError) ? <p role="alert" className="text-red-400">{Object.values(coordErrors)[0] ?? propError}</p> : null}
            <div className="grid grid-cols-2 gap-1.5">
              {propItems.map((prop) => <button key={prop.id} type="button" onClick={() => placeProp(prop.id)}
                disabled={Object.keys(coordErrors).some((key) => key.startsWith('new:'))}
                className="border border-neutral-700 p-2 text-left hover:border-neutral-400 disabled:opacity-40">
                <span className="block font-medium">{tr(prop.name)}</span>
                <span className="text-[10px] text-neutral-400">{tr(prop.category)}</span>
              </button>)}
            </div>
            <h3 className="border-t border-neutral-700 pt-2 font-semibold">{tr('Размещённый декор')}</h3>
            {placed.map((node) => <div key={node.id} className="space-y-1 border border-neutral-700 p-2">
              <div className="flex items-center justify-between gap-2"><span>{tr(node.name)}</span>
                <button type="button" onClick={() => deleteProp(node.id)} className="text-red-300">{tr('Удалить')}</button></div>
              <div className="flex gap-1">{(['x', 'y', 'z'] as const).map((axis) =>
                <label key={axis} className="min-w-0 flex-1">{axis.toUpperCase()}
                  <input type="text" inputMode="numeric" value={placedDraft[`${node.id}:${axis}`] ?? String(node.transform.pos[axis])}
                    aria-invalid={Boolean(coordErrors[`${node.id}:${axis}`])}
                    onChange={(event) => { const raw = event.target.value; const key = `${node.id}:${axis}`
                      setPlacedDraft((current) => ({ ...current, [key]: raw }))
                      editCoordinate(key, axis, raw, (value) => moveProp(node.id, node.transform.pos, axis, value)) }}
                    className={cn('w-full border bg-neutral-900 px-1 py-1', coordErrors[`${node.id}:${axis}`] ? 'border-red-600' : 'border-neutral-700')} />
                </label>)}</div>
            </div>)}
          </div>
        ) : pageItems.length === 0 ? (
          <p className="p-2 text-[11px] text-neutral-500">Табылмады.</p>
        ) : tab === 'materialy' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {catalogError && <p role="alert" className="col-span-2 border border-red-700 p-1 text-red-300">{catalogError}</p>}
            {(pageItems as (Material | EdgeBand)[]).map((m) => (
              'sheetWidth' in m ? <MaterialTile key={m.id} material={m}
                selected={shop.materials.some((entry) => entry.id === m.id)} onSelect={() => addBasisToShop(m)} />
                : <EdgeBandTile key={m.id} edge={m}
                  selected={shop.edgeBands.some((entry) => entry.id === m.id)} onSelect={() => addBasisToShop(m)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {(pageItems as (Pro100LibraryItem | BasisModuleItem | BasisFittingItem)[]).map((item) =>
              'module' in item ? <BasisModuleTile key={item.id} item={item} onSelect={() => setPendingBasis(item)} />
                : 'fitting' in item ? <BasisFittingTile key={item.id} item={item} />
                  : <CabinetTile key={item.id} item={item} onSelect={tab === 'mebel' ? () => setPendingCabinet(item) : undefined} />
            )}
          </div>
        )}
      </div>

      {/* Беттеу — гоча №4. */}
      {tab !== 'raznoe' && totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="border border-neutral-800 px-1.5 py-0.5 disabled:opacity-30"
          >
            ← Алдыңғы
          </button>
          <span className="tabular-nums">{clampedPage + 1} / {totalPages} ({activeItems.length})</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="border border-neutral-800 px-1.5 py-0.5 disabled:opacity-30"
          >
            Келесі →
          </button>
        </div>
      ) : null}

      {lastAdded ? (
        <div className="shrink-0 border-t border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-400">
          Қосылды: <span className="text-neutral-200">{lastAdded}</span>
        </div>
      ) : null}
      </>}
    </div>
  )
}

// ── Бір нобай ұяшығы (шкаф/элемент) ─────────────────────────────────────────

function CabinetTile({ item, onSelect }: { item: Pro100LibraryItem; onSelect?: (() => void) | undefined }) {
  const choice = cabinetImportChoice(item)
  const reason = !choice.allowed ? choice.reason === 'unsupportedShape' ? tr('Геометрия этого корпуса не поддерживается')
    : choice.reason === 'unknownWidth' ? tr('Ширина (W) не определена из названия')
      : choice.reason === 'widthRange' ? `${tr('Ширина (W) вне диапазона')}: ${choice.range?.min}–${choice.range?.max} ${tr('мм')}`
        : tr('Тип корпуса не определён из названия') : null
  const dims: string[] = []
  if (item.parsed.widthMm !== undefined) dims.push(`W${item.parsed.widthMm}`)
  if (item.parsed.doorCount !== undefined) dims.push(`${item.parsed.doorCount}дв`)
  if (item.parsed.drawerCount !== undefined) dims.push(`${item.parsed.drawerCount}ящ`)
  if (item.parsed.hasSink) dims.push('мойка')

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect || !choice.allowed}
      className={cn(
        'flex flex-col items-center gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left',
        onSelect && choice.allowed ? 'hover:border-neutral-500' : 'cursor-default opacity-70',
      )}
      title={reason ?? (item.path.length > 1 ? categoryLabel(item.path) : undefined)}
    >
      <div className="h-16 w-full">
        <CatalogThumb parsed={item.parsed} />
      </div>
      <div className="w-full truncate text-[10px] text-neutral-300">{item.name}</div>
      {dims.length > 0 ? (
        <div className="w-full truncate text-[9px] tabular-nums text-neutral-500">{dims.join(' · ')}</div>
      ) : null}
      {onSelect && reason ? <span className="w-full text-[9px] text-amber-300">{reason}</span> : null}
    </button>
  )
}

// ── Бір материал ұяшығы («Материалы» табы) ──────────────────────────────────

function MaterialTile({ material, selected, onSelect }: { material: Material; selected: boolean; onSelect: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left">
      {/* Түс/декор дерегі БАЗИСТЕ импортталмаған (basisCatalog.ts §комментарий) —
          сондықтан ойдан түс салмай, бейтарап тор + қалыңдық белгісі. */}
      <div className="flex h-16 w-full items-center justify-center border border-neutral-800 bg-neutral-950">
        <span className="text-[10px] text-neutral-500">{material.thickness} мм</span>
      </div>
      <div className="w-full truncate text-[10px] text-neutral-300">{material.name}</div>
      <div className="w-full text-[9px] text-neutral-500">{tr('Цена задаётся в прайсе цеха')}</div>
      <button type="button" disabled={selected} onClick={onSelect}
        className="w-full border border-neutral-700 px-1 py-0.5 text-[10px] disabled:opacity-50">
        {tr(selected ? 'Уже в цехе' : 'Добавить в цех')}
      </button>
    </div>
  )
}

function EdgeBandTile({ edge, selected, onSelect }: { edge: EdgeBand; selected: boolean; onSelect: () => void }) {
  return <div className="flex flex-col gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left text-[10px]">
    <div className="flex h-16 items-center justify-center border border-neutral-800 bg-neutral-950 text-neutral-500">
      {edge.thickness} × {edge.widthMm ?? '—'} {tr('мм')}
    </div>
    <div className="truncate text-neutral-300" title={edge.name}>{edge.name}</div>
    <div className="text-neutral-500">{tr('Ширина кромки')}: {edge.widthMm ?? tr('неизвестно')} {tr('мм')}</div>
    <button type="button" disabled={selected} onClick={onSelect}
      className="border border-neutral-700 px-1 py-0.5 disabled:opacity-50">
      {tr(selected ? 'Уже в цехе' : 'Добавить в цех')}
    </button>
  </div>
}

function BasisModuleTile({ item, onSelect }: { item: BasisModuleItem; onSelect: () => void }) {
  const choice = basisModuleChoice(item.module)
  const reason = choice.allowed ? null : choice.reason === 'gola' ? tr('Gola-профиль не поддерживается генератором')
    : choice.reason === 'unmatched' ? tr('Тип или размер модуля не определён')
      : choice.reason === 'range' ? `${tr('Размер вне диапазона шаблона')}: ${choice.range}`
        : tr('Конструкция или фурнитура модуля не поддерживается')
  return <button type="button" disabled={!choice.allowed} onClick={onSelect} title={reason ?? undefined}
    className={cn('flex flex-col gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left text-[10px]', choice.allowed ? 'hover:border-neutral-500' : 'cursor-default opacity-70')}>
    <div className="truncate text-neutral-200" title={item.name}>{item.name}</div>
    {item.module.height !== null && item.module.width !== null && item.module.depth !== null ?
      <div className="tabular-nums text-neutral-400">{item.module.height} (H) × {item.module.width} (W) × {item.module.depth} (D) {tr('мм')}</div> : null}
    {reason ? <div className="text-amber-300">{reason}</div> : <div className="text-neutral-400">{tr('Добавить шаблон')}</div>}
  </button>
}

function BasisFittingTile({ item }: { item: BasisFittingItem }) {
  const { fitting } = item
  return <div className="flex flex-col gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left text-[10px]">
    <div className="truncate text-neutral-200" title={item.name}>{item.name}</div>
    <div className="text-neutral-400">{tr('Тип')}: {tr(BASIS_FITTING_KIND_LABELS[fitting.kind])}</div>
    {fitting.manufacturer ? <div>{tr('Производитель')}: {fitting.manufacturer}</div> : null}
    {fitting.article ? <div>{tr('Артикул')}: {fitting.article}</div> : null}
    {fitting.dimensionsMm.length > 0 ? <div>{tr('Размеры')}: {fitting.dimensionsMm.join(', ')} {tr('мм')}</div> : null}
    <div className="text-neutral-500">{tr('Цена и присадка неизвестны; в проект не добавляется.')}</div>
  </div>
}
