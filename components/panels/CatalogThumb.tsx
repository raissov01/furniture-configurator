'use client'

/**
 * PRO100 каталогының нобай суреті — СХЕМАЛЫҚ SVG, ЕCRU/PRO100-дың дайын
 * суреттері ЕМЕС (заңды шекара, бүгін үш рет талқыланды: сурет жобаға
 * көшірілмейді). Тапсырмада екі нұсқа берілген еді — «өз 3D моделімізден»
 * не «схемалық SVG». 3D нұсқасын таңдамадым: `CabinetThumb.tsx` нақты
 * `CabinetConfig`-тен (`generateCabinet`) салынады, ал PRO100 атауынан
 * биіктік/тереңдік ЕШҚАШАН оқылмайды (pro100Catalog.ts-тегі ескерту) —
 * жоқ дерекпен жалған 3D корпус құрсақ, «шын өлшем» әсерін тудырар едік.
 * Схемалық SVG керісінше — контур ЕШҚАШАН нақты өлшем деп ұсынылмайды,
 * тек есік/ящик/мойка бар-жоғын АТАУДАН оқылған дерекпен көрсетеді.
 */
import type { ParsedCabinetInfo } from '@/src/core/data/pro100Catalog'

const W = 100
const H = 120
const STROKE = '#525252' // neutral-600 — доктың неутрал палитрасымен бірдей, түс ойдан емес

export function CatalogThumb({ parsed }: { parsed: ParsedCabinetInfo }) {
  const hasStructure = parsed.doorCount !== undefined || parsed.drawerCount !== undefined
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Шкаф нобайы (схема)">
      {/* Сыртқы контур — 1px жиек, градиент/көлеңке жоқ (флэт дизайн ережесі). */}
      <rect x={4} y={4} width={W - 8} height={H - 8} fill="none" stroke={STROKE} strokeWidth={1.5} />

      {parsed.doorCount !== undefined && parsed.doorCount > 0
        ? doorLines(parsed.doorCount)
        : null}

      {parsed.drawerCount !== undefined && parsed.doorCount === undefined
        ? drawerLines(parsed.drawerCount)
        : null}

      {parsed.hasSink ? (
        <ellipse cx={W / 2} cy={H / 2} rx={18} ry={10} fill="none" stroke={STROKE} strokeWidth={1.2} />
      ) : null}

      {!hasStructure && !parsed.hasSink ? (
        <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize={14} fill={STROKE} opacity={0.5}>
          ?
        </text>
      ) : null}

      {parsed.position ? (
        <text x={8} y={16} fontSize={9} fill={STROKE} fontWeight={700}>
          {POSITION_BADGE[parsed.position]}
        </text>
      ) : null}
    </svg>
  )
}

const POSITION_BADGE: Record<'lower' | 'upper' | 'combined', string> = {
  lower: 'Н',
  upper: 'В',
  combined: 'НВ',
}

/** Есіктерді тең бөлікке бөлетін ІШКІ сызықтар (N есік → N−1 сызық) + тұтқа белгісі. */
function doorLines(count: number) {
  const inset = 4
  const innerW = W - inset * 2
  const lines = []
  for (let i = 1; i < count; i++) {
    const x = inset + (innerW / count) * i
    lines.push(<line key={`d${i}`} x1={x} y1={inset} x2={x} y2={H - inset} stroke={STROKE} strokeWidth={1} />)
  }
  // Тұтқа белгісі — әр есіктің жоғарғы жиегінде, ауыспалы жақта.
  for (let i = 0; i < count; i++) {
    const doorLeft = inset + (innerW / count) * i
    const doorRight = inset + (innerW / count) * (i + 1)
    const x = i % 2 === 0 ? doorRight - 6 : doorLeft + 6
    lines.push(<line key={`h${i}`} x1={x} y1={inset + 4} x2={x} y2={inset + 14} stroke={STROKE} strokeWidth={2} />)
  }
  return lines
}

/** Ящик саны — көлденең сызықтармен қабатталған. */
function drawerLines(count: number) {
  const inset = 4
  const innerH = H - inset * 2
  const lines = []
  for (let i = 1; i < count; i++) {
    const y = inset + (innerH / count) * i
    lines.push(<line key={`w${i}`} x1={inset} y1={y} x2={W - inset} y2={y} stroke={STROKE} strokeWidth={1} />)
  }
  for (let i = 0; i < count; i++) {
    const y = inset + (innerH / count) * (i + 0.5)
    lines.push(<line key={`hw${i}`} x1={W / 2 - 8} y1={y} x2={W / 2 + 8} y2={y} stroke={STROKE} strokeWidth={2} />)
  }
  return lines
}
