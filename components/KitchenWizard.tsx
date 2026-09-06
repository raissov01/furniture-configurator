'use client'

/**
 * Ас үй ШЕБЕРІ — qdesign «Этапты конструктор»-дың біздегі баламасы.
 *
 * Бес қадам: (1) орналасу, (2) өлшемдер, (3) мазмұн, (4) конструкция,
 * (5) материалдар + фрезеровка. Соңында `loadKitchen` бүкіл гарнитурды
 * бір ағыммен құрайды.
 *
 * ⚠ ГЕНЕРАЦИЯ ЛОГИКАСЫ МҰНДА ЕМЕС. Бәрі ядрода (`src/core/kitchen.ts`) —
 * шебер тек опцияларды жинайды. Сондықтан деталировка да, раскрой да,
 * ЧПУ да қолмен жинағанмен бірдей есептеледі.
 */

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button, Field, NumberInput, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MILLING_PATTERNS } from '@/src/core/index'
import type { KitchenOptions, MillingPatternId, FurnitureType } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

type Draft = {
  type: FurnitureType
  layout: 'straight' | 'corner'
  lengthA: number
  lengthB: number
  sink: boolean
  upper: boolean
  appliances: boolean
  lowerHeight: number
  lowerDepth: number
  plinthHeight: number
  upperDepth: number
  upperHeight: number
  upperElevation: number
  worktopOverhang: number
  backsplashHeight: number
  carcassId: string
  frontId: string
  worktopId: string
  milling: MillingPatternId
}

const DEFAULT: Draft = {
  type: 'kitchen', layout: 'corner', lengthA: 3200, lengthB: 2400,
  sink: true, upper: true, appliances: true,
  lowerHeight: 720, lowerDepth: 500, plinthHeight: 95,
  upperDepth: 320, upperHeight: 720, upperElevation: 1460,
  worktopOverhang: 30, backsplashHeight: 0,
  carcassId: '', frontId: '', worktopId: '',
  milling: 'plain',
}

const STEPS = ['Расположение', 'Размеры', 'Наполнение', 'Конструкция', 'Материалы'] as const

export function KitchenWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useConfigurator((s) => s.catalog)
  const loadKitchen = useConfigurator((s) => s.loadKitchen)
  const loadFurniture = useConfigurator((s) => s.loadFurniture)
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>(DEFAULT)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  if (!open) return null

  const materialOptions = [
    { value: '', label: tr('Как в шаблоне') },
    ...catalog.materials.map((m) => ({ value: m.id, label: m.name })),
  ]

  const generate = () => {
    const options: KitchenOptions = {
      layout: d.layout,
      lengthA: d.lengthA,
      lengthB: d.layout === 'corner' ? d.lengthB : undefined,
      sink: d.sink,
      upper: d.upper,
      appliances: d.appliances,
      dims: {
        lowerHeight: d.lowerHeight, lowerDepth: d.lowerDepth, plinthHeight: d.plinthHeight,
        upperDepth: d.upperDepth, upperHeight: d.upperHeight, upperElevation: d.upperElevation,
        worktopOverhang: d.worktopOverhang, backsplashHeight: d.backsplashHeight,
      },
      materials: {
        carcassId: d.carcassId || undefined,
        frontId: d.frontId || undefined,
        worktopId: d.worktopId || undefined,
      },
      milling: d.milling,
    }
    if (d.type === 'kitchen') {
      loadKitchen(options)
    } else {
      loadFurniture({
        type: d.type,
        layout: d.type === 'tv' ? 'straight' : d.layout,
        lengthA: d.lengthA,
        lengthB: d.layout === 'corner' ? d.lengthB : undefined,
        materials: { carcassId: d.carcassId || undefined, frontId: d.frontId || undefined },
      })
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-4 w-full max-w-3xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Тақырып + қадам индикаторы */}
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-semibold">{tr('Мастер мебели')}</h2>
          <div className="ml-auto">
            <Button onClick={onClose}>{tr('Закрыть')}</Button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] transition',
                i === step
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : i < step
                    ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200'
                    : 'text-neutral-400',
              )}
            >
              {i + 1}. {tr(label)}
            </button>
          ))}
        </div>

        {/* ── Қадам 1: орналасу ─────────────────────────────────────────── */}
        {step === 0 ? (
          <div className="space-y-3">
            <Field label={tr('Тип мебели')}>
              <Select
                value={d.type}
                onChange={(v) => set('type', v)}
                options={[
                  { value: 'kitchen', label: tr('Кухня') },
                  { value: 'wardrobe', label: tr('Шкаф') },
                  { value: 'tv', label: tr('ТВ-зона') },
                  { value: 'chest', label: tr('Комод') },
                ]}
              />
            </Field>
            {d.type !== 'tv' ? (
              <Field label={tr('Форма')}>
                <Select
                  value={d.layout}
                  onChange={(v) => set('layout', v)}
                  options={[
                    { value: 'straight', label: tr('Прямая (одна стена)') },
                    { value: 'corner', label: tr('Угловая (Г, две стены)') },
                  ]}
                />
              </Field>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr('Стена A, мм')}>
                <NumberInput value={d.lengthA} onChange={(v) => set('lengthA', v)} min={600} step={100} />
              </Field>
              {d.layout === 'corner' && d.type !== 'tv' ? (
                <Field label={tr('Стена B, мм')}>
                  <NumberInput value={d.lengthB} onChange={(v) => set('lengthB', v)} min={600} step={100} />
                </Field>
              ) : null}
            </div>
            <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Стена делится на стандартные модули автоматически. Кухня — с мойкой и техникой; шкаф, комод и ТВ-зона — рядом модулей.')}
            </p>
          </div>
        ) : null}

        {/* ── Қадам 2: өлшемдер ─────────────────────────────────────────── */}
        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={tr('Высота низа, мм')}>
              <NumberInput value={d.lowerHeight} onChange={(v) => set('lowerHeight', v)} min={500} step={10} />
            </Field>
            <Field label={tr('Глубина низа, мм')}>
              <NumberInput value={d.lowerDepth} onChange={(v) => set('lowerDepth', v)} min={280} step={10} />
            </Field>
            <Field label={tr('Цоколь, мм')}>
              <NumberInput value={d.plinthHeight} onChange={(v) => set('plinthHeight', v)} min={0} step={5} />
            </Field>
            <Field label={tr('Свес столешницы, мм')}>
              <NumberInput value={d.worktopOverhang} onChange={(v) => set('worktopOverhang', v)} min={0} step={5} />
            </Field>
            <Field label={tr('Фартук, мм')} hint={tr('0 — нет')}>
              <NumberInput value={d.backsplashHeight} onChange={(v) => set('backsplashHeight', v)} min={0} step={50} />
            </Field>
            <div />
            <Field label={tr('Верх: от пола, мм')}>
              <NumberInput value={d.upperElevation} onChange={(v) => set('upperElevation', v)} min={800} step={10} />
            </Field>
            <Field label={tr('Верх: высота, мм')}>
              <NumberInput value={d.upperHeight} onChange={(v) => set('upperHeight', v)} min={300} step={10} />
            </Field>
            <Field label={tr('Верх: глубина, мм')}>
              <NumberInput value={d.upperDepth} onChange={(v) => set('upperDepth', v)} min={200} step={10} />
            </Field>
          </div>
        ) : null}

        {/* ── Қадам 3: мазмұн ───────────────────────────────────────────── */}
        {step === 2 ? (
          <div className="space-y-2">
            {([
              ['upper', tr('Верхний ряд шкафов')],
              ['sink', tr('Модуль под мойку')],
              ['appliances', tr('Техника и пенал (холодильник, ящики)')],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                <input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
            <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Модули низа чередуются: ящики и распашные, мойка по центру, пенал с краю.')}
            </p>
          </div>
        ) : null}

        {/* ── Қадам 4: конструкция ──────────────────────────────────────── */}
        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              {tr('Фурнитура (ручки, петли, направляющие) берётся из профиля цеха — она уже настроена и применится ко всем модулям. Изменить можно в «Цех».')}
            </p>
            <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Отдельная настройка техники и подсветки появится здесь позже.')}
            </p>
          </div>
        ) : null}

        {/* ── Қадам 5: материалдар ──────────────────────────────────────── */}
        {step === 4 ? (
          <div className="space-y-3">
            <Field label={tr('Корпус')}>
              <Select value={d.carcassId} onChange={(v) => set('carcassId', v)} options={materialOptions} />
            </Field>
            <Field label={tr('Фасады')}>
              <Select value={d.frontId} onChange={(v) => set('frontId', v)} options={materialOptions} />
            </Field>
            <Field label={tr('Столешница')}>
              <Select value={d.worktopId} onChange={(v) => set('worktopId', v)} options={materialOptions} />
            </Field>
            <Field label={tr('Фрезеровка фасадов')}>
              <Select
                value={d.milling}
                onChange={(v) => set('milling', v)}
                options={MILLING_PATTERNS.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: tr(p.name) }))}
              />
            </Field>
          </div>
        ) : null}

        {/* ── Навигация ─────────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {tr('Назад')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button active onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {tr('Далее')}
            </Button>
          ) : (
            <Button active onClick={generate}>{d.type === 'kitchen' ? tr('Собрать кухню') : tr('Собрать')}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
