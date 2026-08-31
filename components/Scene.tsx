'use client'

/**
 * R3F көрінісі. Мұнда бірде-бір өлшем ЕСЕПТЕЛМЕЙДІ — тек Panel[] мен
 * ядродан келген орналастыру оқылады. Ядро миллиметрмен жұмыс істейді,
 * сахна метрге келтіріледі (scale 0.001).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { DimensionLabels } from '@/components/DimensionLabels'
import { PanelMesh } from '@/components/PanelMesh'
import { useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'
import { ROD_DIAMETER, placementFootprint } from '@/src/core/index'
import type { CabinetConfig, Catalog, HardwarePlacement, Panel, Placement, Room, Vec3 } from '@/src/core/index'

type Controls = ComponentRef<typeof OrbitControls>

const MM = 0.001

export type SceneItem = {
  cabinet: CabinetConfig
  panels: Panel[]
  /** Панель емес фурнитура: штанга. Деталировкаға кірмейді, бірақ көрінеді. */
  hardware: HardwarePlacement[]
  placement: Placement
  pose: { position: Vec3; rotationY: number }
}

/** Камера пресеттері: көзқарас нүктесі нысанның габаритіне қатысты есептеледі. */
function cameraOffset(preset: CameraPreset, W: number, H: number, D: number): [number, number, number] {
  const span = Math.max(W, H, D)
  switch (preset) {
    // Z ТЕРІС — корпустың АЛДЫ сол жақта (локал z алдынан артына қарай өседі).
    case 'front':
      return [0, 0, -span * 1.6]
    case 'plan':
      return [0, span * 1.9, 1] // 1 мм — дәл тік қарағанда OrbitControls тұрып қалмас үшін
    case 'inside':
      return [0, 0, -D * 0.35]
    case 'room':
      // Бүкіл бөлме: биіктен әрі қиғаш — қай қабырғада не тұрғаны көріну керек.
      return [span * 0.9, span * 1.3, span * 1.3]
    case 'three-quarter':
    default:
      return [span * 0.95, span * 0.55, -span * 1.15]
  }
}

/**
 * Камера белсенді шкафқа қарайды. Шкаф бөлменің қай бұрышында тұрса да,
 * көрініс сол шкафты ортаға алады — әйтпесе қабырға таңдаған сайын нысан
 * экраннан шығып кетеді.
 */
function CameraRig({
  target, box, facingY, contentKey,
}: {
  target: Vec3
  box: { W: number; H: number; D: number }
  /** Шкафтың бұрылу бұрышы: камера оның АЛДЫНА шығуы керек. */
  facingY: number
  /**
   * Сахнаның МАЗМҰНЫ өзгергенін білдіретін кілт. Нысанның координатасы
   * кездейсоқ бірдей болып қалуы мүмкін (мыс. екі шкаф та басында тұрса),
   * ал камера жаңа мазмұнға бәрібір қайта бағытталуы керек.
   */
  contentKey: string
}) {
  const preset = useConfigurator((s) => s.cameraPreset)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useRef<Controls>(null)
  const { W, H, D } = box
  const { x: tx, y: ty, z: tz } = target

  const fit = useCallback(() => {
    const [lx, oy, lz] = cameraOffset(preset, W, H, D)
    // Ығысу шкафтың ЛОКАЛ өсінде есептеледі де, сол бұрышпен бұрылады:
    // әйтпесе қабырғаға қарай бұрылған шкафқа камера АРТ жағынан қарайды.
    const a = (facingY * Math.PI) / 180
    const ox = lx * Math.cos(a) + lz * Math.sin(a)
    const oz = -lx * Math.sin(a) + lz * Math.cos(a)
    camera.position.set((tx + ox) * MM, (ty + oy) * MM, (tz + oz) * MM)
    // OrbitControls әлі тіркелмеген болса да камера нысанға қарауы керек:
    // онсыз бірінші кадр бос шығады да, тінтуір қозғалғанша солай тұрады.
    camera.lookAt(tx * MM, ty * MM, tz * MM)
    camera.updateProjectionMatrix()
    controls.current?.target.set(tx * MM, ty * MM, tz * MM)
    controls.current?.update()
    invalidate()
  }, [preset, camera, invalidate, W, H, D, tx, ty, tz, facingY, contentKey])

  useEffect(() => { fit() }, [fit])

  /**
   * ⚠ БІР РЕТТІК ҚАЙТА БАҒЫТТАУ.
   *
   * Бірінші кадрда канвастың өлшемі әлі түпкілікті емес, ал сахна мазмұны
   * (жоба) кейінірек келуі мүмкін — сілтемемен ашылған бетте ол әрқашан
   * солай. Сол сәтте бағытталған камера ЕДЕНГЕ қарап қалады да, пайдаланушы
   * пресетті қолмен баспайынша солай тұрады. Клиент сілтемені ашқанда бос
   * еден көрсе, ол қайта баспайды — жай ғана жабады.
   *
   * Сондықтан келесі кадрда бір рет қайта бағыттаймыз.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => fit())
    return () => cancelAnimationFrame(id)
  }, [fit])

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} />
}

function CabinetGroup({ item, catalog, active }: { item: SceneItem; catalog: Catalog; active: boolean }) {
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const materialOf = useMemo(() => {
    const map = new Map(catalog.materials.map((m) => [m.id, m]))
    return (id: string) => map.get(id)
  }, [catalog])

  const centre = useMemo(
    () => ({ x: item.cabinet.width / 2, y: item.cabinet.height / 2, z: item.cabinet.depth / 2 }),
    [item.cabinet],
  )

  return (
    <group
      position={[item.pose.position.x, 0, item.pose.position.z]}
      rotation={[0, (item.pose.rotationY * Math.PI) / 180, 0]}
    >
      {item.panels.map((p) => {
        const material = materialOf(p.materialId)
        return (
          <PanelMesh
            catalog={catalog}
            key={p.id}
            panel={p}
            thickness={material?.thickness ?? 16}
            centre={centre}
            decorColor={material?.decor?.color}
          />
        )
      })}
      {item.hardware.map((h, i) => {
        if (h.kind === 'rod') {
          // Штанга секцияның ені бойымен жатады, сондықтан цилиндр Z осінен
          // X осіне бұрылады.
          return (
            <mesh key={`rod-${i}`} position={[h.position.x, h.position.y, h.position.z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[ROD_DIAMETER / 2, ROD_DIAMETER / 2, h.length, 16]} />
              <meshStandardMaterial color="#9aa3ad" roughness={0.35} metalness={0.6} />
            </mesh>
          )
        }

        // Техника мен механизм — қорап. Техника ҚОЮ әрі мөлдір емес: клиент
        // оны плитадан бірден ажыратуы керек. Механизм жеңіл әрі жартылай
        // мөлдір — ол шкафтың ішін жаппайды.
        if ((h.kind === 'appliance' || h.kind === 'filling') && h.size) {
          const appliance = h.kind === 'appliance'
          return (
            <mesh key={`${h.kind}-${i}`} position={[h.position.x, h.position.y, h.position.z]}>
              <boxGeometry args={[h.size.x, h.size.y, h.size.z]} />
              <meshStandardMaterial
                color={h.color ?? '#9aa3ad'}
                roughness={appliance ? 0.35 : 0.5}
                metalness={appliance ? 0.5 : 0.35}
                transparent={!appliance}
                opacity={appliance ? 1 : 0.55}
              />
            </mesh>
          )
        }

        return null
      })}
      {active && showDimensions ? <DimensionLabels cabinet={item.cabinet} /> : null}
    </group>
  )
}

/**
 * Еден, плинтус және төрт қабырға.
 *
 * Қабырғалар әдейі мөлдір — ішіндегі жиһаз көрінуі керек. Бірақ тек мөлдір
 * қабырға қара фонда мүлде байқалмайды, сондықтан бөлменің шекарасын
 * ПЛИНТУС береді: ол әрқашан анық көрінеді әрі қай қабырға қайда екенін
 * бір қарағанда айтады.
 */
function RoomShell({ room }: { room: Room }) {
  const t = 40 // қабырға қалыңдығы, мм — тек көрініс үшін
  const skirt = 90 // плинтус биіктігі, мм — тек көрініс үшін

  const boxes: { key: string; pos: [number, number, number]; size: [number, number, number] }[] = [
    { key: 'n', pos: [room.width / 2, room.height / 2, -t / 2], size: [room.width, room.height, t] },
    { key: 's', pos: [room.width / 2, room.height / 2, room.depth + t / 2], size: [room.width, room.height, t] },
    { key: 'w', pos: [-t / 2, room.height / 2, room.depth / 2], size: [t, room.height, room.depth] },
    { key: 'e', pos: [room.width + t / 2, room.height / 2, room.depth / 2], size: [t, room.height, room.depth] },
  ]

  return (
    <group>
      {/* Еден торлы Grid-тен сәл жоғары: әйтпесе екеуі бір жазықтықта жыпылықтайды. */}
      <mesh position={[room.width / 2, 2, room.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color="#333c4b" />
      </mesh>
      {boxes.map((b) => (
        <group key={b.key}>
          <mesh position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#9fb0c9" transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[b.pos[0], skirt / 2, b.pos[2]]}>
            <boxGeometry args={[b.size[0], skirt, b.size[2]]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Scene({
  items, room, activeId, catalog,
}: {
  items: SceneItem[]
  room: Room
  activeId: string
  catalog: Catalog
}) {
  const active = items.find((i) => i.cabinet.id === activeId) ?? items[0]
  const preset = useConfigurator((s) => s.cameraPreset)

  // «Комната» пресеті бүкіл бөлмеге қарайды, қалғаны — белсенді шкафқа.
  const view = useMemo<{ target: Vec3; box: { W: number; H: number; D: number }; facingY: number }>(() => {
    if (preset === 'room' || !active) {
      return {
        target: { x: room.width / 2, y: room.height / 3, z: room.depth / 2 },
        box: { W: room.width, H: room.height, D: room.depth },
        facingY: 0,
      }
    }
    const fp = placementFootprint(room, active.cabinet, active.placement)
    return {
      target: { x: fp.x + fp.width / 2, y: active.cabinet.height / 2, z: fp.z + fp.depth / 2 },
      box: { W: active.cabinet.width, H: active.cabinet.height, D: active.cabinet.depth },
      facingY: active.pose.rotationY,
    }
  }, [active, room, preset])

  return (
    <Canvas
      dpr={[1, 2]}
      // Әдепкі 200 мс debounce-та Next гидратациясынан кейін алғашқы өлшеу
      // жоғалып кетеді де, сахна тінтуір қозғалғанша бос тұрады.
      resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      camera={{ fov: 40, near: 0.01, far: 100, position: [2, 1.4, 2.4] }}
    >
      <color attach="background" args={['#20242c']} />
      <hemisphereLight intensity={0.55} groundColor="#8a8a8a" />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <group scale={MM}>
        <RoomShell room={room} />
        {items.map((item) => (
          <CabinetGroup
            key={item.cabinet.id}
            item={item}
            catalog={catalog}
            active={item.cabinet.id === activeId}
          />
        ))}
      </group>
      <Grid
        args={[10, 10]}
        position={[0, -0.005, 0]}
        cellSize={0.1}
        cellColor="#b8b8b8"
        sectionSize={1}
        sectionColor="#8f8f8f"
        infiniteGrid
        fadeDistance={14}
      />
      <CameraRig
        target={view.target}
        box={view.box}
        facingY={view.facingY}
        contentKey={items.map((i) => i.cabinet.id).join(',')}
      />
    </Canvas>
  )
}
