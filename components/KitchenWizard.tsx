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
import { hasDraftErrors, updateDraftErrors } from '@/lib/numberDraft'
import { KITCHEN_WALL_UI_MAX } from '@/lib/kitchenWallInput'
import { selectWorktopMaterials, updateWizardLayout, visibleWizardDraftErrors } from '@/lib/kitchenWizardDraft'
import { DEFAULT_STAGE_DRAFT, stageOptions, validateStageDraft } from '@/lib/stageBuilder'
import type { StageDraft } from '@/lib/stageBuilder'
import { MILLING_PATTERNS, MODULE_KINDS, furnitureMinWallLength, kitchenLayout } from '@/src/core/index'
import type { FurnitureType, KitchenModule } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { StagePreview } from '@/components/StagePreview'

const STEPS = ['Расположение', 'Размеры', 'Наполнение', 'Конструкция', 'Материалы'] as const


/** Бір қатардың раскладка редакторы: модуль қосу/өшіру/жылжыту/түрін өзгерту. */
function RunEditor(
  { title, run, onChange, fieldPrefix, onDraftValidityChange }: { title: string; run: KitchenModule[]; onChange: (r: KitchenModule[]) => void; fieldPrefix: string; onDraftValidityChange: (field: string, invalid: boolean) => void },
) {
  const cell = 'rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs outline-none dark:border-neutral-600 dark:bg-neutral-900'
  const icon = 'rounded border border-neutral-300 px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'
  const setAt = (i: number, patch: Partial<KitchenModule>) => onChange(run.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const clearFrom = (i: number) => {
    for (let j = i; j < run.length; j++) onDraftValidityChange(`${fieldPrefix}.${j}`, false)
  }
  const remove = (i: number) => { clearFrom(i); onChange(run.filter((_, j) => j !== i)) }
  const move = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= run.length) return
    clearFrom(Math.min(i, j))
    const copy = [...run]
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    onChange(copy)
  }
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-neutral-500">{title}</div>
      <div className="space-y-1">
        {run.map((m, i) => (
          <div key={i} className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_4rem] items-center gap-1 sm:flex">
            <span className="w-4 text-right text-[10px] tabular-nums text-neutral-400">{i + 1}</span>
            <select className={cn(cell, 'min-w-0 sm:flex-1')} value={m.kind} onChange={(e) => setAt(i, { kind: e.target.value as KitchenModule['kind'] })}>
              {MODULE_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>{tr(k.name)}</option>
              ))}
            </select>
            <span className="min-w-0 sm:w-16"><NumberInput value={m.width} min={200} max={KITCHEN_WALL_UI_MAX} field={`${fieldPrefix}.${i}`} label={`${tr('Ширина, мм')} ${i + 1}`} onDraftValidityChange={onDraftValidityChange} onChange={(width) => setAt(i, { width })} /></span>
            <div className="col-span-3 flex justify-end gap-1 sm:contents">
              <button type="button" className={icon} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className={icon} disabled={i === run.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className={icon} onClick={() => remove(i)}>✕</button>
            </div>
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
  const [d, setD] = useState<StageDraft>(DEFAULT_STAGE_DRAFT)
  const [prompt, setPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [draftErrors, setDraftErrors] = useState<Record<string, boolean>>({})
  const draftValidityChanged = (field: string, invalid: boolean) => setDraftErrors((errors) => updateDraftErrors(errors, field, invalid))
  const set = <K extends keyof StageDraft>(k: K, v: StageDraft[K]) => setD((p) => ({ ...p, [k]: v }))

  if (!open) return null

  const materialOptions = [
    { value: '', label: tr('Как в шаблоне') },
    ...catalog.materials.map((m) => ({ value: m.id, label: m.name })),
  ]

  const worktopOptions = [materialOptions[0]!, ...selectWorktopMaterials(catalog.materials).map((m) => ({ value: m.id, label: m.name }))]
  const validation = validateStageDraft(d, catalog.materials)
  const invalid = hasDraftErrors(draftErrors) || Boolean(validation)

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

  const generate = () => {
    if (invalid) { setGenerateError(validation?.message ?? tr('Исправьте поля с ошибками')); return }
    setGenerateError(null)
    const next = stageOptions(d)
    // Құрастыру бірнеше секунд алады — «Жүктелуде…» оверлейімен (qdesign сияқты).
    runBusy(tr('Собираем проект…'), () => {
      try {
        if (next.kind === 'kitchen') {
          loadKitchen(next.options)
        } else {
          loadFurniture(next.options)
        }
        onClose()
      } catch (cause) {
        setGenerateError(cause instanceof Error ? cause.message : String(cause))
      }
    })
  }

  return (
    <div
      className="fixed inset-y-0 left-0 z-[60] flex w-screen items-start justify-center overflow-x-hidden overflow-y-auto bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        data-testid="stage-builder-dialog"
        className="mt-4 box-border min-w-0 w-full max-w-[calc(100vw-1rem)] overflow-x-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Тақырып + қадам индикаторы */}
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-semibold">{tr('Мастер мебели')}</h2>
          <div className="ml-auto">
            <Button onClick={onClose}>{tr('Закрыть')}</Button>
          </div>
        </div>
        <div data-testid="stage-step-bar" className="mb-4 flex flex-wrap gap-1.5">
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
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-600 dark:bg-neutral-900"
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
                onChange={(v) => {
                  const layout = v === 'tv' || v === 'bedroom' ? 'straight'
                    : v !== 'kitchen' && d.layout === 'u' ? 'straight' : d.layout
                  setD((previous) => ({ ...previous, type: v, layout, modules: null }))
                  setDraftErrors((errors) => Object.fromEntries(
                    Object.entries(visibleWizardDraftErrors(errors, layout))
                      .filter(([field]) => !field.startsWith('runA.') && !field.startsWith('runB.')),
                  ))
                  setGenerateError(null)
                }}
                options={[
                  { value: 'kitchen', label: tr('Кухня') },
                  { value: 'wardrobe', label: tr('Шкаф') },
                  { value: 'tv', label: tr('ТВ-зона') },
                  { value: 'chest', label: tr('Комод') },
                  { value: 'office', label: tr('Кабинет') },
                  { value: 'bedroom', label: tr('Спальня') },
                ]}
              />
            </Field>
            {d.type !== 'tv' && d.type !== 'bedroom' ? (
              <Field label={tr('Форма')}>
                <Select
                  value={d.layout}
                  onChange={(v) => { setD((prev) => updateWizardLayout(prev, v)); setDraftErrors((errors) => visibleWizardDraftErrors(errors, v)); setGenerateError(null) }}
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
                <NumberInput value={d.lengthA} onChange={(v) => set('lengthA', v)} min={furnitureMinWallLength(d.type)} max={KITCHEN_WALL_UI_MAX} step={100} field="lengthA" onDraftValidityChange={draftValidityChanged} />
              </Field>
              {(d.layout === 'corner' || d.layout === 'u') && d.type !== 'tv' && d.type !== 'bedroom' ? (
                <Field label={tr('Стена B, мм')}>
                  <NumberInput value={d.lengthB} onChange={(v) => set('lengthB', v)} min={600} max={KITCHEN_WALL_UI_MAX} step={100} field="lengthB" onDraftValidityChange={draftValidityChanged} />
                </Field>
              ) : null}
              {d.layout === 'u' && d.type === 'kitchen' ? (
                <Field label={tr('Стена C, мм')}>
                  <NumberInput value={d.lengthC} onChange={(v) => set('lengthC', v)} min={600} max={KITCHEN_WALL_UI_MAX} step={100} field="lengthC" onDraftValidityChange={draftValidityChanged} />
                </Field>
              ) : null}
            </div>
            <p className="text-[11px] leading-snug text-neutral-500">{tr('Модули размещаются по выбранным стенам. Размеры и состав видны в предварительном просмотре.')}</p>
          </div>
        ) : null}

        {/* ── Қадам 2: өлшемдер ─────────────────────────────────────────── */}
        {step === 1 && d.type === 'kitchen' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={tr('Высота низа, мм')}>
              <NumberInput value={d.lowerHeight} onChange={(v) => set('lowerHeight', v)} field="lowerHeight" onDraftValidityChange={draftValidityChanged} min={500} step={10} />
            </Field>
            <Field label={tr('Глубина низа, мм')}>
              <NumberInput value={d.lowerDepth} onChange={(v) => set('lowerDepth', v)} field="lowerDepth" onDraftValidityChange={draftValidityChanged} min={280} step={10} />
            </Field>
            <Field label={tr('Цоколь, мм')}>
              <NumberInput value={d.plinthHeight} onChange={(v) => set('plinthHeight', v)} field="plinthHeight" onDraftValidityChange={draftValidityChanged} min={0} step={5} />
            </Field>
            <Field label={tr('Свес столешницы, мм')}>
              <NumberInput value={d.worktopOverhang} onChange={(v) => set('worktopOverhang', v)} field="worktopOverhang" onDraftValidityChange={draftValidityChanged} min={0} step={5} />
            </Field>
            <Field label={tr('Фартук, мм')} hint={tr('0 — нет')}>
              <NumberInput value={d.backsplashHeight} onChange={(v) => set('backsplashHeight', v)} field="backsplashHeight" onDraftValidityChange={draftValidityChanged} min={0} step={50} />
            </Field>
            <div />
            <Field label={tr('Верх: от пола, мм')}>
              <NumberInput value={d.upperElevation} onChange={(v) => set('upperElevation', v)} field="upperElevation" onDraftValidityChange={draftValidityChanged} min={800} step={10} />
            </Field>
            <Field label={tr('Верх: высота, мм')}>
              <NumberInput value={d.upperHeight} onChange={(v) => set('upperHeight', v)} field="upperHeight" onDraftValidityChange={draftValidityChanged} min={300} step={10} />
            </Field>
            <Field label={tr('Верх: глубина, мм')}>
              <NumberInput value={d.upperDepth} onChange={(v) => set('upperDepth', v)} field="upperDepth" onDraftValidityChange={draftValidityChanged} min={200} step={10} />
            </Field>
          </div>
        ) : null}

        {/* ── Қадам 3: мазмұн ───────────────────────────────────────────── */}
        {step === 1 && d.type !== 'kitchen' ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{tr('Размеры модулей берутся из проверенных шаблонов. Укажите длину стены на первом шаге.')}</p>
        ) : null}

        {step === 2 && d.type === 'kitchen' ? (
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
                    <Button active onClick={() => { const next = stageOptions(d); if (next.kind === 'kitchen') set('modules', kitchenLayout(next.options)) }}>
                      {tr('Разложить по модулям')}
                    </Button>
                  )}
                </div>
              </div>
              {d.modules ? (
                <div className="space-y-3">
                  <RunEditor
                    title={tr('Стена A (нижний ряд)')}
                    fieldPrefix="runA" onDraftValidityChange={draftValidityChanged}
                    run={d.modules.runA}
                    onChange={(runA) => set('modules', { runA, runB: d.modules!.runB })}
                  />
                  {d.layout !== 'straight' ? (
                    <RunEditor
                      title={tr('Стена B (нижний ряд)')}
                      fieldPrefix="runB" onDraftValidityChange={draftValidityChanged}
                      run={d.modules.runB}
                      onChange={(runB) => set('modules', { runA: d.modules!.runA, runB })}
                    />
                  ) : null}
                  {d.layout === 'u' ? <p className="text-[11px] text-neutral-600">{tr('Стена C формируется автоматически; ручная раскладка доступна для A и B.')}</p> : null}
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
        {step === 2 && d.type !== 'kitchen' ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{tr('Состав набора показан в предварительном просмотре. После сборки каждый модуль можно изменить в редакторе.')}</p>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              {tr('Фурнитура (ручки, петли, направляющие) берётся из профиля цеха — она уже настроена и применится ко всем модулям. Изменить можно в «Цех».')}
            </p>
            {d.type === 'kitchen' ? <Field label={tr('Варочная панель')}>
              <Select
                value={d.hob}
                onChange={(v) => set('hob', v)}
                options={[
                  { value: 'gas' as const, label: tr('Газовая') },
                  { value: 'electric' as const, label: tr('Электрическая') },
                  { value: 'none' as const, label: tr('Нет') },
                ]}
              />
            </Field> : null}
            {d.type === 'kitchen' ? <label className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
              <input
                type="checkbox"
                checked={d.hood && d.hob !== 'none'}
                disabled={d.hob === 'none'}
                onChange={(e) => set('hood', e.target.checked)}
              />
              {tr('Вытяжка над плитой')}
            </label> : null}
            {d.type === 'kitchen' ? <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Техника клиента: видна в 3D, в смету не входит.')}
            </p> : null}
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
            {d.type === 'kitchen' ? <Field label={tr('Столешница')}>
              <Select value={d.worktopId} onChange={(v) => set('worktopId', v)} options={worktopOptions} invalid={validation?.field === 'materials.worktopId'} />
              {validation?.field === 'materials.worktopId' ? <span role="alert" className="text-xs text-red-700">{validation.message}</span> : null}
            </Field> : null}
            {d.type === 'kitchen' ? <Field label={tr('Фрезеровка фасадов')}>
              <Select
                value={d.milling}
                onChange={(v) => set('milling', v)}
                options={MILLING_PATTERNS.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: tr(p.name) }))}
              />
            </Field> : null}
          </div>
        ) : null}

        <div className="mt-4"><StagePreview draft={d} /></div>
        {validation ? <p role="alert" className="mt-2 text-xs text-red-700">{validation.message}</p> : null}
        {generateError ? <p role="alert" className="mt-2 text-xs text-red-700">{generateError}</p> : null}
        {/* ── Навигация ─────────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {tr('Назад')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button active disabled={hasDraftErrors(draftErrors)} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {tr('Далее')}
            </Button>
          ) : (
            <Button active disabled={invalid} onClick={generate}>{d.type === 'kitchen' ? tr('Собрать кухню') : tr('Собрать')}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
