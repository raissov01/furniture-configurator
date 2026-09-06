'use client'

/**
 * Бір панель = бір қорап. Өлшемі ГОТОВЫЙ өлшемнен алынады (3D жиналған
 * детальді көрсетеді), рез өлшемі емес — CLAUDE.md §4.3.
 */

import { useMemo } from 'react'
import { t as tr } from '@/lib/i18n'
import { Edges, Html } from '@react-three/drei'
import { grainTexture } from '@/lib/grainTexture'
import { Path, Shape } from 'three'
import { cutOrigin, cutoutBounds, isWidthBevel, mergeSettings, panelExtents, rotationFor } from '@/src/core/index'
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
  // Сегменттерді БЕДЕР (жіңішке молдинг) ретінде: әрқайсысы — жұқа бокс.
  // Жалпақ сызық емес, көлемді — жарық пен көлеңке оны ойылғандай көрсетеді.
  const segments = useMemo(() => {
    if (panel.milling.length === 0) return []
    const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
    const origin = cutOrigin(panel, bands, mergeSettings(settings))
    const out: { x: number; y: number; len: number; angle: number }[] = []
    for (const path of panel.milling) {
      const pts = path.points
      const last = path.closed ? pts.length : pts.length - 1
      for (let i = 0; i < last; i += 1) {
        const a = pts[i]!
        const b = pts[(i + 1) % pts.length]!
        // Фасадтың локал өстері: x — биіктік (әлемде Y), y — ені (әлемде X).
        const ax = a.y + origin.y, ay = a.x + origin.x
        const bx = b.y + origin.y, by = b.x + origin.x
        const dx = bx - ax, dy = by - ay
        const len = Math.hypot(dx, dy)
        if (len < 1) continue
        out.push({ x: (ax + bx) / 2, y: (ay + by) / 2, len, angle: Math.atan2(dy, dx) })
      }
    }
    return out
  }, [panel, catalog, settings])

  if (segments.length === 0) return null

  return (
    // Ата-мешь панельдің ОРТАСЫНДА тұр, ал жолдар панельдің БҰРЫШЫНАН
    // саналған — сондықтан жартылай габаритке кері ығысамыз. Бедер беттен
    // сәл алға шығады (молдинг әсері).
    <group position={[-extents.x / 2, -extents.y / 2, -extents.z / 2]}>
      {segments.map((seg, i) => (
        // Әр сегмент — ЕКІ ЖОЛАҚ: сыртқы КӨТЕРІЛГЕН молдинг + оның ішіндегі
        // ҚАРАҢҒЫ ОЙЫҚ (routed groove). Екеуі бірге классик рамалы фрезеровка
        // (филёнка) әсерін береді — жалғыз жалпақ жолақтан әлдеқайда нақты.
        <group key={i} position={[seg.x, seg.y, 0]} rotation={[0, 0, seg.angle]}>
          {/* Көтерілген молдинг (беттен 2 мм алға) */}
          <mesh position={[0, 0, -2]} castShadow>
            <boxGeometry args={[seg.len + 6, 7, 4]} />
            <meshStandardMaterial color="#7a6f61" roughness={0.55} metalness={0} />
          </mesh>
          {/* Ортасындағы қараңғы ойық — фрезаның жолы */}
          <mesh position={[0, 0, -0.6]}>
            <boxGeometry args={[seg.len + 2, 2.2, 2]} />
            <meshStandardMaterial color="#3b342c" roughness={0.7} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Ажыратылған көріністе панель өз ҚАЛЫҢДЫҒЫ өсі бойымен ортадан ажырайды. */
const EXPLODE_DISTANCE = 260

/**
 * Оймалардың `Path` тізімі: `Shape.holes` дәл осыны күтеді.
 * Координата панельдің ГОТОВЫЙ өлшемінде — 3D готовый өлшеммен салынады (§4.3).
 */
function cutoutHoles(panel: Panel): Path[] {
  return panel.cutouts.map((cutout) => {
    const b = cutoutBounds(cutout, panel.finishedLength, panel.finishedWidth)
    const hole = new Path()
    if (cutout.shape === 'circle') {
      hole.absarc(b.x + b.width / 2, b.y + b.height / 2, cutout.diameter / 2, 0, Math.PI * 2, false)
    } else {
      hole.moveTo(b.x, b.y)
      hole.lineTo(b.x + b.width, b.y)
      hole.lineTo(b.x + b.width, b.y + b.height)
      hole.lineTo(b.x, b.y + b.height)
      hole.closePath()
    }
    return hole
  })
}

export function PanelMesh({
  panel, thickness, centre, decorColor, catalog, settings, pid, cabinetId,
}: {
  panel: Panel
  thickness: number
  /**
   * Детальдің ЖОБА ІШІНДЕГІ кілті (`projectPanelId`). Бір жобада екі шкаф
   * болса, екеуінде де `side-left` бар — сондықтан бөлектеу мен «Жоба»
   * терезесіндегі жол осы кілт арқылы табысады. Берілмесе — панельдің өз id-і.
   */
  pid?: string | undefined
  /** Осы панель ҚАЙ корпустікі — 3D-де басқанда сол корпус белсенді болады. */
  cabinetId?: string | undefined
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
  const selected = useConfigurator((s) => s.selected)
  const setSelected = useConfigurator((s) => s.setSelected)
  const setActive = useConfigurator((s) => s.setActive)
  const key = pid ?? panel.id
  // Тақта түйіршігі — түске көбейтіледі, реалистік бет үшін.
  const grain = grainTexture()


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

  const isHovered = hovered === key
  /** Таңдалған деталь тінтуір кеткенде де БӨЛЕКТЕЛІП тұрады. */
  const isSelected = selected === key
  /*
   * Мөлдір режимдер. `ghost` — ішін көру үшін жартылай мөлдір, `wire` — тек
   * әрең көрінетін сұлба. Тінтуір астындағы панель ӘРҚАШАН тұтас қалады:
   * әйтпесе мөлдір режимде нені меңзеп тұрғаның білінбейді.
   */
  const opacity = viewMode === 'solid' || isHovered || isSelected ? 1 : viewMode === 'ghost' ? 0.28 : 0.06

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
    /*
     * Ойма бар панель де ЖАЗЫҚТЫҚТА салынады: қораптың геометриясында тесік
     * болмайды, ал экранда ойма көрінбесе, оны байқамай қалуға болады —
     * қателіктің ең қымбат түрі дәл сол.
     */
    const rounded = panel.corners && Object.values(panel.corners).some((r) => r > 0)
    if (!panel.bevel && panel.cutouts.length === 0 && !rounded) return null
    if (!panel.bevel) {
      const L = panel.finishedLength
      const Wd = panel.finishedWidth
      const flat = new Shape()
      if (rounded && panel.corners) {
        // Дөңгелектелген бұрыш: түзу — доға — түзу. Радиус детальдің
        // жартысынан аспайды (ядрода тексеріледі).
        const cap = Math.min(L, Wd) / 2
        const r = {
          bl: Math.min(panel.corners.bottomLeft, cap),
          br: Math.min(panel.corners.bottomRight, cap),
          tr: Math.min(panel.corners.topRight, cap),
          tl: Math.min(panel.corners.topLeft, cap),
        }
        flat.moveTo(r.bl, 0)
        flat.lineTo(L - r.br, 0)
        if (r.br > 0) flat.absarc(L - r.br, r.br, r.br, -Math.PI / 2, 0, false)
        flat.lineTo(L, Wd - r.tr)
        if (r.tr > 0) flat.absarc(L - r.tr, Wd - r.tr, r.tr, 0, Math.PI / 2, false)
        flat.lineTo(r.tl, Wd)
        if (r.tl > 0) flat.absarc(r.tl, Wd - r.tl, r.tl, Math.PI / 2, Math.PI, false)
        flat.lineTo(0, r.bl)
        if (r.bl > 0) flat.absarc(r.bl, r.bl, r.bl, Math.PI, Math.PI * 1.5, false)
      } else {
        flat.moveTo(0, 0)
        flat.lineTo(L, 0)
        flat.lineTo(L, Wd)
        flat.lineTo(0, Wd)
      }
      flat.closePath()
      flat.holes = cutoutHoles(panel)
      return flat
    }
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
      s0.holes = cutoutHoles(panel)
      return s0
    }
    s0.moveTo(0, 0)
    s0.lineTo(panel.bevel.lengthAtStart, 0)
    s0.lineTo(panel.bevel.lengthAtEnd, panel.finishedWidth)
    s0.lineTo(0, panel.finishedWidth)
    s0.closePath()
    s0.holes = cutoutHoles(panel)
    return s0
  }, [panel.bevel, panel.finishedWidth, panel.finishedLength, panel.cutouts, panel.corners])

  const color = isHovered ? '#ffffff' : shade(decorColor ?? NEUTRAL, ROLE_SHADE[panel.role] ?? 1)
  /*
   * Таңдалғанын ТҮСПЕН көрсетуге болмайды: декордың өзі сары (дуб, бук) —
   * бөлектеу онда жоғалады. Сондықтан таңдалған детальдің ҚЫРЫ сызылады, ол
   * кез келген декордың үстінен көрінеді.
   */
  const outline = isSelected ? <Edges color="#f2c14e" lineWidth={2.5} /> : null
  // Шыны фасад: мөлдір әйнек + әрқашан көрінетін ЖИЕК (рама). Тұтас панельдей
  // емес, ішін көрсетеді — qdesign-дегі шыны есіктер сияқты.
  const isGlass = panel.glass === true
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
          castShadow
          receiveShadow
          position={shape ? [0, 0, 0] : [panel.finishedLength / 2, panel.finishedWidth / 2, thickness / 2]}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(key)
          }}
          onPointerOut={() => setHovered(null)}
          onClick={(e) => {
            e.stopPropagation()
            // Екінші рет басу таңдауды АЛАДЫ: бөлектеу қалып қоймауы керек.
            setSelected(isSelected ? null : key)
        if (cabinetId) setActive(cabinetId)
            if (cabinetId) setActive(cabinetId)
          }}
        >
          {shape ? (
            <extrudeGeometry args={[shape, { depth: thickness, bevelEnabled: false }]} />
          ) : (
            <boxGeometry args={[panel.finishedLength, panel.finishedWidth, thickness]} />
          )}
          <meshStandardMaterial
            color={color} map={grain} roughness={0.7} metalness={0}
            transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
          />
          {outline}
        </mesh>
      </group>
    )
  }

  return (
    <mesh
      castShadow
      receiveShadow
      position={[position.x, position.y, position.z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(key)
      }}
      onPointerOut={() => setHovered(null)}
      onClick={(e) => {
        e.stopPropagation()
        setSelected(isSelected ? null : key)
      }}
    >
      <boxGeometry args={[extents.x, extents.y, extents.z]} />
      {isGlass ? (
        <meshStandardMaterial
          color="#bcd3dc"
          roughness={0.08}
          metalness={0.1}
          transparent
          opacity={0.28 * (opacity === 1 ? 1 : opacity)}
          depthWrite={false}
        />
      ) : (
        <meshStandardMaterial
          color={color}
          map={grain}
          roughness={0.7}
          metalness={0}
          transparent={opacity < 1}
          opacity={opacity}
          // Мөлдір панель артындағыны жауып қалмауы үшін тереңдікке жазбайды.
          depthWrite={opacity === 1}
        />
      )}
      {/* Шыны есіктің рамасы әрқашан көрінеді. */}
      {isGlass ? <Edges color="#5b5147" lineWidth={2} /> : null}
      {outline}
      {panel.role === 'front' && panel.milling.length > 0 ? (
        <MillingLines panel={panel} catalog={catalog} settings={settings} extents={extents} />
      ) : null}
      {isHovered || isSelected ? (
        <Html center zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-neutral-900/90 px-2 py-1 text-[11px] text-white shadow">
            <b>{panel.label}</b>
            <span className="mx-1.5 opacity-50">·</span>
            готовый {panel.finishedLength}×{panel.finishedWidth}
            <span className="mx-1.5 opacity-50">·</span>
            <span className="text-amber-300">{tr('рез')} {panel.cutLength}×{panel.cutWidth}</span>
          </div>
        </Html>
      ) : null}
    </mesh>
  )
}
