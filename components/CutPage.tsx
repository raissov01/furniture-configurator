'use client'

/**
 * `/cut` — раскройдың ЖЕКЕ беті.
 *
 * Смета терезесіндегі «Раскрой» табы карта көрсетеді, ал цехтың станокқа
 * баратын адамына одан артық керек: пропил мен подрезка қанша қойылған,
 * әр парақтың КИМ-і қандай, неше рез, қанша метр, парақты неше рет бұру
 * керек. Сол сұрақтардың бәрі БІР экранда тұруы үшін бөлек бет жасалды —
 * оны басып шығарып, станоктың қасына іліп қоюға болады.
 *
 * Мұнда бірде бір сан ЕСЕПТЕЛМЕЙДІ: бәрі `nestPanels` пен `cutPlan`-нан
 * келеді, сондықтан экрандағы сан мен экспорттағы сан ажырамайды (§3).
 */

import { t as tr } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, NumberInput, Select } from '@/components/ui'
import { useSceneItems } from '@/lib/useSceneItems'
import {
  cutPlan,
  mergeProjectPanels,
  nestPanels,
  nestingOptionsOf,
  unplacedAdvice,
} from '@/src/core/index'
import type {
  CutLine, CutStats, NestedSheet, OptimizationLevel, SheetCutPlan,
} from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { cn } from '@/lib/cn'

/** Парақ сызбасының экрандағы ені, пиксель. */
const SHEET_PX = 520

/**
 * ⚠ Тізім ФУНКЦИЯ, тұрақты емес. Модуль деңгейіндегі `tr()` тіл сақтаудан
 * оқылғанға ДЕЙІН орындалады да, экранда әрқашан орысша қалып қояды.
 */
const optimizationOptions = (): { value: OptimizationLevel; label: string }[] => [
  { value: 'fast', label: tr('Быстрая — одна раскладка') },
  { value: 'standard', label: tr('Обычная — четыре раскладки') },
  { value: 'deep', label: tr('Глубокая — все шестнадцать') },
]

/** Подрезка «материалдан» дегенді бөлек мән етіп көрсетеміз. */
const TRIM_FROM_MATERIAL = -1

const metres = (mm: number): string => (mm / 1000).toFixed(1)
const squareMetres = (mm2: number): string => (mm2 / 1_000_000).toFixed(2)

function download(filename: string, data: Uint8Array | string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Қаріп pdf-lib-ке сырттан беріледі: стандарт қаріптері кириллицаны білмейді. */
async function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const [regular, bold] = await Promise.all([
    fetch('/fonts/DejaVuSans-subset.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/DejaVuSans-Bold-subset.ttf').then((r) => r.arrayBuffer()),
  ])
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) }
}

export function CutPage() {
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const editShop = useConfigurator((s) => s.editShop)
  const hydrateShop = useConfigurator((s) => s.hydrateShop)
  const hydrateProject = useConfigurator((s) => s.hydrateProject)

  // Сақталған жоба мен цех профилі тек браузерде оқылады — серверде оқысақ,
  // гидратация сәйкессіздігі шығады (Workspace-тегі себеп).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateShop()
    hydrateProject()
    setMounted(true)
  }, [hydrateShop, hydrateProject])

  const [showCuts, setShowCuts] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const items = useSceneItems(room, cabinets, placements, catalog, shop.settings)
  const panels = useMemo(
    () => mergeProjectPanels(items.map((i) => ({ cabinetId: i.cabinet.id, panels: i.panels }))),
    [items],
  )
  const projectName = cabinets.length === 1 ? cabinets[0]!.name : `Проект (${cabinets.length} корпуса)`

  const cutting = shop.cutting
  const options = useMemo(() => nestingOptionsOf(shop), [shop])
  const nesting = useMemo(() => {
    try {
      return nestPanels(panels, catalog, options)
    } catch {
      return null
    }
  }, [panels, catalog, options])
  const plan = useMemo(
    () => (nesting ? cutPlan(nesting, { kerf: cutting.kerf }) : null),
    [nesting, cutting.kerf],
  )
  const advice = useMemo(
    () => (nesting ? unplacedAdvice(nesting, panels, catalog, options) : []),
    [nesting, panels, catalog, options],
  )

  const setCutting = (patch: Partial<typeof cutting>) =>
    editShop({ cutting: { ...cutting, ...patch } })

  const run = async (kind: string, action: () => Promise<void>) => {
    setBusy(kind)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          <Link
            href="/configurator"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-300"
          >
            ← {tr('Конфигуратор')}
          </Link>
          <h1 className="text-sm font-semibold">{tr('Раскрой')}</h1>
          <span className="text-[11px] text-neutral-500">{projectName}</span>

          <div className="ml-auto flex items-center gap-1">
            <Button active={showCuts} onClick={() => setShowCuts(!showCuts)}>
              {tr('Показать резы')}
            </Button>
            <Button
              disabled={busy !== null || !nesting}
              title={tr('Карта раскроя для цеха, по листу на страницу')}
              onClick={() => void run('map', async () => {
                const { nestingPdf } = await import('@/src/core/export/nestingPdf')
                const bytes = await nestingPdf({ nesting: nesting!, projectName, fonts: await loadFonts() })
                download(`${projectName}-раскрой.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'map' ? '…' : tr('PDF карты')}
            </Button>
            <Button
              disabled={busy !== null || !nesting}
              title={tr('По одному DXF на лист, всё в архиве')}
              onClick={() => void run('dxf', async () => {
                const [{ nestingToDxfFiles }, { zipSync, strToU8 }] = await Promise.all([
                  import('@/src/core/export/dxf'),
                  import('fflate'),
                ])
                const entries: Record<string, Uint8Array> = {}
                for (const [name, content] of nestingToDxfFiles(nesting!)) entries[name] = strToU8(content)
                download(
                  `${projectName}-раскрой-dxf.zip`,
                  zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
                  'application/zip',
                )
              })}
            >
              {busy === 'dxf' ? '…' : 'DXF'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {!mounted ? (
          <p className="text-xs text-neutral-500">{tr('Загрузка проекта…')}</p>
        ) : !nesting || !plan ? (
          <p className="text-xs text-neutral-500">{tr('Нет деталей для раскроя.')}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-3 self-start rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {tr('Настройки станка')}
              </h2>

              <Field label={tr('Пропил, мм')} hint={tr('толщина пилы')}>
                <NumberInput
                  value={cutting.kerf}
                  min={0}
                  max={20}
                  onChange={(kerf) => setCutting({ kerf })}
                />
              </Field>

              <Field label={tr('Обрезка, мм')} hint={tr('на сторону')}>
                <Select
                  value={String(cutting.trimEdge ?? TRIM_FROM_MATERIAL)}
                  onChange={(v) => setCutting({ trimEdge: Number(v) === TRIM_FROM_MATERIAL ? null : Number(v) })}
                  options={[
                    { value: String(TRIM_FROM_MATERIAL), label: tr('Как в материале') },
                    ...[0, 5, 10, 15, 20, 25].map((n) => ({ value: String(n), label: `${n} мм` })),
                  ]}
                />
              </Field>

              <Field label={tr('Оптимизация')} hint={tr('глубина поиска')}>
                <Select
                  value={cutting.optimization}
                  onChange={(optimization) => setCutting({ optimization })}
                  options={optimizationOptions()}
                />
              </Field>

              <p className="text-[10px] leading-relaxed text-neutral-500">
                {tr('Настройки принадлежат цеху, а не проекту: они сохраняются в профиле и применяются ко всем расчётам.')}
              </p>
            </aside>

            <div className="space-y-5">
              {advice.length > 0 ? <UnplacedBlock advice={advice} /> : null}

              <Totals stats={plan.stats} sheetCount={nesting.sheetCount} />

              {plan.byMaterial.map((m) => {
                const material = nesting.byMaterial.find((x) => x.materialId === m.materialId)!
                return (
                  <section key={m.materialId} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-sm font-semibold">{material.materialName}</h2>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {material.sheets.length} {tr('л')} · {tr('КИМ')} {m.stats.kim.toFixed(1)}% ·{' '}
                        {tr('резов')} {m.stats.cutCount} · {metres(m.stats.cutLength)} {tr('м')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {material.sheets.map((sheet) => (
                        <SheetCard
                          key={sheet.index}
                          sheet={sheet}
                          plan={m.sheets.find((s) => s.index === sheet.index)!}
                          showCuts={showCuts}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Totals({ stats, sheetCount }: { stats: CutStats; sheetCount: number }) {
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: tr('Листов'), value: String(sheetCount) },
    { label: tr('КИМ'), value: `${stats.kim.toFixed(1)}%`, hint: tr('деталь / полный лист') },
    { label: tr('Резов'), value: String(stats.cutCount) },
    { label: tr('Длина резов'), value: `${metres(stats.cutLength)} м` },
    { label: tr('Поворотов листа'), value: String(stats.turns) },
    { label: tr('Деловой отход'), value: `${squareMetres(stats.offcutArea)} м²` },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{c.label}</div>
          <div className="text-lg font-semibold tabular-nums">{c.value}</div>
          {c.hint ? <div className="text-[10px] text-neutral-400">{c.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

/** Рездің түсі: обрезка сұр, бөлу қызыл, өлшемге келтіру қоңыр. */
const CUT_COLOR: Record<CutLine['kind'], string> = {
  trim: '#94a3b8',
  split: '#dc2626',
  size: '#ea580c',
}

function SheetCard({
  sheet, plan, showCuts,
}: { sheet: NestedSheet; plan: SheetCutPlan; showCuts: boolean }) {
  const scale = SHEET_PX / sheet.sheetWidth
  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
        width={SHEET_PX}
        height={sheet.sheetHeight * scale}
        className="rounded border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950"
        role="img"
        aria-label={`Лист ${sheet.index}`}
      >
        <rect
          x={sheet.usable.x} y={sheet.usable.y}
          width={sheet.usable.width} height={sheet.usable.height}
          fill="none" stroke="#94a3b8" strokeWidth={4} strokeDasharray="18 12"
        />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.width} height={o.height}
            fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeOpacity={0.5} strokeWidth={3} />
        ))}
        {sheet.parts.map((p) => (
          <g key={p.panelId}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height}
              fill="#e3c76a" stroke="#7c5f14" strokeWidth={4} />
            <text
              x={p.x + p.width / 2} y={p.y + p.height / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(34, Math.min(p.width, p.height) * 0.16)}
              fill="#3f3108"
            >
              {p.label} {p.width}×{p.height}
            </text>
          </g>
        ))}
        {showCuts ? plan.cuts.map((c) => {
          const x1 = c.axis === 'v' ? c.at : c.from
          const x2 = c.axis === 'v' ? c.at : c.to
          const y1 = c.axis === 'v' ? c.from : c.at
          const y2 = c.axis === 'v' ? c.to : c.at
          return (
            <g key={c.order}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={CUT_COLOR[c.kind]} strokeWidth={6}
                strokeDasharray={c.kind === 'trim' ? '24 16' : undefined}
                strokeOpacity={0.85}
              />
              <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={30} fill={CUT_COLOR[c.kind]} />
              <text
                x={(x1 + x2) / 2} y={(y1 + y2) / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={34} fill="#ffffff"
              >
                {c.order}
              </text>
            </g>
          )
        }) : null}
      </svg>
      <figcaption className="w-[520px] max-w-full text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {tr('Лист')} {sheet.index}
        </span>{' '}
        · {sheet.sheetWidth}×{sheet.sheetHeight} · {tr('КИМ')}{' '}
        <span className="tabular-nums">{plan.stats.kim.toFixed(1)}%</span> · {tr('резов')}{' '}
        <span className="tabular-nums">{plan.stats.cutCount}</span> ({metres(plan.stats.cutLength)} {tr('м')})
        · {tr('поворотов')} <span className="tabular-nums">{plan.stats.turns}</span>
        {sheet.offcuts.length > 0 ? ` · ${tr('деловой отход')}: ${sheet.offcuts.length}` : ''}
      </figcaption>
    </figure>
  )
}

/**
 * «Не помещается» — және НЕ ІСТЕУ КЕРЕК. Кеңесті ядро есептейді
 * (`unplacedAdvice`), сондықтан ол әрқашан ағымдағы баптаудың сандарымен келеді.
 */
function UnplacedBlock({ advice }: { advice: ReturnType<typeof unplacedAdvice> }) {
  return (
    <div className={cn(
      'space-y-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-900',
      'dark:border-red-900 dark:bg-red-950 dark:text-red-100',
    )}>
      <h2 className="text-sm font-semibold">{tr('Не помещаются на лист')}</h2>
      {advice.map((a) => (
        <div key={a.panelId} className="space-y-1">
          <div className="font-medium">
            {a.label} — {a.cutLength}×{a.cutWidth} {tr('мм')}, {tr('лист')} {a.materialName}{' '}
            ({tr('полезно')} {a.usable.width}×{a.usable.height}, {tr('обрезка')} {a.trimEdge} {tr('мм')})
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {a.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
