'use client'

/**
 * Бір панель = бір қорап. Өлшемі ГОТОВЫЙ өлшемнен алынады (3D жиналған
 * детальді көрсетеді), рез өлшемі емес — CLAUDE.md §4.3.
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Shape } from 'three'
import { cutOrigin, isWidthBevel, mergeSettings, panelExtents, rotationFor } from '@/src/core/index'
import type { Axis, Catalog, Panel, SettingsOverride } from '@/src/core/index'
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

/**
 * Фасадтың беттік өрнегі.
 *
 * Ядро жолдарды РЕЗ кеңістігінде сақтайды (станок соны көреді), ал 3D
 * ЖИНАЛҒАН детальді көрсетеді — сондықтан `cutOrigin` ығысуы қосылады.
 *
 * Өрнек фасадтың СЫРТҚЫ бетінде, яғни ең кіші z-те. Сызық беттің дәл үстінде
 * тұрса z-fighting шығады, сол үшін бір миллиметрге алға шығарылады.
 */
function MillingLines({ panel, catalog, settings, extents }: {
  panel: Panel
  catalog: Catalog
  settings: SettingsOverride | undefined
  /** Панельдің әлем өстеріндегі габариті — жергілікті нөлді табу үшін. */
  extents: { x: number; y: number; z: number }
}) {
  const geometry = useMemo(() => {
    if (panel.milling.length === 0) return null
    const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
    const origin = cutOrigin(panel, bands, mergeSettings(settings))

    const vertices: number[] = []
    for (const path of panel.milling) {
      const pts = path.points
      const last = path.closed ? pts.length : pts.length - 1
      for (let i = 0; i < last; i += 1) {
        const a = pts[i]!
        const b = pts[(i + 1) % pts.length]!
        // Фасадтың локал өстері: x — биіктік (әлемде Y), y — ені (әлемде X).
        vertices.push(a.y + origin.y, a.x + origin.x, 0)
        vertices.push(b.y + origin.y, b.x + origin.x, 0)
      }
    }
    if (vertices.length === 0) return null
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    return g
  }, [panel, catalog, settings])

  if (!geometry) return null

  return (
    // Ата-мешь панельдің ОРТАСЫНДА тұр, ал жолдар панельдің БҰРЫШЫНАН
    // саналған — сондықтан жартылай габаритке кері ығысамыз. z бойынша
    // сыртқы бетке шығып, беттен 1 мм алға: әйтпесе z-fighting болады.
    <lineSegments
      geometry={geometry}
      position={[-extents.x / 2, -extents.y / 2, -extents.z / 2 - 1]}
    >
      <lineBasicMaterial color="#5a5148" transparent opacity={0.85} />
    </lineSegments>
  )
}

/** Ажыратылған көріністе панель өз ҚАЛЫҢДЫҒЫ өсі бойымен ортадан ажырайды. */
const EXPLODE_DISTANCE = 260

export function PanelMesh({
  panel, thickness, centre, decorColor, catalog, settings,
}: {
  panel: Panel
  thickness: number
  /** Өрнекті салу үшін керек: кромка қалыңдығы РЕЗ ығысуын береді. */
  catalog: Catalog
  settings?: SettingsOverride | undefined
  centre: { x: number; y: number; z: number }
  /** Панель материалының декор түсі. Болмаса — бейтарап сұр. */
  decorColor?: string | undefined
}) {
  const exploded = useConfigurator((s) => s.exploded)
  const hovered = useConfigurator((s) => s.hovered)
  const setHovered = useConfigurator((s) => s.setHovered)
  const viewMode = useConfigurator((s) => s.viewMode)


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
  /*
   * Мөлдір режимдер. `ghost` — ішін көру үшін жартылай мөлдір, `wire` — тек
   * әрең көрінетін сұлба. Тінтуір астындағы панель ӘРҚАШАН тұтас қалады:
   * әйтпесе мөлдір режимде нені меңзеп тұрғаның білінбейді.
   */
  const opacity = viewMode === 'solid' || isHovered ? 1 : viewMode === 'ghost' ? 0.28 : 0.06

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
    if (isWidthBevel(panel.bevel)) {
      // Ен ұзындық бойымен өзгереді; `alignWidth` қай жиекке тірелетінін айтады.
      const { widthAtStart: w0, widthAtEnd: w1, alignWidth } = panel.bevel
      const Wd = panel.finishedWidth
      const L = panel.finishedLength
      if (alignWidth === 'end') {
        s0.moveTo(0, Wd - w0)
        s0.lineTo(L, Wd - w1)
        s0.lineTo(L, Wd)
        s0.lineTo(0, Wd)
      } else {
        s0.moveTo(0, 0)
        s0.lineTo(L, 0)
        s0.lineTo(L, w1)
        s0.lineTo(0, w0)
      }
      s0.closePath()
      return s0
    }
    s0.moveTo(0, 0)
    s0.lineTo(panel.bevel.lengthAtStart, 0)
    s0.lineTo(panel.bevel.lengthAtEnd, panel.finishedWidth)
    s0.lineTo(0, panel.finishedWidth)
    s0.closePath()
    return s0
  }, [panel.bevel, panel.finishedWidth, panel.finishedLength])

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
          <meshStandardMaterial
            color={color} roughness={0.7} metalness={0}
            transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
          />
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
        transparent={opacity < 1}
        opacity={opacity}
        // Мөлдір панель артындағыны жауып қалмауы үшін тереңдікке жазбайды.
        depthWrite={opacity === 1}
      />
      {panel.role === 'front' && panel.milling.length > 0 ? (
        <MillingLines panel={panel} catalog={catalog} settings={settings} extents={extents} />
      ) : null}
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
