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
import { MILLING_PATTERNS, MODULE_KINDS, kitchenLayout } from '@/src/core/index'
import type { KitchenOptions, MillingPatternId, FurnitureType, KitchenModule } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

type Draft = {
  type: FurnitureType
  layout: 'straight' | 'corner' | 'u'
  lengthA: number
  lengthB: number
  lengthC: number
  sink: boolean
  upper: boolean
  appliances: boolean
  glassUpper: boolean
  ledUpper: boolean
  hob: 'gas' | 'electric' | 'none'
  hood: boolean
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
  /** null — авто-құрастыру; әйтпесе — қолмен өзгертілген раскладка. */
  modules: { runA: KitchenModule[]; runB: KitchenModule[] } | null
}

const DEFAULT: Draft = {
  type: 'kitchen', layout: 'corner', lengthA: 3200, lengthB: 2400, lengthC: 2000,
  sink: true, upper: true, appliances: true, glassUpper: false, ledUpper: false,
  hob: 'gas', hood: true,
  lowerHeight: 720, lowerDepth: 500, plinthHeight: 95,
  upperDepth: 320, upperHeight: 720, upperElevation: 1460,
  // Фартук әдепкіде ҚОСУЛЫ: 600 мм. Сан qdesign шеберінің 2-қадамындағы
  // әдепкі баптауынан оқылды («Жұмыс биіктігі 860 · Фартук 600»), жазбасы —
  // docs/visual/generator-gaps.md. Бұрын әдепкі 0 еді, сондықтан столешница
  // мен үстіңгі қатардың арасы жалаң қабырға болып тұратын.
  // (қара: docs/audit/qdesign-drilling-reference.md). Столешница мен үстіңгі
  // қатардың арасы жалаң қабырға болып қалмас үшін.
  worktopOverhang: 30, backsplashHeight: 600,
  carcassId: '', frontId: '', worktopId: '',
  milling: 'plain',
  modules: null,
}

const STEPS = ['Расположение', 'Размеры', 'Наполнение', 'Конструкция', 'Материалы'] as const


/** Бір қатардың раскладка редакторы: модуль қосу/өшіру/жылжыту/түрін өзгерту. */
function RunEditor(
  { title, run, onChange }: { title: string; run: KitchenModule[]; onChange: (r: KitchenModule[]) => void },
) {
  const cell = 'rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs outline-none dark:border-neutral-600 dark:bg-neutral-900'
  const icon = 'rounded border border-neutral-300 px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'
  const setAt = (i: number, patch: Partial<KitchenModule>) => onChange(run.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const remove = (i: number) => onChange(run.filter((_, j) => j !== i))
  const move = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= run.length) return
    const copy = [...run]
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    onChange(copy)
  }
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-neutral-500">{title}</div>
      <div className="space-y-1">
        {run.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-4 text-right text-[10px] tabular-nums text-neutral-400">{i + 1}</span>
            <select className={cn(cell, 'flex-1')} value={m.kind} onChange={(e) => setAt(i, { kind: e.target.value as KitchenModule['kind'] })}>
              {MODULE_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>{tr(k.name)}</option>
              ))}
            </select>
            <input
              type="number" className={cn(cell, 'w-16 tabular-nums')} value={m.width} min={200} step={50}
              onChange={(e) => setAt(i, { width: Math.round(Number(e.target.value)) })}
            />
            <button type="button" className={icon} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className={icon} disabled={i === run.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className={icon} onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-1.5 rounded border border-dashed border-neutral-400 px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        onClick={() => onChange([...run, { kind: 'baseDoors', width: 600 }])}
      >
        + {tr('Добавить модуль')}
      </button>
    </div>
  )
}

export function KitchenWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useConfigurator((s) => s.catalog)
  const loadKitchen = useConfigurator((s) => s.loadKitchen)
  const loadFurniture = useConfigurator((s) => s.loadFurniture)
  const runBusy = useConfigurator((s) => s.runBusy)
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>(DEFAULT)
  const [prompt, setPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  if (!open) return null

  const materialOptions = [
    { value: '', label: tr('Как в шаблоне') },
    ...catalog.materials.map((m) => ({ value: m.id, label: m.name })),
  ]

  /** Сөзбен: сипаттаманы серверге жіберіп, драфтты толтыру. */
  const fromText = async () => {
    if (!prompt.trim()) return
    setAiBusy(true)
    setAiError(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = (await res.json()) as { options?: { type: FurnitureType; layout: 'straight' | 'corner'; lengthA: number; lengthB: number | null; sink: boolean; upper: boolean; appliances: boolean }; error?: string }
      if (!res.ok || !data.options) {
        setAiError(data.error ?? 'Не получилось')
        return
      }
      const o = data.options
      setD((p) => ({
        ...p,
        type: o.type,
        layout: o.layout,
        lengthA: o.lengthA,
        lengthB: o.lengthB ?? p.lengthB,
        sink: o.sink,
        upper: o.upper,
        appliances: o.appliances,
        modules: null,
      }))
    } catch {
      setAiError('Сеть недоступна')
    } finally {
      setAiBusy(false)
    }
  }

  /** Ағымдағы драфттан KitchenOptions (раскладканы алдын ала есептеу үшін де). */
  const kitchenOpts = (): KitchenOptions => ({
    layout: d.layout,
    lengthA: d.lengthA,
    lengthB: d.layout === 'corner' || d.layout === 'u' ? d.lengthB : undefined,
    lengthC: d.layout === 'u' ? d.lengthC : undefined,
    sink: d.sink,
    upper: d.upper,
    appliances: d.appliances,
    glassUpper: d.glassUpper,
    ledUpper: d.ledUpper,
    hob: d.hob,
    hood: d.hood,
  })

  const generate = () => {
    const options: KitchenOptions = {
      layout: d.layout,
      lengthA: d.lengthA,
      lengthB: d.layout === 'corner' || d.layout === 'u' ? d.lengthB : undefined,
      lengthC: d.layout === 'u' ? d.lengthC : undefined,
      sink: d.sink,
      upper: d.upper,
      appliances: d.appliances,
      glassUpper: d.glassUpper,
      ledUpper: d.ledUpper,
      hob: d.hob,
      hood: d.hood,
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
      modules: d.modules ?? undefined,
    }
    // Құрастыру бірнеше секунд алады — «Жүктелуде…» оверлейімен (qdesign сияқты).
    runBusy(tr('Собираем проект…'), () => {
      if (d.type === 'kitchen') {
        loadKitchen(options)
      } else {
        loadFurniture({
          type: d.type,
          // U тек ас үйде; басқа түрде ол болмайды, бірақ TS үшін тарылтамыз.
          layout: d.type === 'tv' || d.layout === 'u' ? (d.layout === 'u' ? 'corner' : 'straight') : d.layout,
          lengthA: d.lengthA,
          lengthB: d.layout === 'corner' ? d.lengthB : undefined,
          materials: { carcassId: d.carcassId || undefined, frontId: d.frontId || undefined },
        })
      }
    })
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
            {/* Сөзбен генерация (qdesign шеберінің жоғарысындағыдай). */}
            <div className="rounded-md border border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-600 dark:bg-neutral-800/50">
              <div className="mb-1 text-[11px] font-medium text-neutral-500">{tr('Опишите словами')}</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-600 dark:bg-neutral-900"
                  placeholder={tr('Напр.: угловая кухня 3 и 2 метра с посудомойкой, без верхних')}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void fromText() }}
                />
                <Button active disabled={aiBusy || !prompt.trim()} onClick={() => void fromText()}>
                  {aiBusy ? tr('…') : tr('Заполнить')}
                </Button>
              </div>
              {aiError ? <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{aiError}</p> : null}
            </div>

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
                    ...(d.type === 'kitchen' ? [{ value: 'u' as const, label: tr('П-образная (три стены)') }] : []),
                  ]}
                />
              </Field>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr('Стена A, мм')}>
                <NumberInput value={d.lengthA} onChange={(v) => set('lengthA', v)} min={600} step={100} />
              </Field>
              {(d.layout === 'corner' || d.layout === 'u') && d.type !== 'tv' ? (
                <Field label={tr('Стена B, мм')}>
                  <NumberInput value={d.lengthB} onChange={(v) => set('lengthB', v)} min={600} step={100} />
                </Field>
              ) : null}
              {d.layout === 'u' && d.type === 'kitchen' ? (
                <Field label={tr('Стена C, мм')}>
                  <NumberInput value={d.lengthC} onChange={(v) => set('lengthC', v)} min={600} step={100} />
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
          <div className="space-y-3">
            {([
              ['upper', tr('Верхний ряд шкафов')],
              ['sink', tr('Модуль под мойку')],
              ['appliances', tr('Техника и пенал (холодильник, ящики)')],
              ['glassUpper', tr('Стеклянные верхние дверцы')],
              ['ledUpper', tr('Подсветка под верхними (LED)')],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                <input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
            {/* Раскладка редакторы: авто тізімді қолмен өзгерту (qdesign 3-қадамы). */}
            <div className="rounded-md border border-neutral-300 p-2 dark:border-neutral-600">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium">{tr('Раскладка по модулям')}</span>
                <div className="ml-auto flex gap-1.5">
                  {d.modules ? (
                    <Button onClick={() => set('modules', null)}>{tr('Сбросить (авто)')}</Button>
                  ) : (
                    <Button active onClick={() => set('modules', kitchenLayout(kitchenOpts()))}>
                      {tr('Разложить по модулям')}
                    </Button>
                  )}
                </div>
              </div>
              {d.modules ? (
                <div className="space-y-3">
                  <RunEditor
                    title={tr('Стена A (нижний ряд)')}
                    run={d.modules.runA}
                    onChange={(runA) => set('modules', { runA, runB: d.modules!.runB })}
                  />
                  {d.layout === 'corner' ? (
                    <RunEditor
                      title={tr('Стена B (нижний ряд)')}
                      run={d.modules.runB}
                      onChange={(runB) => set('modules', { runA: d.modules!.runA, runB })}
                    />
                  ) : null}
                  <p className="text-[11px] leading-snug text-neutral-400">
                    {tr('Порядок = слева направо. Ширины можно менять; сумма определит длину стены.')}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] leading-snug text-neutral-400">
                  {tr('Модули низа чередуются: ящики и распашные, мойка по центру, пенал с краю. Нажмите, чтобы изменить вручную.')}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Қадам 4: конструкция ──────────────────────────────────────── */}
        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              {tr('Фурнитура (ручки, петли, направляющие) берётся из профиля цеха — она уже настроена и применится ко всем модулям. Изменить можно в «Цех».')}
            </p>
            <Field label={tr('Варочная панель')}>
              <Select
                value={d.hob}
                onChange={(v) => set('hob', v)}
                options={[
                  { value: 'gas' as const, label: tr('Газовая') },
                  { value: 'electric' as const, label: tr('Электрическая') },
                  { value: 'none' as const, label: tr('Нет') },
                ]}
              />
            </Field>
            <label className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
              <input
                type="checkbox"
                checked={d.hood && d.hob !== 'none'}
                disabled={d.hob === 'none'}
                onChange={(e) => set('hood', e.target.checked)}
              />
              {tr('Вытяжка над плитой')}
            </label>
            <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Техника клиента: видна в 3D, в смету не входит.')}
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
