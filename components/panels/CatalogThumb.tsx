'use client'

import type { ParsedCabinetInfo } from '@/src/core/data/pro100Catalog'
import { catalogThumbGeometry } from './catalogThumbGeometry'

/** Isometric placeholder for PRO100 labels without a verified BASIS analogue. */
export function CatalogThumb({ parsed }: { parsed: ParsedCabinetInfo }) {
  const shape = catalogThumbGeometry(parsed)
  return <svg viewBox="0 0 100 120" className="h-full w-full" role="img" aria-label="Шкаф нобайы (схема)">
    <path d={shape.top} fill="#525252" stroke="#a3a3a3" strokeWidth="1" />
    <path d={shape.side} fill="#303030" stroke="#a3a3a3" strokeWidth="1" />
    <rect {...shape.front} fill="#404040" stroke="#a3a3a3" strokeWidth="1" />
    {shape.frontDividers.map((line, index) => <line key={`d${index}`} {...line} stroke="#a3a3a3" strokeWidth="1" />)}
    {shape.handles.map((line, index) => <line key={`h${index}`} {...line} stroke="#d4d4d4" strokeWidth="2" />)}
    {parsed.hasSink ? <ellipse cx="42" cy={shape.front.y + shape.front.height / 2} rx="13" ry="7" fill="none" stroke="#a3a3a3" /> : null}
  </svg>
}
