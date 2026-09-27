'use client'

/**
 * Раскрой парағының суреті. Бұл — ЛЕНДИНГТІҢ БАСТЫ ОЙЫ: сурет қолмен
 * салынбаған, оны конфигуратордағы дәл сол `nestPanels()` есептеген.
 * Сондықтан беттегі сурет өнімнің шын мүмкіндігінен ешқашан алшақтамайды.
 *
 * `animateCuts` — беттің жалғыз авторлық қозғалысы: парақ станоктағыдай
 * ГИЛЬОТИНА РЕТІМЕН кесіледі. Рез тізбегі ойдан салынбайды — оны цехтың
 * «Порядок резов» терезесі қолданатын `sheetCutPlan()` береді. Деталь өз
 * шекарасындағы соңғы рез жүргенде ғана «босап», амбер түске боялады.
 * `prefers-reduced-motion`-да немесе JS жоқта — бірден дайын парақ.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { sheetCutPlan, KERF } from '@/src/core/index'
import type { CutLine, NestedPart, NestedSheet } from '@/src/core/index'
import { useSiteText } from '@/components/site/SiteLanguage'
import { motionAllowed, observeOnce } from '@/components/site/motion'

/** Деталь қай рездің соңында толық босайды: оның шекарасына тиетін ең соңғы рез. */
export function freedAfter(part: NestedPart, cuts: readonly CutLine[], kerf = KERF): number {
  const near = (a: number, b: number) => Math.abs(a - b) <= kerf
  const overlaps = (from: number, to: number, a: number, b: number) => from < b && to > a
  let last = 0
  for (const c of cuts) {
    const onEdge = c.axis === 'v'
      ? (near(c.at, part.x) || near(c.at, part.x + part.width)) && overlaps(c.from, c.to, part.y, part.y + part.height)
      : (near(c.at, part.y) || near(c.at, part.y + part.height)) && overlaps(c.from, c.to, part.x, part.x + part.width)
    if (onEdge) last = Math.max(last, c.order)
  }
  return last
}

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function SheetFigure({
  sheet, materialName, compact = false, animateCuts = false,
}: {
  sheet: NestedSheet
  materialName: string
  compact?: boolean
  animateCuts?: boolean
}) {
  const { tr: t } = useSiteText()
  const plan = useMemo(() => sheetCutPlan(sheet), [sheet])
  const figureRef = useRef<HTMLElement>(null)
  const boardRef = useRef<SVGRectElement>(null)
  const partRefs = useRef<(SVGGElement | null)[]>([])
  const cutRefs = useRef<(SVGLineElement | null)[]>([])
  /** Жазудағы рез саны: `null` — соңғы күй (барлық рез). */
  const [cutShown, setCutShown] = useState<number | null>(null)

  useEffect(() => {
    const figure = figureRef.current
    if (!animateCuts || !figure || !motionAllowed()) return
    const cuts = plan.cuts
    if (cuts.length === 0 || typeof figure.animate !== 'function') return
    const timers: number[] = []
    const animations: Animation[] = []
    // Уақыт сызығы (~2.6 с): 0–220 мс дайын парақ «тазарады» (детальдар
    // сөніп, кесілмеген плита шығады) → рездер ретімен жүреді (16 рез
    // болса ~105 мс сайын) → әр деталь соңғы резі біткенде боялады →
    // рез сызықтары сөніп, қалдық сұр болып қалады.
    const clear = 220
    const step = Math.min(120, 1700 / cuts.length)
    const draw = 280
    const startOf = (order: number) => clear + 120 + (order - 1) * step
    const total = startOf(cuts.length) + draw

    const run = () => {
      setCutShown(0)
      const board = boardRef.current
      if (board) {
        const end = total + 450
        animations.push(board.animate(
          [{ opacity: 0 }, { opacity: 1, offset: clear / end }, { opacity: 1, offset: total / end }, { opacity: 0 }],
          { duration: end, easing: 'linear' },
        ))
      }
      cuts.forEach((cut, i) => {
        const line = cutRefs.current[i]
        if (!line) return
        animations.push(line.animate(
          [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }],
          { duration: draw, delay: startOf(cut.order), easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'both' },
        ))
        animations.push(line.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 420, delay: total + 200, easing: 'ease-out', fill: 'forwards' },
        ))
        timers.push(window.setTimeout(() => setCutShown(cut.order), startOf(cut.order)))
      })
      sheet.parts.forEach((part, i) => {
        const g = partRefs.current[i]
        if (!g) return
        const at = freedAfter(part, cuts)
        const shown = (at > 0 ? startOf(at) : clear) + draw * 0.8
        const end = shown + 320
        animations.push(g.animate(
          [
            { opacity: 1, offset: 0 },
            { opacity: 0, offset: clear / end },
            { opacity: 0, offset: shown / end },
            { opacity: 1, offset: 1, easing: EASE_OUT },
          ],
          { duration: end, easing: 'linear' },
        ))
      })
      timers.push(window.setTimeout(() => setCutShown(null), total + 200))
    }

    const stop = observeOnce(figure, run, 0.35)
    return () => {
      stop()
      timers.forEach((id) => window.clearTimeout(id))
      animations.forEach((a) => a.cancel())
    }
  }, [animateCuts, plan, sheet])

  const kim = plan.stats.kim.toFixed(1)
  return (
    <figure ref={figureRef} className="sheet p-3">
      <svg
        viewBox={`-30 -30 ${sheet.sheetWidth + 60} ${sheet.sheetHeight + 60}`}
        className="w-full"
        role="img"
        aria-label={`${t('Карта раскроя')}: ${materialName}, ${t('лист')} ${sheet.index}`}
      >
        <rect x={0} y={0} width={sheet.sheetWidth} height={sheet.sheetHeight}
          fill="none" stroke="var(--ink)" strokeWidth={6} />
        {animateCuts ? (
          // Кесілмеген плита: тек қозғалыс кезінде көрінеді, соңында қалдыққа орын береді.
          <rect ref={boardRef} x={3} y={3} width={sheet.sheetWidth - 6} height={sheet.sheetHeight - 6}
            fill="var(--brand-amber)" fillOpacity={0.3} opacity={0} />
        ) : null}
        <rect
          x={sheet.usable.x} y={sheet.usable.y}
          width={sheet.usable.width} height={sheet.usable.height}
          fill="none" stroke="var(--rule)" strokeWidth={4} strokeDasharray="24 16"
        />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.width} height={o.height}
            fill="var(--neutral-offcut)" fillOpacity={0.06} stroke="var(--neutral-offcut)"
            strokeOpacity={0.35} strokeWidth={3} />
        ))}
        {sheet.parts.map((p, i) => (
          <g key={p.panelId} ref={(el) => { partRefs.current[i] = el }}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height}
              fill="var(--brand-amber)" fillOpacity={0.85} stroke="var(--oak-deep)" strokeWidth={5} />
            {compact ? null : (
              <>
                <text
                  x={p.x + p.width / 2} y={p.y + p.height / 2 - 14}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={46} fill="var(--ink-on-amber)"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t(p.label)}
                </text>
                <text
                  x={p.x + p.width / 2} y={p.y + p.height / 2 + 34}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={38} fill="var(--ink-on-amber-soft)"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {p.width}×{p.height}
                </text>
              </>
            )}
          </g>
        ))}
        {animateCuts ? plan.cuts.map((c, i) => (
          <line
            key={`c${c.order}`}
            ref={(el) => { cutRefs.current[i] = el }}
            x1={c.axis === 'v' ? c.at : c.from} y1={c.axis === 'v' ? c.from : c.at}
            x2={c.axis === 'v' ? c.at : c.to} y2={c.axis === 'v' ? c.to : c.at}
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={0}
            stroke="var(--ink)" strokeWidth={7} strokeLinecap="square" opacity={0}
          />
        )) : null}
      </svg>
      <figcaption
        className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
      >
        <span>{materialName} · {sheet.sheetHeight} (H) × {sheet.sheetWidth} (W)</span>
        <span>
          {t('деталей')} {sheet.parts.length} · {t('резов')}{' '}
          <span className="tabular-nums" style={{ display: 'inline-block', minWidth: '2ch', textAlign: 'right' }}>
            {cutShown ?? plan.cuts.length}
          </span>
          {' '}· {t('КИМ')} {kim}%
        </span>
      </figcaption>
    </figure>
  )
}
