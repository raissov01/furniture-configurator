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
import { BASIS_MATERIALS } from '@/src/core/data/basisCatalog'
import type { Material } from '@/src/core/types'
import {
  PRO100_ACCESSORY_ITEMS,
  PRO100_CABINET_ITEMS,
} from '@/src/core/data/pro100Catalog'
import type { Pro100LibraryItem } from '@/src/core/data/pro100Catalog'
import {
  categoryLabel,
  categoryOptions,
  filterItems,
  LIBRARY_TABS,
  paginate,
  pickTemplateForCabinetItem,
} from './libraryCatalogLogic'
import type { LibraryTabId } from './libraryCatalogLogic'
import { CatalogThumb } from './CatalogThumb'
import { PersonalLibraryPanel } from './PersonalLibraryPanel'

const PAGE_SIZE = 60 // гоча №4: 5094 жолды бірден рендерлемеу — беттеу

export function LibraryPanel() {
  const [tab, setTab] = React.useState<LibraryTabId | 'mine'>('mebel')
  const [search, setSearch] = React.useState('')
  const [categoryPath, setCategoryPath] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(0)
  const [lastAdded, setLastAdded] = React.useState<string | null>(null)

  const catalog = useConfigurator((s) => s.catalog)

  // Таб ауысқанда іздеу/санат/бет тазаланады — әйтпесе «Мебель»-де тапқан
  // сөз «Материалы»-да бос тор көрсетер еді, бос екені түсініксіз болар еді.
  const changeTab = (next: LibraryTabId | 'mine') => {
    setTab(next)
    setSearch('')
    setCategoryPath(null)
    setPage(0)
  }

  const cabinetItems = React.useMemo(
    () => filterItems(PRO100_CABINET_ITEMS, { search, categoryPath }),
    [search, categoryPath],
  )
  const accessoryItems = React.useMemo(
    () => filterItems(PRO100_ACCESSORY_ITEMS, { search, categoryPath }),
    [search, categoryPath],
  )
  const materialItems = React.useMemo(
    () => filterItems(BASIS_MATERIALS, { search, categoryPath: null }),
    [search],
  )

  const activeItems: (Pro100LibraryItem | Material)[] =
    tab === 'mebel' ? cabinetItems : tab === 'elementy' ? accessoryItems : tab === 'materialy' ? materialItems : []

  const categoryChoices = React.useMemo(() => {
    const source = tab === 'mebel' ? PRO100_CABINET_ITEMS : tab === 'elementy' ? PRO100_ACCESSORY_ITEMS : []
    return categoryOptions(source)
  }, [tab])

  const { pageItems, totalPages, page: clampedPage } = paginate(activeItems, page, PAGE_SIZE)

  const addCabinetToProject = (item: Pro100LibraryItem) => {
    const { templateId, size } = pickTemplateForCabinetItem(item.parsed)
    const template = findTemplate(templateId)
    if (!template) return // қорғаныс: SEED_TEMPLATES-тен алынбаса, ешнәрсе істемейміз (silent no-op емес — тексерілген, tests/libraryCatalogLogic.test.ts осы жағдайды жабады)

    useConfigurator.getState().appendCabinet({
      ...templateToCabinet(template, catalog, size),
      id: `cabinet-${crypto.randomUUID()}`,
      name: `${item.name} (PRO100)`,
    })
    setLastAdded(item.name)
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      {/* 4 таб — PRO100 эталонымен бірдей ретте. */}
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
      {tab === 'mebel' || tab === 'elementy' ? (
        <div className="shrink-0 border-b border-neutral-800 px-1.5 py-1">
          <select
            value={categoryPath ?? ''}
            onChange={(e) => {
              setCategoryPath(e.target.value || null)
              setPage(0)
            }}
            className="w-full border border-neutral-800 bg-neutral-900 px-1.5 py-1 text-[10px] text-neutral-300 outline-none"
          >
            <option value="">Барлық санат ({tab === 'mebel' ? PRO100_CABINET_ITEMS.length : PRO100_ACCESSORY_ITEMS.length})</option>
            {categoryChoices.map((c) => (
              <option key={c} value={c}>{c}</option>
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

      {/* Нобай торы — 2 баған. */}
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {tab === 'raznoe' ? (
          <p className="p-2 text-[11px] leading-snug text-neutral-500">
            Бұл архивте «Разное» санатына сәйкес бума табылмады — PRO100
            кітапханасында тек «Мебель» (шкафтар+элементтер) мен «Материалы»
            бумалары бар (тексерілді: `unrar lb`, докта санат жоқ).
          </p>
        ) : pageItems.length === 0 ? (
          <p className="p-2 text-[11px] text-neutral-500">Табылмады.</p>
        ) : tab === 'materialy' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {(pageItems as Material[]).map((m) => (
              <MaterialTile key={m.id} material={m} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {(pageItems as Pro100LibraryItem[]).map((item) => (
              <CabinetTile
                key={item.id}
                item={item}
                onSelect={tab === 'mebel' ? () => addCabinetToProject(item) : undefined}
              />
            ))}
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
  const dims: string[] = []
  if (item.parsed.widthMm !== undefined) dims.push(`W${item.parsed.widthMm}`)
  if (item.parsed.doorCount !== undefined) dims.push(`${item.parsed.doorCount}дв`)
  if (item.parsed.drawerCount !== undefined) dims.push(`${item.parsed.drawerCount}ящ`)
  if (item.parsed.hasSink) dims.push('мойка')

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        'flex flex-col items-center gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left',
        onSelect ? 'hover:border-neutral-500' : 'cursor-default opacity-70',
      )}
      title={item.path.length > 1 ? categoryLabel(item.path) : undefined}
    >
      <div className="h-16 w-full">
        <CatalogThumb parsed={item.parsed} />
      </div>
      <div className="w-full truncate text-[10px] text-neutral-300">{item.name}</div>
      {dims.length > 0 ? (
        <div className="w-full truncate text-[9px] tabular-nums text-neutral-500">{dims.join(' · ')}</div>
      ) : null}
    </button>
  )
}

// ── Бір материал ұяшығы («Материалы» табы) ──────────────────────────────────

function MaterialTile({ material }: { material: Material }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-neutral-800 bg-neutral-900 p-1.5 text-left">
      {/* Түс/декор дерегі БАЗИСТЕ импортталмаған (basisCatalog.ts §комментарий) —
          сондықтан ойдан түс салмай, бейтарап тор + қалыңдық белгісі. */}
      <div className="flex h-16 w-full items-center justify-center border border-neutral-800 bg-neutral-950">
        <span className="text-[10px] text-neutral-500">{material.thickness} мм</span>
      </div>
      <div className="w-full truncate text-[10px] text-neutral-300">{material.name}</div>
      <div className="w-full truncate text-[9px] tabular-nums text-neutral-500">
        {material.pricePerSheet > 0 ? `${(material.pricePerSheet / 100).toLocaleString('ru-RU')} ₸/лист` : 'баға белгісіз'}
      </div>
    </div>
  )
}
