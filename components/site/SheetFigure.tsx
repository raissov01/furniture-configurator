/**
 * Раскрой парағының суреті. Бұл — ЛЕНДИНГТІҢ БАСТЫ ОЙЫ: сурет қолмен
 * салынбаған, оны конфигуратордағы дәл сол `nestPanels()` есептеген.
 * Сондықтан беттегі сурет өнімнің шын мүмкіндігінен ешқашан алшақтамайды.
 */

import type { NestedSheet } from '@/src/core/index'
import { t as tr } from '@/lib/i18n'

export function SheetFigure({
  sheet, materialName, waste, compact = false,
}: {
  sheet: NestedSheet
  materialName: string
  waste: number
  compact?: boolean
}) {
  return (
    <figure className="sheet p-3">
      <svg
        viewBox={`-30 -30 ${sheet.sheetWidth + 60} ${sheet.sheetHeight + 60}`}
        className="w-full"
        role="img"
        aria-label={`${tr('Карта раскроя')}: ${materialName}, ${tr('лист')} ${sheet.index}`}
      >
        <rect x={0} y={0} width={sheet.sheetWidth} height={sheet.sheetHeight}
          fill="none" stroke="var(--ink)" strokeWidth={6} />
        <rect
          x={sheet.usable.x} y={sheet.usable.y}
          width={sheet.usable.width} height={sheet.usable.height}
          fill="none" stroke="var(--rule)" strokeWidth={4} strokeDasharray="24 16"
        />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.width} height={o.height}
            fill="var(--blueprint)" fillOpacity={0.06} stroke="var(--blueprint)"
            strokeOpacity={0.35} strokeWidth={3} />
        ))}
        {sheet.parts.map((p) => (
          <g key={p.panelId}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height}
              fill="var(--oak)" fillOpacity={0.85} stroke="var(--oak-deep)" strokeWidth={5} />
            {compact ? null : (
              <>
                <text
                  x={p.x + p.width / 2} y={p.y + p.height / 2 - 14}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={46} fill="#3f3108"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {tr(p.label)}
                </text>
                <text
                  x={p.x + p.width / 2} y={p.y + p.height / 2 + 34}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={38} fill="#6b551a"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {p.width}×{p.height}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <figcaption
        className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px]"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
      >
        <span>{materialName} · {tr('лист')} {sheet.index} · {sheet.sheetWidth}×{sheet.sheetHeight}</span>
        <span>{tr('деталей')} {sheet.parts.length} · {tr('отход')} {waste.toFixed(1)}%</span>
      </figcaption>
    </figure>
  )
}
