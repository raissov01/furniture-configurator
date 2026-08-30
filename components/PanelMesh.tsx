'use client'

/**
 * Бір панель = бір қорап. Өлшемі ГОТОВЫЙ өлшемнен алынады (3D жиналған
 * детальді көрсетеді), рез өлшемі емес — CLAUDE.md §4.3.
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { Shape } from 'three'
import { panelExtents, rotationFor } from '@/src/core/index'
import type { Axis, Panel } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'

/**
 * Панельдің түсі МАТЕРИАЛДЫҢ декорынан алынады — цех қай плитаны таңдаса,
 * 3D-де сол көрінеді. Рөл тек РЕҢКІН өзгертеді: бүйір сәл қою, сөре сәл
 * ашық — әйтпесе бір түсті шкаф жалпақ қорап болып, құрылымы оқылмайды.
 */
const ROLE_SHADE: Record<string, number> = {
  side: 0.9,
  divider: 0.86,
  top: 1.0,
  bottom: 1.0,
  shelf: 1.08,
  back: 0.78,
  front: 1.03,
}

/** Декоры жоқ материал — бейтарап сұр. */
const NEUTRAL = '#b8b4ac'

function shade(hex: string, factor: number): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) return hex
  const channels = [0, 2, 4].map((i) => {
    const n = Number.parseInt(value.slice(i, i + 2), 16)
    return Math.max(0, Math.min(255, Math.round(n * factor)))
  })
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Ажыратылған көріністе панель өз ҚАЛЫҢДЫҒЫ өсі бойымен ортадан ажырайды. */
const EXPLODE_DISTANCE = 260

export function PanelMesh({
  panel, thickness, centre, decorColor,
}: {
  panel: Panel
  thickness: number
  centre: { x: number; y: number; z: number }
  /** Панель материалының декор түсі. Болмаса — бейтарап сұр. */
  decorColor?: string | undefined
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

  /**
   * Қиғаш деталь мен көлбеу крышка — жалғыз екі жағдай, онда панель әлем
   * өстеріне тураланбайды. Ол екеуі өз ЖАЗЫҚТЫҒЫНДА салынып, панельдің өз
   * бұрылысымен қойылады; қалғаны бұрынғыдай қорап болып қала береді.
   */
  const tilted = useMemo(() => {
    const base = rotationFor(panel.orientation)
    return panel.rotation.x !== base.x || panel.rotation.y !== base.y || panel.rotation.z !== base.z
  }, [panel.rotation, panel.orientation])

  const shape = useMemo(() => {
    if (!panel.bevel) return null
    const s0 = new Shape()
    s0.moveTo(0, 0)
    s0.lineTo(panel.bevel.lengthAtStart, 0)
    s0.lineTo(panel.bevel.lengthAtEnd, panel.finishedWidth)
    s0.lineTo(0, panel.finishedWidth)
    s0.closePath()
    return s0
  }, [panel.bevel, panel.finishedWidth])

  const color = isHovered ? '#ffffff' : shade(decorColor ?? NEUTRAL, ROLE_SHADE[panel.role] ?? 1)
  const toRad = (deg: number) => (deg * Math.PI) / 180

  if (shape || tilted) {
    // Панель өз локал жазықтығында салынады: ұзындығы — x, ені — y,
    // қалыңдығы — z. Содан кейін ядро берген бұрылыспен әлемге қойылады.
    // Топ панельдің ӨЗ бұрышында тұрады, ал boxGeometry ортасынан салынады —
    // сондықтан қорап топтың ішінде жартылай ығыстырылады. Экструзия
    // пішіннің (0,0) нүктесінен басталатындықтан оған ығысу керек емес.
    return (
      <group
        position={[panel.position.x, panel.position.y, panel.position.z]}
        rotation={[toRad(panel.rotation.x), toRad(panel.rotation.y), toRad(panel.rotation.z)]}
      >
        <mesh
          position={shape ? [0, 0, 0] : [panel.finishedLength / 2, panel.finishedWidth / 2, thickness / 2]}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(panel.id)
          }}
          onPointerOut={() => setHovered(null)}
        >
          {shape ? (
            <extrudeGeometry args={[shape, { depth: thickness, bevelEnabled: false }]} />
          ) : (
            <boxGeometry args={[panel.finishedLength, panel.finishedWidth, thickness]} />
          )}
          <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
        </mesh>
      </group>
    )
  }

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
        color={color}
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
