'use client'

/**
 * Лендингтегі деталировка кестесі.
 *
 * Қозғалыс мағына тасиды: кесте экранға кіргенде «Рез · цех» бағанында
 * алдымен ГОТОВЫЙ өлшем тұрады, сосын жол-жолымен кромка шегерілген РЕЗ
 * өлшеміне ауысады (2194 → 2190). Өзгерген сан амбер-қоңыр түспен қалады —
 * қозғалыссыз да қай жерде кромка шегерілгені көрінеді.
 */

import { useEffect, useRef, useState } from 'react'
import type { CutListRow } from '@/src/core/index'
import { useSiteText } from '@/components/site/SiteLanguage'
import { belowFold, motionAllowed, observeOnce } from '@/components/site/motion'

const ROW_STEP = 110

function CutCell({ from, to, phase }: { from: number; to: number; phase: 'final' | 'pending' | 'ticked' }) {
  const changed = from !== to
  if (!changed) return <>{to}</>
  if (phase === 'pending') return <span className="cut-pending inline-block">{from}</span>
  return <span className={`cut-changed inline-block ${phase === 'ticked' ? 'cut-tick' : ''}`}>{to}</span>
}

export function DetailTable({ rows }: { rows: CutListRow[] }) {
  const { tr } = useSiteText()
  const ref = useRef<HTMLElement>(null)
  /** Неше жол «рез» өлшеміне ауысты; `null` — қозғалыс жоқ, бәрі соңғы күйде. */
  const [switched, setSwitched] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !motionAllowed() || !belowFold(el)) return
    setSwitched(0)
    const timers: number[] = []
    const stop = observeOnce(el, () => {
      rows.forEach((_, i) => {
        timers.push(window.setTimeout(() => setSwitched(i + 1), 350 + i * ROW_STEP))
      })
    }, 0.45)
    return () => { stop(); timers.forEach((id) => window.clearTimeout(id)) }
  }, [rows])

  const phaseOf = (i: number) => switched === null ? 'final' : i < switched ? 'ticked' : 'pending'

  return (
    <figure ref={ref} className="sheet overflow-hidden">
      <figcaption
        className="border-b px-4 py-2 text-xs"
        style={{ borderColor: 'var(--rule)', color: 'var(--ink-soft)' }}
      >{tr('Деталировка')}</figcaption>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ color: 'var(--ink-soft)' }}>
              <th className="px-4 py-2 text-left font-normal">{tr('Наименование')}</th>
              <th className="px-2 py-2 text-right font-normal">{tr('Кол-во')}</th>
              <th className="px-2 py-2 text-right font-normal" colSpan={2}>{tr('Готовый · клиент')}</th>
              <th className="px-2 py-2 text-right font-normal" colSpan={2}>{tr('Рез · цех')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r, i) => (
              <tr key={`${r.name}-${r.finishedLength}-${r.finishedWidth}`} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                <td className="px-4 py-1.5" style={{ fontFamily: 'var(--font-body)' }}>{tr(r.name)}</td>
                <td className="px-2 py-1.5 text-right">{r.qty}</td>
                <td className="px-2 py-1.5 text-right" style={{ color: 'var(--blueprint)' }}>{r.finishedLength}</td>
                <td className="px-2 py-1.5 text-right" style={{ color: 'var(--blueprint)' }}>{r.finishedWidth}</td>
                <td className="px-2 py-1.5 text-right font-semibold"><CutCell from={r.finishedLength} to={r.cutLength} phase={phaseOf(i)} /></td>
                <td className="px-2 py-1.5 text-right font-semibold"><CutCell from={r.finishedWidth} to={r.cutWidth} phase={phaseOf(i)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-xs" style={{ borderColor: 'var(--rule)', color: 'var(--ink-soft)' }}>
        {tr('Клиент видит готовый размер, цех — рез. Разницу даёт кромка, и она посчитана, а не «примерно».')}
      </p>
    </figure>
  )
}
