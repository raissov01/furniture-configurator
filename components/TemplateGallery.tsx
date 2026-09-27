'use client'

/**
 * Дайын шаблондар галереясы (A6). «Таңдадың → размерін өзгерттің → болды»
 * ағынының бірінші қадамы.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SEED_SETS, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, TEMPLATE_CATEGORIES, setToProject, templateToCabinet } from '@/src/core/index'
import { filterTemplateCatalog } from '@/src/core/templateCatalog'
import type { Material, TemplateCategory } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { CabinetThumb } from '@/components/CabinetThumb'
import { Button, Field } from '@/components/ui'
import { DecorPicker } from '@/components/DecorPicker'
import { cn } from '@/lib/cn'
import { KitchenWizard } from '@/components/KitchenWizard'
import { matchTemplateId } from '@/lib/templateMatch'
import { parseKitchenWalls } from '@/lib/kitchenWallInput'
import { shouldCloseGalleryOnKey } from '@/lib/galleryKeyboard'

type Filter = TemplateCategory | 'all' | 'sets' | 'standard'

/** Корпус материалы — цоколь/арт қабырғадан ажырату үшін бірдей шарт
 * `Configurator.tsx`-тегі `isCarcass`-пен бірдей: 10 мм-ден жуан плита. */
const isCarcass = (m: Material) => m.thickness >= 10

/** Ең биік шаблон карточкада осынша пиксель болады. */
const THUMB_MAX_PX = 104
const TALLEST_MM = Math.max(...SEED_TEMPLATES.map((t) => t.height))

/**
 * Масштаб ТУРА пропорционал емес, түбір арқылы қысылған. Таза пропорцияда
 * 400 мм антресоль 2200 мм шкафтың жанында 19 пиксель болып, суреті мүлде
 * оқылмай қалады; ал бірдей биіктікте берсек өлшем сезімі жоғалады.
 * Түбір екеуінің ортасын береді: биігірегі әрқашан биік көрінеді, кішісі
 * әлі де оқылады. Нақты сандар карточкада мәтінмен қатар тұр.
 */
const thumbScale = (heightMm: number) =>
  (THUMB_MAX_PX * Math.sqrt(heightMm / TALLEST_MM)) / heightMm

export function TemplateGallery() {
  const open = useConfigurator((s) => s.galleryOpen)
  const setOpenRaw = useConfigurator((s) => s.setGalleryOpen)
  const firstRun = useConfigurator((s) => s.firstRun)
  const setFirstRun = useConfigurator((s) => s.setFirstRun)
  // Галерея бір рет жабылса, бастау режимі де бітеді: пайдаланушы таңдауын
  // жасады (не «кейін» деді), енді оны әр ашқанда қайталамаймыз.
  const setOpen = (v: boolean) => {
    if (!v) setFirstRun(false)
    setOpenRaw(v)
  }
  const loadTemplate = useConfigurator((s) => s.loadTemplate)
  const loadSet = useConfigurator((s) => s.loadSet)
  const loadKitchen = useConfigurator((s) => s.loadKitchen)
  const runBusy = useConfigurator((s) => s.runBusy)
  const activeCabinetId = useConfigurator((s) => s.activeId)
  const cabinets = useConfigurator((s) => s.cabinets)
  const [filter, setFilter] = useState<Filter>('all')
  const [subcategory, setSubcategory] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const catalog = useConfigurator((s) => s.catalog)
  const activeTemplateId = useMemo(() => matchTemplateId(cabinets, activeCabinetId, catalog), [cabinets, activeCabinetId, catalog])
  // Жылдам генератордың материал таңдағыштары үшін: корпус/фасад бірдей
  // пулдан (қалыңдығы ≥10 мм), столешница — тек slab деп белгіленгендерден
  // (G5, `KitchenOptions.materials`-пен бірдей ядро — жаңа геометрия жоқ).
  const carcassMaterials = useMemo(() => catalog.materials.filter(isCarcass), [catalog])
  const worktopMaterials = useMemo(() => catalog.materials.filter((m) => m.slab), [catalog])
  // Ас үй генераторы формасының күйі.
  const [kit, setKit] = useState(() => ({
    lengthA: '3000', lengthB: '2400', corner: true, sink: true, upper: true, appliances: true,
    // G1: фартук әдепкіде ҚОСУЛЫ, шебердегі жаңа әдепкімен (600 мм) бірдей.
    backsplash: true,
    carcassId: carcassMaterials[0]?.id ?? '',
    frontId: carcassMaterials[0]?.id ?? '',
    worktopId: worktopMaterials[0]?.id ?? '',
  }))
  const [wizardOpen, setWizardOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const walls = parseKitchenWalls(kit.lengthA, kit.lengthB, kit.corner)

  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => { trigger?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (!shouldCloseGalleryOnKey(event.key, wizardOpen)) return
      event.preventDefault()
      setFirstRun(false)
      setOpenRaw(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open, wizardOpen, setFirstRun, setOpenRaw])

  const counts = useMemo(() => {
    const map = new Map<TemplateCategory, number>()
    for (const t of SEED_TEMPLATES) map.set(t.category, (map.get(t.category) ?? 0) + 1)
    return map
  }, [])

  const subcategories = useMemo(() => {
    if (filter === 'all' || filter === 'sets' || filter === 'standard') return []
    return [...new Set(SEED_TEMPLATES.filter((item) => item.category === filter).map((item) => item.subcategory).filter((value): value is string => Boolean(value)))]
  }, [filter])
  const shown = useMemo(() => filterTemplateCatalog(
    filter === 'standard' ? STANDARD_NOMENCLATURE_TEMPLATES : SEED_TEMPLATES, {
    category: filter === 'all' || filter === 'sets' || filter === 'standard' ? undefined : filter,
    subcategory,
    search,
  }, tr), [filter, subcategory, search])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-2 sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        data-testid="template-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={firstRun ? tr('С чего начнём?') : tr('Готовые шаблоны')}
        className="p100-gallery min-w-0 w-full max-w-5xl overflow-x-hidden border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">
            {firstRun ? tr('С чего начнём?') : tr('Готовые шаблоны')}
          </h2>
          <Button active={filter === 'all'} onClick={() => { setFilter('all'); setSubcategory(undefined) }}>{tr('Все')}</Button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <Button key={c.value} active={filter === c.value} onClick={() => { setFilter(c.value); setSubcategory(undefined) }}>
              {tr(c.label)}
            </Button>
          ))}
          <Button active={filter === 'standard'} onClick={() => { setFilter('standard'); setSubcategory(undefined); setSearch('') }}>
            {tr('Стандарт номенклатура')}
          </Button>
          <Button active={filter === 'sets'} onClick={() => { setFilter('sets'); setSubcategory(undefined) }}>{tr('Наборы')}</Button>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {filter !== 'sets' ? (
          <div className="mb-3 space-y-2">
            <label className="block text-xs text-neutral-600 dark:text-neutral-300">
              {tr('Поиск модуля')}
              <input
                aria-label={tr('Поиск модуля')}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tr('Название или тип')}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-700 dark:border-neutral-600 dark:bg-neutral-900"
              />
            </label>
            {subcategories.length > 1 ? (
              <div aria-label={tr('Подкатегории')} className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [&>button]:shrink-0">
                <Button active={!subcategory} onClick={() => setSubcategory(undefined)}>{tr('Все')}</Button>
                {subcategories.map((value) => (
                  <Button key={value} active={subcategory === value} onClick={() => setSubcategory(value)}>{tr(value)}</Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {wizardOpen ? <KitchenWizard open onClose={() => setWizardOpen(false)} /> : null}

        {firstRun ? (
          <div data-testid="first-run-categories" className="mb-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { setFilter(c.value); setSubcategory(undefined) }}
                className={cn(
                  'min-w-0 border px-3 py-2 text-left transition hover:border-neutral-500',
                  filter === c.value
                    ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800'
                    : 'border-neutral-200 dark:border-neutral-700',
                )}
              >
                <div className="text-xs font-medium">{tr(c.label)}</div>
                <div className="tabular-nums text-[11px] text-neutral-500">
                  {counts.get(c.value) ?? 0} {tr('шаблонов')}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {filter === 'sets' ? (
          <div className="space-y-4">
            {/*
              АС ҮЙ ГЕНЕРАТОРЫ: қабырға ұзындығынан толық гарнитур (авто
              модуль бөлу + столешница + үстіңгі қатар). Бекітілген «Наборы»-дан
              айырмасы — ұзындық ерікті, модульдерді өзі бөледі.
            */}
            <div className="border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-800">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold">{tr('Генератор кухни')}</span>
                <span className="text-[11px] text-neutral-500">{tr('по длине стены')}</span>
                <div className="ml-auto">
                  <Button active onClick={() => setWizardOpen(true)}>{tr('Мастер кухни (5 шагов)')}</Button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 max-[420px]:flex-col max-[420px]:items-stretch">
                <label className="text-[11px] text-neutral-500">
                  {tr('Стена A, мм')}
                  <input
                    type="text" inputMode="numeric" aria-invalid={Boolean(walls.errorA)}
                    aria-describedby={walls.errorA ? 'wall-a-error' : undefined}
                    value={kit.lengthA}
                    onChange={(e) => setKit((k) => ({ ...k, lengthA: e.target.value }))}
                    className={cn('mt-0.5 block w-24 max-[420px]:w-full rounded-md border bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-neutral-900 dark:bg-neutral-900', walls.errorA ? 'border-red-600 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-600')}
                  />
                  {walls.errorA ? <span id="wall-a-error" role="alert" className="mt-1 block text-red-600 dark:text-red-400">{tr(walls.errorA)}</span> : null}
                </label>
                <label className={cn('text-[11px] text-neutral-500', !kit.corner && 'opacity-40')}>
                  {tr('Стена B (угол), мм')}
                  <input
                    type="text" inputMode="numeric" aria-invalid={Boolean(walls.errorB)}
                    aria-describedby={walls.errorB ? 'wall-b-error' : undefined}
                    value={kit.lengthB}
                    disabled={!kit.corner}
                    onChange={(e) => setKit((k) => ({ ...k, lengthB: e.target.value }))}
                    className={cn('mt-0.5 block w-24 max-[420px]:w-full rounded-md border bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-neutral-900 disabled:opacity-50 dark:bg-neutral-900', walls.errorB ? 'border-red-600 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-600')}
                  />
                  {walls.errorB ? <span id="wall-b-error" role="alert" className="mt-1 block text-red-600 dark:text-red-400">{tr(walls.errorB)}</span> : null}
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={kit.corner} onChange={(e) => setKit((k) => ({ ...k, corner: e.target.checked }))} />
                  {tr('Угол (Г)')}
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={kit.sink} onChange={(e) => setKit((k) => ({ ...k, sink: e.target.checked }))} />
                  {tr('Мойка')}
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={kit.upper} onChange={(e) => setKit((k) => ({ ...k, upper: e.target.checked }))} />
                  {tr('Верхний ряд')}
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={kit.appliances} onChange={(e) => setKit((k) => ({ ...k, appliances: e.target.checked }))} />
                  {tr('Техника')}
                </label>
                {/* G1: фартук — жылдам генераторда бұрын мүлде болмаған жалауша. */}
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={kit.backsplash} onChange={(e) => setKit((k) => ({ ...k, backsplash: e.target.checked }))} />
                  {tr('Фартук')}
                </label>
                <Button
                  active
                  disabled={!walls.valid}
                  onClick={() => {
                    const lengthA = walls.lengthA
                    if (!walls.valid || lengthA === undefined) return
                    setFirstRun(false)
                    runBusy(tr('Собираем кухню…'), () => loadKitchen({
                      layout: kit.corner ? 'corner' : 'straight',
                      lengthA,
                      lengthB: kit.corner ? walls.lengthB : undefined,
                      sink: kit.sink,
                      upper: kit.upper,
                      appliances: kit.appliances,
                      dims: { backsplashHeight: kit.backsplash ? 600 : 0 },
                      materials: {
                        carcassId: kit.carcassId || undefined,
                        frontId: kit.frontId || undefined,
                        worktopId: kit.worktopId || undefined,
                      },
                    }))
                  }}
                >
                  {tr('Сгенерировать')}
                </Button>
              </div>

              {/*
                G5: материал таңдағыштары — qdesign шебері корпус/фасад/
                столешницаны БӨЛЕК сұрайды, ал жылдам генератор бұрын бәрін
                бір сұр түспен шығаратын. `KitchenOptions.materials` ядрода
                бұрыннан бар (kitchen.ts), тек осы UI жетіспеп еді.
              */}
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-3 dark:border-neutral-700">
                <Field label={tr('Корпус')}>
                  <DecorPicker
                    materials={carcassMaterials}
                    value={kit.carcassId}
                    onChange={(carcassId) => setKit((k) => ({ ...k, carcassId }))}
                  />
                </Field>
                <Field label={tr('Фасады')}>
                  <DecorPicker
                    materials={carcassMaterials}
                    value={kit.frontId}
                    onChange={(frontId) => setKit((k) => ({ ...k, frontId }))}
                  />
                </Field>
                <Field label={tr('Столешница')}>
                  <DecorPicker
                    materials={worktopMaterials}
                    value={kit.worktopId}
                    onChange={(worktopId) => setKit((k) => ({ ...k, worktopId }))}
                  />
                </Field>
              </div>

              <p className="mt-2 text-[11px] leading-snug text-neutral-400">
                {tr('Стена делится на стандартные модули автоматически. Столешница, цоколь и мойка добавляются сами. Ctrl+Z возвращает.')}
              </p>
            </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SEED_SETS.map((preset) => {
              const { cabinets } = setToProject(preset, catalog)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => { setFirstRun(false); runBusy(tr('Загрузка…'), () => loadSet(preset.id)) }}
                  className="flex flex-col items-start gap-2 border border-neutral-200 p-3 text-left transition hover:border-neutral-500 dark:border-neutral-700"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    {cabinets.map((cabinet) => (
                      <CabinetThumb
                        key={cabinet.id}
                        cabinet={cabinet}
                        catalog={catalog}
                        pxPerMm={thumbScale(cabinet.height) * 0.8}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-medium">{preset.name}</div>
                  <div className="tabular-nums text-[11px] text-neutral-500">
                    корпусов: {cabinets.length} · комната от {preset.room.width}×{preset.room.depth}
                  </div>
                  <div className="text-[11px] leading-snug text-neutral-400">{preset.description}</div>
                </button>
              )
            })}
          </div>
          </div>
        ) : (
        <div data-testid="template-results" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <button
              key={t.id}
              data-template-id={t.id}
              type="button"
              onClick={() => { setFirstRun(false); loadTemplate(t.id) }}
              className={cn(
                'flex flex-col items-start gap-2 border p-3 text-left transition',
                'hover:border-neutral-500',
                t.id === activeTemplateId
                  ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-700',
              )}
            >
              <div
                className="flex w-full items-end justify-center overflow-hidden"
                style={{ height: THUMB_MAX_PX }}
              >
                <CabinetThumb cabinet={templateToCabinet(t, catalog)} catalog={catalog} pxPerMm={thumbScale(t.height)} />
              </div>
              <div className="text-xs font-medium">{tr(t.name)}</div>
              <div className="tabular-nums text-[11px] text-neutral-500">
                {t.height} (H) × {t.width} (W) × {t.depth} (D)
              </div>
              {t.recommendedWidths ? (
                <div className="text-[11px] text-neutral-500">
                  {tr('Ширины (W), мм')}: {t.recommendedWidths.join(', ')}
                </div>
              ) : null}
              <div className="p100-muted text-[11px] leading-snug text-neutral-400">{tr(t.description)}</div>
            </button>
          ))}
        </div>
        )}

        {filter !== 'sets' && shown.length === 0 ? <p className="py-5 text-center text-sm text-neutral-500">{tr('Модули не найдены')}</p> : null}

        <p className="p100-muted mt-3 text-[11px] text-neutral-400">
          {filter === 'sets'
            ? tr('Набор заменяет весь проект и расставляет корпуса по стенам. Ctrl+Z возвращает предыдущий.')
            : tr('Шаблон полностью заменяет текущий корпус. Ctrl+Z возвращает предыдущий.')}
        </p>
      </div>
    </div>
  )
}
