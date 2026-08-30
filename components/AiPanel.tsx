'use client'

/**
 * Чат-бот: техзадание жазасың — бірнеше конструкция варианты шығады,
 * таңдағаның бірден конфигуратордың ішіне түседі (B фаза).
 *
 * Мұнда геометрия ЕСЕПТЕЛМЕЙДІ. Сервер дайын `CabinetConfig` қайтарады,
 * оны 3D те, деталировка да, карточкадағы сурет те бірдей оқиды.
 */

import { useState } from 'react'
import { useConfigurator } from '@/store/configurator'
import { CabinetThumb } from '@/components/CabinetThumb'
import { Button, Field, NumberInput } from '@/components/ui'
import { DecorPicker } from '@/components/DecorPicker'
import { cn } from '@/lib/cn'
import type { CabinetBrief, CabinetConfig } from '@/src/core/index'

type Variant = { brief: CabinetBrief; cabinet: CabinetConfig; panelCount: number }
type Dropped = { name: string; reason: string }

const EXAMPLES = [
  'Прихожая 1800 мм, нужен шкаф под верхнюю одежду и обувь',
  'Кухня 3 метра, нижний ряд под столешницу',
  'Балконға стеллаж керек, биіктігі 2 метр, ені 900',
]

/** Тек конфигуратор ШЫНЫМЕН жасай алатын түрлер. Ящик пен купе әлі жоқ. */
const KINDS = [
  'Кухонный модуль',
  'Кухня с ящиками',
  'Шкаф',
  'Комод',
  'Тумба',
  'Стол',
  'Стеллаж',
  'Обувница',
  'Шкаф в ванную',
  'Антресоль',
]

/** 0 — «не задано»: сан қоймаса, оны модель өзі шешеді. */
const UNSET = 0

/** Карточкадағы фас суретінің биіктігі, пиксель. */
const THUMB_PX = 120

export function AiPanel() {
  const open = useConfigurator((s) => s.aiOpen)
  const setOpen = useConfigurator((s) => s.setAiOpen)
  const loadCabinet = useConfigurator((s) => s.loadCabinet)
  const catalog = useConfigurator((s) => s.catalog)

  const materials = useConfigurator((s) => s.shop.materials)
  const carcassMaterials = materials.filter((m) => m.thickness >= 10)

  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [size, setSize] = useState({ height: UNSET, width: UNSET, depth: UNSET })
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [dropped, setDropped] = useState<Dropped[]>([])

  if (!open) return null

  const submit = async () => {
    if ((!prompt.trim() && !kind) || busy) return
    setBusy(true)
    setError(null)
    setDropped([])
    try {
      const res = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          constraints: {
            ...(kind ? { kind } : {}),
            ...(size.height > UNSET ? { height: size.height } : {}),
            ...(size.width > UNSET ? { width: size.width } : {}),
            ...(size.depth > UNSET ? { depth: size.depth } : {}),
            ...(materialId ? { materialId } : {}),
          },
        }),
      })
      const data: unknown = await res.json()
      const payload = data as { variants?: Variant[]; dropped?: Dropped[]; error?: string }
      if (!res.ok) {
        setError(payload.error ?? `Ошибка ${res.status}`)
        setVariants([])
        setDropped(payload.dropped ?? [])
        return
      }
      setVariants(payload.variants ?? [])
      setDropped(payload.dropped ?? [])
    } catch {
      setError('Сервер не ответил. Проверьте, что приложение запущено.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Техзадание</h2>
          <span className="text-[11px] text-neutral-400">опишите задачу словами — предложу варианты</span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        </div>

        <div className="mb-3 space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Что делаем
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(kind === k ? null : k)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition',
                    kind === k
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,7rem))_minmax(0,1fr)]">
            <Field label="Высота (H)" hint={size.height === UNSET ? 'любая' : undefined}>
              <NumberInput value={size.height} min={0} step={10}
                onChange={(height) => setSize((s0) => ({ ...s0, height }))} />
            </Field>
            <Field label="Ширина (W)" hint={size.width === UNSET ? 'любая' : undefined}>
              <NumberInput value={size.width} min={0} step={10}
                onChange={(width) => setSize((s0) => ({ ...s0, width }))} />
            </Field>
            <Field label="Глубина (D)" hint={size.depth === UNSET ? 'любая' : undefined}>
              <NumberInput value={size.depth} min={0} step={10}
                onChange={(depth) => setSize((s0) => ({ ...s0, depth }))} />
            </Field>
            <Field label="Декор" hint={materialId ? undefined : 'на усмотрение'}>
              <DecorPicker
                materials={carcassMaterials}
                value={materialId ?? ''}
                onChange={setMaterialId}
              />
            </Field>
          </div>
          <p className="text-[11px] text-neutral-400">
            Заданные размеры и декор соблюдаются точно. Пустое поле — решает бот.
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit()
          }}
          rows={3}
          placeholder="Например: прихожая 1800 мм, шкаф под верхнюю одежду, глубина 450"
          className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button onClick={() => void submit()} disabled={busy || (!prompt.trim() && !kind)} active>
            {busy ? 'Считаю…' : 'Предложить варианты'}
          </Button>
          <span className="text-[11px] text-neutral-400">Ctrl+Enter</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-500 transition hover:border-neutral-400 dark:border-neutral-700"
            >
              {ex}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {variants.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v) => (
              <button
                key={v.cabinet.id}
                type="button"
                onClick={() => loadCabinet(v.cabinet)}
                className="flex flex-col items-start gap-2 rounded-lg border border-neutral-200 p-3 text-left transition hover:border-neutral-500 hover:shadow-sm dark:border-neutral-700"
              >
                <div className="flex w-full items-end justify-center overflow-hidden" style={{ height: THUMB_PX }}>
                  <CabinetThumb
                    cabinet={v.cabinet}
                    catalog={catalog}
                    pxPerMm={THUMB_PX / v.cabinet.height}
                  />
                </div>
                <div className="text-xs font-medium">{v.brief.name}</div>
                <div className="tabular-nums text-[11px] text-neutral-500">
                  {v.cabinet.height} × {v.cabinet.width} × {v.cabinet.depth} · секций: {v.cabinet.sections.length} · деталей: {v.panelCount}
                </div>
                <div className="text-[11px] leading-snug text-neutral-400">{v.brief.rationale}</div>
              </button>
            ))}
          </div>
        ) : null}

        {dropped.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Отброшено вариантов: {dropped.length}. Они не прошли проверку конструктора:
            <ul className="mt-1 list-inside list-disc">
              {dropped.map((d, i) => (
                <li key={i}>
                  <b>{d.name}</b> — {d.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {variants.length > 0 ? (
          <p className="mt-3 text-[11px] text-neutral-400">
            Вариант заменяет текущий корпус целиком. Ctrl+Z возвращает предыдущий.
          </p>
        ) : null}
      </div>
    </div>
  )
}
