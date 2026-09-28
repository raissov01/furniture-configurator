'use client'

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Sheet } from '@/components/brand'
import { useSiteText } from '@/components/site/SiteLanguage'
import { referenceCabinetFrame } from '@/lib/referenceCabinetFrame'
import type { CabinetFrameBox } from '@/lib/referenceCabinetFrame'

const MM = 0.001
const oak = '#b98f60'
const back = '#c8cdd2'

/** Projection of the generated boxes for small screens and before WebGL starts. */
function CabinetDrawing({ boxes }: { boxes: CabinetFrameBox[] }) {
  const { tr } = useSiteText()
  const point = (x: number, y: number, z: number) => `${240 + (x - z) * 0.4},${325 - y * 0.13 + (x + z) * 0.13}`
  const face = (vertices: [number, number, number][]) => vertices.map(([x, y, z]) => point(x, y, z)).join(' ')
  const ordered = [...boxes].sort((a, b) => b.position.z - a.position.z)
  return <svg viewBox="0 0 540 450" className="block h-auto w-full lg:hidden" role="img"
    aria-label={tr('Эталонный шкаф: 2000 (H) × 600 (W) × 450 (D)')}>
    {ordered.map((box) => {
      const { x, y, z } = box.position
      const x1 = x + box.size.x, y1 = y + box.size.y, z1 = z + box.size.z
      const color = box.role === 'back' ? back : oak
      return <g key={box.id} stroke="#5e4936" strokeWidth={1} strokeLinejoin="miter">
        <polygon points={face([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]])} fill="#d5b58d" />
        <polygon points={face([[x1, y, z], [x1, y, z1], [x1, y1, z1], [x1, y1, z]])} fill="#9e7448" />
        <polygon points={face([[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]])} fill={color} />
      </g>
    })}
  </svg>
}

export default function ReferenceCabinetFigure() {
  const { tr } = useSiteText()
  const frame = useMemo(referenceCabinetFrame, [])
  const [desktop, setDesktop] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setDesktop(wide.matches); setReducedMotion(reduced.matches) }
    update()
    wide.addEventListener('change', update)
    reduced.addEventListener('change', update)
    return () => { wide.removeEventListener('change', update); reduced.removeEventListener('change', update) }
  }, [])

  return <Sheet className="overflow-hidden p-3" caption={tr('Эталонный шкаф')}>
    <CabinetDrawing boxes={frame.boxes} />
    {desktop ? <div className="hidden h-[420px] w-full lg:block" aria-label={tr('Эталонный шкаф: 2000 (H) × 600 (W) × 450 (D)')}>
      <Canvas orthographic frameloop="demand" camera={{ position: [2.5, 2.5, -3.6], zoom: 145, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0.3, 1, 0.22)}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, -4]} intensity={2.4} />
        {frame.boxes.map((box) => <mesh key={box.id}
          position={[(box.position.x + box.size.x / 2) * MM, (box.position.y + box.size.y / 2) * MM,
            (box.position.z + box.size.z / 2) * MM]}>
          <boxGeometry args={[box.size.x * MM, box.size.y * MM, box.size.z * MM]} />
          <meshStandardMaterial color={box.role === 'back' ? back : oak} roughness={0.85} />
        </mesh>)}
        {!reducedMotion ? <OrbitControls target={[0.3, 1, 0.22]} enablePan={false} enableZoom={false} /> : null}
      </Canvas>
    </div> : null}
    <p className="mt-2 text-xs text-[var(--ink-soft)]">{frame.dimensions.height} (H) × {frame.dimensions.width} (W) × {frame.dimensions.depth} (D)</p>
  </Sheet>
}
