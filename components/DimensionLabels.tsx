'use client'

/** Габарит белгілері. Рет ӘРҚАШАН H × W × D, әр санның қасында әрпі. */

import { Html } from '@react-three/drei'
import type { CabinetConfig } from '@/src/core/index'

function Label({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Html position={position} center zIndexRange={[5, 0]}>
      <div className="pointer-events-none whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-900 shadow ring-1 ring-neutral-300">
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
      <Label position={[W / 2, -70, 0]} text={`${W} (W)`} />
      <Label position={[W + 70, 0, D / 2]} text={`${D} (D)`} />
    </>
  )
}
