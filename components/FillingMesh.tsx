'use client'

import { useState } from 'react'
import { Html } from '@react-three/drei'
import { fillingGlyph } from '@/lib/f07FillingVisual'
import type { HardwarePlacement } from '@/src/core/index'

/** Lightweight symbols for purchased mechanisms, contained inside the core placement box. */
export function FillingMesh({ placement }: { placement: HardwarePlacement }) {
  const [showLabel, setShowLabel] = useState(false)
  const size = placement.size
  if (!size) return null
  const glyph = fillingGlyph(placement.hardwareId)
  const width = size.x * 0.76
  const depth = size.z * 0.65
  const bar = Math.max(4, Math.min(size.x, size.y, size.z) * 0.035)
  const metal = <meshStandardMaterial color={placement.color ?? '#758394'} roughness={0.38} metalness={0.6} />
  const beam = (key: string, x: number, y: number, z: number, xSize: number, ySize: number, zSize: number) =>
    <mesh key={key} position={[x, y, z]}><boxGeometry args={[xSize, ySize, zSize]} />{metal}</mesh>

  return <group position={[placement.position.x, placement.position.y, placement.position.z]}
    onPointerOver={(event) => { event.stopPropagation(); setShowLabel(true) }}
    onPointerOut={() => setShowLabel(false)}
    onClick={(event) => { event.stopPropagation(); setShowLabel((value) => !value) }}>
    {glyph === 'hanger' && <>
      {beam('track', 0, size.y * 0.18, 0, bar, bar, depth)}
      {beam('cross', 0, -size.y * 0.18, depth * 0.35, width * 0.64, bar, bar)}
      {beam('stem', 0, 0, depth * 0.35, bar, size.y * 0.36, bar)}
    </>}
    {glyph === 'trousers' && Array.from({ length: 5 }, (_, i) =>
      beam(`trouser-${i}`, 0, -size.y * 0.1, (i - 2) * depth / 5, width, bar, bar))}
    {glyph === 'pantograph' && <>
      {beam('liftbar', 0, -size.y * 0.25, 0, width, bar, bar)}
      {beam('left-arm', -width * 0.42, 0, 0, bar, size.y * 0.55, bar)}
      {beam('right-arm', width * 0.42, 0, 0, bar, size.y * 0.55, bar)}
    </>}
    {glyph === 'rotary' && <>
      <mesh><cylinderGeometry args={[width * 0.36, width * 0.36, bar, 24]} />{metal}</mesh>
      <mesh position={[0, -size.y * 0.3, 0]}><cylinderGeometry args={[width * 0.36, width * 0.36, bar, 24]} />{metal}</mesh>
      {beam('shaft', 0, -size.y * 0.15, 0, bar, size.y * 0.4, bar)}
    </>}
    {glyph === 'rail' && <>
      {beam('profile', 0, 0, 0, width, bar, bar)}
      {beam('left-fix', -width * 0.44, 0, 0, bar * 2, bar * 3, bar * 2)}
      {beam('right-fix', width * 0.44, 0, 0, bar * 2, bar * 3, bar * 2)}
    </>}
    {glyph === 'unknown' && beam('unknown', 0, 0, 0, width, bar, depth)}
    {showLabel && <Html center position={[0, size.y * 0.42, 0]}>
      <span className="pointer-events-none whitespace-nowrap border border-neutral-400 bg-white px-2 py-1 text-xs text-neutral-900">{placement.label}</span>
    </Html>}
  </group>
}
