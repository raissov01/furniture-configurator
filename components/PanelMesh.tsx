'use client'

/**
 * Бір панель = бір қорап. Өлшемі ГОТОВЫЙ өлшемнен алынады (3D жиналған
 * детальді көрсетеді), рез өлшемі емес — CLAUDE.md §4.3.
 */

import { useEffect, useMemo } from 'react'
import { t as tr } from '@/lib/i18n'
import { Edges, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { grainTexture } from '@/lib/grainTexture'
import { boxGrainUAxis, decorTexture, grainRotation, normalTexture, type GrainUVAxis } from '@/lib/decorTexture'
import { materialRenderKey, resolveMaterialLook } from '@/lib/materialLook'
import { BoxGeometry, EdgesGeometry, LineBasicMaterial, Path, Shape } from 'three'
import { cutOrigin, cutoutBounds, isWidthBevel, mergeSettings, panelExtents, rotationFor } from '@/src/core/index'
import type { Axis, Catalog, EdgeBand, Panel, PanelHandle, SettingsOverride } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { drillToLocalMarker } from '@/lib/drillGeometry'
import { DrillMarkers } from '@/components/DrillMarkers'
import { FittingMeshes } from '@/components/FittingMeshes'
import { fittingsForPanel } from '@/lib/fittingGeometry'
import type { RenderedDrillMarker } from '@/components/DrillMarkers'

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

/**
 * Басу мен сүйреудің шегі, px. Курсор басқан жерінен осыдан көп жылжыса,
 * бұл — камераны айналдыру не модульді жылжыту, детальді таңдау емес.
 */
const CLICK_SLOP = 6

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

/*
 * ТҰТҚАНЫҢ КӨРІНІСІ. Мұндағы сандар — тек 3D (скобаның жуандығы, аяғының
 * биіктігі): олар деталировкаға да, присадкаға да тимейді. Орны мен аралығы
 * ядродан (`panel.handle`), сондықтан тұтқа тесіктің дәл үстінде тұрады.
 */
const HANDLE_STEEL = '#c3c8ce'
const HANDLE_GOLA = '#8d949b'
const HANDLE_WOOD = '#8a5a34'
const HANDLE_RECESS = '#3a3f44'

function Metal({ color = HANDLE_STEEL }: { color?: string }) {
  // Металдық мен кедір-бұдыр ОРТАША: қоршаған орта картасы жоқ сахнада толық
  // металл қап-қара болып көрінеді.
  return <meshStandardMaterial color={color} roughness={0.3} metalness={0.55} />
}

/**
 * Тұтқа — фасад мешінің БАЛАСЫ: есікпен бірге ашылады, ящикпен бірге
 * шығады, ажыратылған көріністе фасадпен бірге жылжиды.
 *
 * Мештің нөлі — панельдің ОРТАСЫ, ал ядроның координатасы фасадтың
 * сол-төмен бұрышынан. Фасадтың сыртқы беті — ең кіші z (бөлмеге қарайды).
 */
function HandleMesh({ handle, extents }: { handle: PanelHandle; extents: { x: number; y: number; z: number } }) {
  const face = -extents.z / 2
  const x = -extents.x / 2 + handle.across
  const y = -extents.y / 2 + handle.along
  const horizontal = handle.direction === 'across'
  /** Тұтқа бойымен `d` мм ығысу. */
  const along = (d: number): [number, number] => (horizontal ? [d, 0] : [0, d])
  /** Цилиндр әдепкіде Y бойымен жатады: көлденең тұтқаға Z айналасында 90°. */
  const lying: [number, number, number] = horizontal ? [0, 0, Math.PI / 2] : [0, 0, 0]
  /** Беттен шығатын аяқ (−Z бағытына). */
  const outward: [number, number, number] = [Math.PI / 2, 0, 0]

  if (handle.kind === 'knob') {
    return (
      <group position={[x, y, face]}>
        <mesh position={[0, 0, -9]} rotation={outward} castShadow>
          <cylinderGeometry args={[5, 7, 18, 16]} />
          <Metal />
        </mesh>
        <mesh position={[0, 0, -26]} castShadow>
          <sphereGeometry args={[15, 24, 16]} />
          {handle.handleId.includes('wood')
            ? <meshStandardMaterial color={HANDLE_WOOD} roughness={0.6} metalness={0} />
            : <Metal />}
        </mesh>
      </group>
    )
  }

  if (handle.kind === 'profile') {
    const edge = handle.edge ?? 'top'
    // Жиектен фасадтың ІШІНЕ қараған бағыт.
    const inward: [number, number] = edge === 'top' ? [0, -1] : edge === 'bottom' ? [0, 1] : edge === 'left' ? [1, 0] : [-1, 0]
    const size = (across: number, deep: number): [number, number, number] =>
      (horizontal ? [handle.length, across, deep] : [across, handle.length, deep])
    const at = (d: number, z: number): [number, number, number] => [x + inward[0] * d, y + inward[1] * d, z]
    if (handle.handleId.includes('gola')) {
      // Гола: фасадтың СЫРТЫНДАҒЫ ойық, фасад жазықтығынан артқа кіріп тұрады.
      return (
        <mesh position={at(-16, face + 22)} castShadow>
          <boxGeometry args={size(30, 40)} />
          <Metal color={HANDLE_GOLA} />
        </mesh>
      )
    }
    if (handle.handleId.endsWith('-c')) {
      // С-тәрізді накладной профиль: жиекті орап, алға шығып тұрады.
      return (
        <mesh position={at(12, face - 6)} castShadow>
          <boxGeometry args={size(28, 12)} />
          <Metal />
        </mesh>
      )
    }
    // Врезной профиль фасадтың жиегіне кіреді, бүкіл қалыңдығын алады.
    return (
      <mesh position={at(11, 0)} castShadow>
        <boxGeometry args={size(22, extents.z + 1)} />
        <Metal />
      </mesh>
    )
  }

  const span = handle.spacing

  if (handle.kind === 'shell') {
    const len = span + 36
    return (
      <group position={[x, y, face]}>
        <mesh position={[0, 0, -5]} castShadow>
          <boxGeometry args={horizontal ? [len, 28, 10] : [28, len, 10]} />
          <Metal />
        </mesh>
        {/* Саусақ кіретін қуыс — ракушканың өзі осы. */}
        <mesh position={[horizontal ? 0 : -5, horizontal ? -5 : 0, -10.5]}>
          <boxGeometry args={horizontal ? [len - 16, 12, 1] : [12, len - 16, 1]} />
          <meshStandardMaterial color={HANDLE_RECESS} roughness={0.6} metalness={0.2} />
        </mesh>
      </group>
    )
  }

  // Скоба мен рейлинг: екі аяқ (тесіктердің үстінде) + ұстағыш.
  const rail = handle.kind === 'rail'
  const thin = handle.handleId.includes('thin')
  const flat = handle.handleId.includes('bracket')
  const square = handle.handleId.includes('square')
  const standoff = rail ? 32 : 28
  // Рейлинг аяқтарынан әр жаққа шығып тұрады, скоба аяқтарында бітеді.
  const gripLen = rail ? span + 80 : span + 14
  const gripR = rail ? (thin ? 5 : 6) : 5
  const postR = rail && !thin ? 5 : 4
  return (
    <group position={[x, y, face]}>
      {(span > 0 ? [-span / 2, span / 2] : [0]).map((d) => {
        const [px, py] = along(d)
        return (
          <mesh key={d} position={[px, py, -standoff / 2]} rotation={outward} castShadow>
            <cylinderGeometry args={[postR, postR, standoff, 12]} />
            <Metal />
          </mesh>
        )
      })}
      <mesh position={[0, 0, -standoff]} rotation={flat || square ? [0, 0, 0] : lying} castShadow>
        {flat
          ? <boxGeometry args={horizontal ? [gripLen, 14, 6] : [14, gripLen, 6]} />
          : square
            ? <boxGeometry args={horizontal ? [gripLen, 10, 10] : [10, gripLen, 10]} />
            : <cylinderGeometry args={[gripR, gripR, gripLen, 16]} />}
        <Metal />
      </mesh>
    </group>
  )
}

/** Панель жиегінің сызығы — бүкіл сахнаға БІР материал. */
const EDGE_MATERIAL = new LineBasicMaterial({ color: '#2e2b27', transparent: true, opacity: 0.7 })

/**
 * Детальдің ЖИЕГІ — CAD-тағыдай жіңішке сызық (qdesign-мен салыстырғаннан
 * кейін, 09-12). Онсыз ақ корпустар бір-біріне жабысып, бір ақ дақ болып
 * көрінеді: бүйір қай жерде бітіп, фасад қай жерде басталатыны оқылмайды.
 *
 * drei `Edges` ӘР детальға жуан сызық (Line2) жасайды — жоба 600 деталь
 * болғанда ол ауыр. Мұнда қарапайым `lineSegments` пен ортақ материал.
 */
function PanelEdges({ x, y, z }: { x: number; y: number; z: number }) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(x, y, z)
    const edges = new EdgesGeometry(box)
    box.dispose()
    return edges
  }, [x, y, z])
  useEffect(() => () => geometry.dispose(), [geometry])
  // Сызық тінтуірді ұстамайды: әйтпесе ол панельдің астындағы детальді жабады.
  return <lineSegments geometry={geometry} material={EDGE_MATERIAL} raycast={() => null} />
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
  panel, thickness, centre, decorColor, catalog, settings, pid, cabinetId, assemblyPanels,
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
  /** Бір шкафтың панельдері: бірнеше Drill операциясынан бір нақты бекіткішті таңдау үшін. */
  assemblyPanels?: Panel[] | undefined
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
  const togglePanelOpen = useConfigurator((s) => s.togglePanelOpen)
  const onPanelDoubleClick = () => {
    const classicWorkspace = document.querySelector('[data-workspace-style="classic"]')
      && window.matchMedia('(min-width: 1024px)').matches
    if (!classicWorkspace) { if (panel.opening) togglePanelOpen(key); return }
    openProperties()
  }
  const openProperties = () => {
    if (!cabinetId || typeof window === 'undefined') return
    setActive(cabinetId)
    setSelected(cabinetId)
    window.dispatchEvent(new CustomEvent('furniture:open-properties', { detail: cabinetId }))
  }
  const vr = useConfigurator((s) => s.vr)
  // Жиек сызығы «үнемді» сапада өшеді: әлсіз ноутбукке ол мыңдаған сызық.
  const quality = useConfigurator((s) => s.quality)
  // Присадка белгісі — әдепкіде ӨШІРУЛІ (store/configurator.ts), клиентке
  // көрсеткенде керек емес.
  const showDrilling = useConfigurator((s) => s.showDrilling)
  const showFittings = useConfigurator((s) => s.showFittings)
  const key = pid ?? panel.id
  const material = useMemo(
    () => catalog.materials.find((m) => m.id === panel.materialId),
    [catalog, panel.materialId],
  )
  const decor = material?.decor
  const pbr = material?.pbr
  /*
   * Тақта түйіршігі ТЕК АҒАШ декорға. Бұрын ол бәріне жабыстырылатын да,
   * ақ ЛДСП ашық ағаш болып көрінетін (qdesign-мен салыстыруда байқалды):
   * клиентке «ақ» деп сатылған корпус экранда жолақты болып тұратын.
   */
  const woodDecor = decor?.kind === 'wood'
  // Әлсіз құрылғыда (quality==='low') `finish` әрдайым 'matte'-ке құлайды:
  // `meshPhysicalMaterial`/`clearcoat` тек GPU-ы жеткілікті құрылғыда қосылады.
  const look = useMemo(
    () => resolveMaterialLook(quality === 'low' ? undefined : decor?.finish, pbr),
    [decor?.finish, pbr, quality],
  )
  // Тек екеуі ғана лак қабатын алады (§docs/visual/material.md §3) —
  // қалғаны арзанырақ `meshStandardMaterial`-де қалады.
  const usesPhysical = quality !== 'low' && (decor?.finish === 'gloss' || decor?.finish === 'stone')
  const invalidate = useThree((s) => s.invalidate)

  const extents = useMemo(() => panelExtents(panel, thickness), [panel, thickness])

  /*
   * Присадка белгісі. `lib/drillGeometry.ts` панельдің КАНОНДЫҚ локал
   * кеңістігін қайтарады (x — ұзындық, y — ен, z — қалыңдық, бұрылусыз,
   * бұрышы (0,0,0)-де) — дәл осы кеңістік ТӨМЕНДЕГІ shape/tilted тармағының
   * ӨЗ жергілікті кеңістігі, сондықтан сол жерде ТІКЕЛЕЙ қолданылады.
   * Қарапайым бокс тармағында (рендер world осіне тураланған, боксттың
   * ОРТАСЫНАН) `orientation` арқылы қайта ыңғайланады — `boxDrillMarkers`.
   */
  const bandsMap = useMemo(
    () => new Map(catalog.edgeBands.map((b): [string, EdgeBand] => [b.id, b])),
    [catalog],
  )
  const drillSettings = useMemo(() => mergeSettings(settings), [settings])
  const fittings = useMemo(() => showFittings
    ? fittingsForPanel(panel, thickness, bandsMap, drillSettings, assemblyPanels) : [],
  [showFittings, panel, thickness, bandsMap, drillSettings, assemblyPanels])
  const canonicalDrillMarkers = useMemo((): RenderedDrillMarker[] => {
    if (!showDrilling || panel.drilling.length === 0) return []
    return panel.drilling.map((d) => ({
      ...drillToLocalMarker(panel, d, thickness, bandsMap, drillSettings),
      purpose: d.purpose,
    }))
  }, [showDrilling, panel, thickness, bandsMap, drillSettings])
  /*
   * ⚠ `frameloop="demand"` гочасы: қосқыш басылғанда React қайта рендерлейді,
   * бірақ R3F ЖАҢА КАДР САЛМАЙДЫ — камера қозғалмайынша экран өзгермейді.
   * Пайдаланушыға бұл «қосқыш жұмыс істемейді» болып көрінеді.
   */
  useEffect(() => { invalidate() }, [showDrilling, showFittings, invalidate])
  /** Бокс тармағы: канондық нүкте боксттың ОРТАСЫНАН саналған ығысуға көшеді. */
  const boxDrillMarkers = useMemo((): RenderedDrillMarker[] => {
    if (canonicalDrillMarkers.length === 0) return []
    return canonicalDrillMarkers.map((m) => {
      const point = { x: 0, y: 0, z: 0 }
      point[panel.orientation.length] = m.point.x - panel.finishedLength / 2
      point[panel.orientation.width] = m.point.y - panel.finishedWidth / 2
      point[panel.orientation.thickness] = m.point.z - thickness / 2
      const direction = { x: 0, y: 0, z: 0 }
      direction[panel.orientation.length] = m.direction.x
      direction[panel.orientation.width] = m.direction.y
      direction[panel.orientation.thickness] = m.direction.z
      return { ...m, point, direction }
    })
  }, [canonicalDrillMarkers, panel.orientation, panel.finishedLength, panel.finishedWidth, thickness])
  const boxFittings = useMemo(() => fittings.map((item) => {
    const point = { x: 0, y: 0, z: 0 }
    point[panel.orientation.length] = item.point.x - panel.finishedLength / 2
    point[panel.orientation.width] = item.point.y - panel.finishedWidth / 2
    point[panel.orientation.thickness] = item.point.z - thickness / 2
    const normal = { x: 0, y: 0, z: 0 }
    normal[panel.orientation.length] = item.normal.x
    normal[panel.orientation.width] = item.normal.y
    normal[panel.orientation.thickness] = item.normal.z
    return { ...item, point, normal }
  }), [fittings, panel.orientation, panel.finishedLength, panel.finishedWidth, thickness])

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
  const opacity = ((showFittings && exploded > 0 && panel.role === 'front') ? 0.3
    : viewMode === 'solid' || isHovered || isSelected ? 1 : viewMode === 'ghost' ? 0.28 : 0.06) * look.opacity

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

  const texture = useMemo(() => {
    /*
     * `grainAlongLength` (CLAUDE.md §3, docs/visual/texture.md §1.5): раскрой
     * (`nesting.ts`) `hasGrain` панельді 90°-қа бұруға тыйым салады,
     * сондықтан 3D дәл сол бағытты көрсетуі керек — әйтпесе клиентке
     * көрсетілген сурет пен цехтың кескен парағы алшақтап кетеді.
     *
     * Пішінді/қиғаш панельде (`shape || tilted`, төменде) текстура тікелей
     * локал x=ұзындық, y=ен етіп салынады (`ExtrudeGeometry`-нің әдепкі UV
     * генераторы сол координатаны тікелей қолданады), ал жай `boxGeometry`
     * панельде U-осі `orientation`-ға қарай ауысады — `boxGrainUAxis`.
     */
    const uAxis: GrainUVAxis = shape || tilted ? 'length' : boxGrainUAxis(panel.orientation)
    const rotation = grainRotation(uAxis, panel.grainAlongLength)

    // `mapUrl` берілсе — НАҒЫЗ сурет, физикалық мм-мен масштабталған
    // (`lib/floorTexture.ts`-тегі SPAN_MM тәсілі). Жүктеу асинхронды —
    // `demand` кадр режимінде сурет келгенде кадрды өзіміз сұраймыз.
    if (decor?.mapUrl && decor.mapSizeMm) {
      const tex = decorTexture(decor.mapUrl, panel.finishedLength, panel.finishedWidth, decor.mapSizeMm, () => invalidate())
      if (tex) {
        tex.center.set(0.5, 0.5)
        tex.rotation = rotation
      }
      return tex
    }
    if (!woodDecor) return null
    /*
     * `grainTexture()` — БҮКІЛ қосымшаға ОРТАҚ singleton (`lib/grainTexture.ts`).
     * Оны тікелей бұруға БОЛМАЙДЫ: екі панельдің `grainAlongLength`-і басқа
     * болса, соңғы қойылған бұрыш екеуіне де қолданылып кетеді — олар бір
     * ғана Texture объектісін бөліседі. Сол үшін панель өз данасын клондайды,
     * дәл `lib/floorTexture.ts`-тегі `base.clone()` үлгісімен.
     */
    const base = grainTexture()
    if (!base) return null
    const tex = base.clone()
    tex.center.set(0.5, 0.5)
    tex.rotation = rotation
    tex.needsUpdate = true
    return tex
  }, [decor, woodDecor, panel.finishedLength, panel.finishedWidth, panel.grainAlongLength, panel.orientation, shape, tilted, invalidate])

  const normalMap = useMemo(() => {
    if (!pbr?.normal) return null
    const normal = pbr.normal
    const tex = normalTexture(normal.url, panel.finishedLength, panel.finishedWidth, normal.sizeMm,
      () => invalidate())
    if (tex) {
      const uAxis: GrainUVAxis = shape || tilted ? 'length' : boxGrainUAxis(panel.orientation)
      tex.center.set(0.5, 0.5)
      tex.rotation = grainRotation(uAxis, panel.grainAlongLength)
    }
    return tex
  }, [pbr?.normal, panel.finishedLength, panel.finishedWidth, panel.grainAlongLength, panel.orientation, shape, tilted, invalidate])
  useEffect(() => () => { normalMap?.dispose() }, [normalMap])
  const shaderKey = materialRenderKey(usesPhysical, Boolean(texture), Boolean(normalMap))

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
          // Прогулканың сәулесі осы кілтпен ЖЕКЕ есікті табады.
          userData={panel.opening ? { doorPid: key } : {}}
          // Классикалық десктопта Properties; өзге көріністе есік/ящик ашылады.
          onDoubleClick={(e) => {
            if (vr) return
            e.stopPropagation()
            onPanelDoubleClick()
          }}
          onClick={(e) => {
            // VR-да оқиға корпустың тобына көтеріледі — ол есікті ашады.
            if (vr) return
            // Сүйреудің (модульді жылжыту не камераны айналдыру) соңы — басу емес:
            // әйтпесе жібергенде таңдау ауысып не алынып кететін.
            if (e.delta > CLICK_SLOP) return
            e.stopPropagation()
            // ⚠ Алдымен корпус: басқа корпусқа ауысу таңдауды тазалайды, сондықтан
            // setActive setSelected-тен КЕЙІН тұрса, таңдау бірден өшіп қалатын.
            if (cabinetId) setActive(cabinetId)
            // Екінші рет басу таңдауды АЛАДЫ: бөлектеу қалып қоймауы керек.
            setSelected(isSelected ? null : key)
          }}
        >
          {shape ? (
            <extrudeGeometry args={[shape, { depth: thickness, bevelEnabled: false }]} />
          ) : (
            <boxGeometry args={[panel.finishedLength, panel.finishedWidth, thickness]} />
          )}
          {usesPhysical ? (
            <meshPhysicalMaterial
              key={shaderKey} color={color} map={texture} normalMap={normalMap}
              normalScale={[pbr?.normal?.strength ?? 1, pbr?.normal?.strength ?? 1]}
              roughness={look.roughness} metalness={look.metalness}
              clearcoat={look.clearcoat} clearcoatRoughness={look.clearcoatRoughness}
              envMapIntensity={look.envMapIntensity}
              transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
            />
          ) : (
            <meshStandardMaterial
              key={shaderKey} color={color} map={texture} normalMap={normalMap}
              normalScale={[pbr?.normal?.strength ?? 1, pbr?.normal?.strength ?? 1]}
              roughness={look.roughness} metalness={look.metalness}
              envMapIntensity={look.envMapIntensity}
              transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1}
            />
          )}
          {outline}
        </mesh>
        {/* Канондық кеңістік (ұзындық/ен/қалыңдық, бұрылусыз) — дәл осы
            топтың ӨЗ жергілікті кеңістігі, сондықтан ешбір ауыстырусыз. */}
        <DrillMarkers markers={canonicalDrillMarkers} />
        <FittingMeshes fittings={fittings} />
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
      userData={panel.opening ? { doorPid: key } : {}}
      onDoubleClick={(e) => {
        if (vr) return
        e.stopPropagation()
        onPanelDoubleClick()
      }}
      onClick={(e) => {
        if (vr) return
        if (e.delta > CLICK_SLOP) return
        e.stopPropagation()
        if (cabinetId) setActive(cabinetId)
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
      ) : usesPhysical ? (
        <meshPhysicalMaterial
          key={shaderKey} color={color}
          map={texture}
          normalMap={normalMap}
          normalScale={[pbr?.normal?.strength ?? 1, pbr?.normal?.strength ?? 1]}
          roughness={look.roughness}
          metalness={look.metalness}
          clearcoat={look.clearcoat}
          clearcoatRoughness={look.clearcoatRoughness}
          envMapIntensity={look.envMapIntensity}
          transparent={opacity < 1}
          opacity={opacity}
          // Мөлдір панель артындағыны жауып қалмауы үшін тереңдікке жазбайды.
          depthWrite={opacity === 1}
        />
      ) : (
        <meshStandardMaterial
          key={shaderKey} color={color}
          map={texture}
          normalMap={normalMap}
          normalScale={[pbr?.normal?.strength ?? 1, pbr?.normal?.strength ?? 1]}
          roughness={look.roughness}
          metalness={look.metalness}
          envMapIntensity={look.envMapIntensity}
          transparent={opacity < 1}
          opacity={opacity}
          // Мөлдір панель артындағыны жауып қалмауы үшін тереңдікке жазбайды.
          depthWrite={opacity === 1}
        />
      )}
      {/* Шыны есіктің рамасы әрқашан көрінеді. */}
      {isGlass ? <Edges color="#5b5147" lineWidth={2} /> : null}
      {outline}
      {quality !== 'low' && !isGlass && !isSelected
        ? <PanelEdges x={extents.x} y={extents.y} z={extents.z} />
        : null}
      {panel.role === 'front' && panel.milling.length > 0 ? (
        <MillingLines panel={panel} catalog={catalog} settings={settings} extents={extents} />
      ) : null}
      {/* Тұтқа тек тікбұрышты фасадта: қиғаш/оймалы фасадтың жазықтығы басқа. */}
      {panel.role === 'front' && panel.handle ? <HandleMesh handle={panel.handle} extents={extents} /> : null}
      {/* Канондық нүкте боксттың ОРТАСЫНАН саналған ығысуға ауыстырылды
          (`boxDrillMarkers`, жоғарыда) — бұл мештің өз жергілікті кеңістігі
          дәл сол орталықтан саналады. */}
      <DrillMarkers markers={boxDrillMarkers} />
      <FittingMeshes fittings={boxFittings} />
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
