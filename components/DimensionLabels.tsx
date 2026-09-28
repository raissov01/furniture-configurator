'use client'

/** Габарит белгілері. Рет ӘРҚАШАН H × W × D, әр санның қасында әрпі. */

import { Html } from '@react-three/drei'
import type { CabinetConfig } from '@/src/core/index'
import { dimensionLabelPositions } from '@/lib/dimensionLabelPlacement'

function Label({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Html position={position} center zIndexRange={[100, 100]}>
      <div data-dimension-label className="pointer-events-none whitespace-nowrap border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-900">
        {text}
      </div>
    </Html>
  )
}

export function DimensionLabels({ cabinet }: { cabinet: CabinetConfig }) {
  const { height: H, width: W, depth: D } = cabinet
  const positions = dimensionLabelPositions(H, W, D)
  return (
    <>
      <Label position={positions.height} text={`${H} (H)`} />
      <Label position={positions.width} text={`${W} (W)`} />
      <Label position={positions.depth} text={`${D} (D)`} />
    </>
  )
}
