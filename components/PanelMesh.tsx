'use client'

/**
 * Бір панель = бір қорап. Өлшемі ГОТОВЫЙ өлшемнен алынады (3D жиналған
 * детальді көрсетеді), рез өлшемі емес — CLAUDE.md §4.3.
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { panelExtents } from '@/src/core/index'
import type { Axis, Panel } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

/** Рөл бойынша түс — материал текстурасы емес, оқылатын схема. */
const COLORS: Record<string, string> = {
  side: '#c9a227',
  top: '#d9b642',
  bottom: '#d9b642',
  shelf: '#e3c76a',
  divider: '#bd9520',
  back: '#8a6f3a',
  front: '#a8791f',
}

/** Ажыратылған көріністе панель өз ҚАЛЫҢДЫҒЫ өсі бойымен ортадан ажырайды. */
const EXPLODE_DISTANCE = 260

export function PanelMesh({
  panel, thickness, centre,
}: {
  panel: Panel
  thickness: number
  centre: { x: number; y: number; z: number }
}) {
  const exploded = useConfigurator((s) => s.exploded)
  const hovered = useConfigurator((s) => s.hovered)
  const setHovered = useConfigurator((s) => s.setHovered)

  const extents = useMemo(() => panelExtents(panel, thickness), [panel, thickness])

  const position = useMemo(() => {
    const base = {
      x: panel.position.x + extents.x / 2,
      y: panel.position.y + extents.y / 2,
      z: panel.position.z + extents.z / 2,
    }
    if (exploded > 0) {
      const axis: Axis = panel.orientation.thickness
      const delta = base[axis] - centre[axis]
      const direction = delta === 0 ? 1 : Math.sign(delta)
      base[axis] += direction * exploded * EXPLODE_DISTANCE
    }
    return base
  }, [panel, extents, exploded, centre])

  const isHovered = hovered === panel.id

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(panel.id)
      }}
      onPointerOut={() => setHovered(null)}
    >
      <boxGeometry args={[extents.x, extents.y, extents.z]} />
      <meshStandardMaterial
        color={isHovered ? '#ffffff' : (COLORS[panel.role] ?? '#bbbbbb')}
        roughness={0.7}
        metalness={0}
      />
      {isHovered ? (
        <Html center zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-neutral-900/90 px-2 py-1 text-[11px] text-white shadow">
            <b>{panel.label}</b>
            <span className="mx-1.5 opacity-50">·</span>
            готовый {panel.finishedLength}×{panel.finishedWidth}
            <span className="mx-1.5 opacity-50">·</span>
            <span className="text-amber-300">рез {panel.cutLength}×{panel.cutWidth}</span>
          </div>
        </Html>
      ) : null}
    </mesh>
  )
}
