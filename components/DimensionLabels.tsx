'use client'

/** Габарит белгілері. Рет ӘРҚАШАН H × W × D, әр санның қасында әрпі. */

import { Html } from '@react-three/drei'
import type { CabinetConfig } from '@/src/core/index'

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
  return (
    <>
      <Label position={[-90, H / 2, 0]} text={`${H} (H)`} />
      <Label position={[W / 2, H + 80, 0]} text={`${W} (W)`} />
      <Label position={[W + 70, H / 3, D / 2]} text={`${D} (D)`} />
    </>
  )
}
