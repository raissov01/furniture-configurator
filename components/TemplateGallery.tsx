'use client'

/**
 * Дайын шаблондар галереясы (A6). «Таңдадың → размерін өзгерттің → болды»
 * ағынының бірінші қадамы.
 */

import { t as tr } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { SEED_SETS, SEED_TEMPLATES, TEMPLATE_CATEGORIES, setToProject, templateToCabinet } from '@/src/core/index'
import type { TemplateCategory } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { CabinetThumb } from '@/components/CabinetThumb'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { KitchenWizard } from '@/components/KitchenWizard'

type Filter = TemplateCategory | 'all' | 'sets'

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
  const activeId = useConfigurator((s) => s.templateId)
  const [filter, setFilter] = useState<Filter>('all')
  // Ас үй генераторы формасының күйі.
  const [kit, setKit] = useState({ lengthA: 3000, lengthB: 2400, corner: true, sink: true, upper: true, appliances: true })
  const [wizardOpen, setWizardOpen] = useState(false)
  const catalog = useConfigurator((s) => s.catalog)

  const counts = useMemo(() => {
    const map = new Map<TemplateCategory, number>()
    for (const t of SEED_TEMPLATES) map.set(t.category, (map.get(t.category) ?? 0) + 1)
    return map
  }, [])

  const shown = useMemo(
    () => (filter === 'all' || filter === 'sets'
      ? SEED_TEMPLATES
      : SEED_TEMPLATES.filter((t) => t.category === filter)),
    [filter],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">
            {firstRun ? tr('С чего начнём?') : tr('Готовые шаблоны')}
          </h2>
          <Button active={filter === 'all'} onClick={() => setFilter('all')}>{tr('Все')}</Button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <Button key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </Button>
          ))}
          <Button active={filter === 'sets'} onClick={() => setFilter('sets')}>{tr('Наборы')}</Button>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <KitchenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

        {firstRun ? (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFilter(c.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition hover:border-neutral-500',
                  filter === c.value
                    ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800'
                    : 'border-neutral-200 dark:border-neutral-700',
                )}
              >
                <div className="text-xs font-medium">{c.label}</div>
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
            <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-800/50">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold">{tr('Генератор кухни')}</span>
                <span className="text-[11px] text-neutral-500">{tr('по длине стены')}</span>
                <div className="ml-auto">
                  <Button active onClick={() => setWizardOpen(true)}>{tr('Мастер кухни (5 шагов)')}</Button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[11px] text-neutral-500">
                  {tr('Стена A, мм')}
                  <input
                    type="number" min={600} step={100}
                    value={kit.lengthA}
                    onChange={(e) => setKit((k) => ({ ...k, lengthA: Number(e.target.value) }))}
                    className="mt-0.5 block w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-neutral-900 dark:border-neutral-600 dark:bg-neutral-900"
                  />
                </label>
                <label className={cn('text-[11px] text-neutral-500', !kit.corner && 'opacity-40')}>
                  {tr('Стена B (угол), мм')}
                  <input
                    type="number" min={600} step={100}
                    value={kit.lengthB}
                    disabled={!kit.corner}
                    onChange={(e) => setKit((k) => ({ ...k, lengthB: Number(e.target.value) }))}
                    className="mt-0.5 block w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-neutral-900 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900"
                  />
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
                <Button
                  active
                  onClick={() => {
                    setFirstRun(false)
                    runBusy(tr('Собираем кухню…'), () => loadKitchen({
                      layout: kit.corner ? 'corner' : 'straight',
                      lengthA: kit.lengthA,
                      lengthB: kit.corner ? kit.lengthB : undefined,
                      sink: kit.sink,
                      upper: kit.upper,
                      appliances: kit.appliances,
                    }))
                  }}
                >
                  {tr('Сгенерировать')}
                </Button>
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
                  className="flex flex-col items-start gap-2 rounded-lg border border-neutral-200 p-3 text-left transition hover:border-neutral-500 hover:shadow-sm dark:border-neutral-700"
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setFirstRun(false); loadTemplate(t.id) }}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition',
                'hover:border-neutral-500 hover:shadow-sm',
                t.id === activeId
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
              <div className="text-xs font-medium">{t.name}</div>
              <div className="tabular-nums text-[11px] text-neutral-500">
                {t.height} × {t.width} × {t.depth}
              </div>
              <div className="text-[11px] leading-snug text-neutral-400">{t.description}</div>
            </button>
          ))}
        </div>
        )}

        <p className="mt-3 text-[11px] text-neutral-400">
          {filter === 'sets'
            ? 'Набор заменяет весь проект и расставляет корпуса по стенам. Ctrl+Z возвращает предыдущий.'
            : 'Шаблон полностью заменяет текущий корпус. Ctrl+Z возвращает предыдущий.'}
        </p>
      </div>
    </div>
  )
}
