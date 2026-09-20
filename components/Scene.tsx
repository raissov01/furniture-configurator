'use client'

/**
 * R3F көрінісі. Мұнда бірде-бір өлшем ЕСЕПТЕЛМЕЙДІ — тек Panel[] мен
 * ядродан келген орналастыру оқылады. Ядро миллиметрмен жұмыс істейді,
 * сахна метрге келтіріледі (scale 0.001).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentRef, ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Environment, Grid, Lightformer, OrbitControls, OrthographicCamera, PointerLockControls,
} from '@react-three/drei'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import {
  Euler, NeutralToneMapping, Object3D, Plane, Raycaster, SRGBColorSpace, TextureLoader, Vector2, Vector3,
} from 'three'
import { isTouchDevice, walkInput } from '@/lib/walkInput'
import { wallElevationOffset, wallElevationTarget } from '@/lib/wallElevation'
import type { Group, Mesh } from 'three'
import { XR, XROrigin, useXRControllerLocomotion } from '@react-three/xr'
import { getXrStore } from '@/lib/xr'
import { ApplianceMesh } from '@/components/ApplianceMesh'
import { DimensionLabels } from '@/components/DimensionLabels'
import { PanelMesh } from '@/components/PanelMesh'
import { useConfigurator } from '@/store/configurator'
import { canvasSettings } from '@/lib/appearance'
import { floorTexture } from '@/lib/floorTexture'
import type { FloorPattern } from '@/lib/floorTexture'
import { grainTexture } from '@/lib/grainTexture'
import type { CameraPreset } from '@/store/configurator'
import {
  DEFAULT_WALL_COLOR, ROD_DIAMETER, assemblyStepIndex, clampInsideRoom, mergeProjectPanels, placementFootprint,
  placementSpan, projectPanelId, roomWalls, silhouetteDataUri, silhouetteSize, skirtingSpans, snapOffset,
  visibleOpenings, wallById, wallPieces,
} from '@/src/core/index'
import type {
  CabinetConfig, Catalog, FloorKind, HardwarePlacement, Panel, PanelOpening, Placement, Room, RoomOpening,
  Vec3, Wall, WallId,
} from '@/src/core/index'

type Controls = ComponentRef<typeof OrbitControls>

/**
 * Есіктің толық ашылу бұрышы, радиан (100°).
 *
 * Нақты ілгек 95–110° ашады; 100° — соның ортасы әрі көзге де солай көрінеді.
 * 90°-тан үлкені әдейі: дәл 90° «сурет» сияқты жасанды көрінеді.
 */
const DOOR_OPEN_ANGLE = (100 * Math.PI) / 180

/**
 * Көтерілетін фасадтың ашылу бұрышы, радиан (75°).
 *
 * Толық 90° — теориялық шек: нақты механизм фасадты сәл алға шығарып,
 * 70–80°-та тоқтатады, әйтпесе ол шкафтың үстіне тіреледі.
 */
const FLAP_OPEN_ANGLE = (75 * Math.PI) / 180


const MM = 0.001

/**
 * Негізгі жарықтың бөлме центріне қатысты офсеті, МЕТРМЕН (жоғарыдан,
 * алдыңғы оң жақтан) — ескі қатып қалған `position={[3, 5, 4]}`-тің
 * бағыты, енді бөлменің центрінен есептеледі (`Scene`-тегі
 * `mainLightPosition`-ды қара).
 */
const MAIN_LIGHT_OFFSET: Vec3 = { x: 3, y: 5, z: 4 }

/**
 * RIM (артқы бөлектеу) жарығының бөлме центріне қатысты офсеті, МЕТРМЕН.
 *
 * Негізгі жарыққа (`MAIN_LIGHT_OFFSET`) қарама-қарсы бұрыштан, камераға
 * қарсы бағытта тұрады: мақсаты — жиһаздың контурын фоннан бөлектеу
 * (`docs/visual/light.md` §3). Негізгі жарық сияқты бөлме центрінен
 * есептеледі, сондықтан бөлме үлкейгенде де дұрыс бұрышта қалады.
 */
const RIM_LIGHT_OFFSET: Vec3 = { x: -2, y: 3, z: -4 }

export type SceneItem = {
  cabinet: CabinetConfig
  panels: Panel[]
  /** Панель емес фурнитура: штанга. Деталировкаға кірмейді, бірақ көрінеді. */
  hardware: HardwarePlacement[]
  placement: Placement
  pose: { position: Vec3; rotationY: number }
}

/**
 * `wall-*` пресеттерін нақты қабырғаға айналдыру
 * (PRO100-дың «Стена С/З/Ю/В» қойындылары, `docs/pro100/ui-design.md`).
 */
const WALL_VIEW_TARGET: Partial<Record<CameraPreset, WallId>> = {
  'wall-north': 'north',
  'wall-east': 'east',
  'wall-south': 'south',
  'wall-west': 'west',
}

/**
 * Камера пресеттері: көзқарас нүктесі нысанның габаритіне қатысты есептеледі.
 *
 * `wallId`/`room` тек `wall-*` пресеттерінде беріледі. Бағыт
 * `lib/wallElevation.ts`-тегі `wallElevationOffset`-пен есептеледі — ЖАЛҒЫЗ
 * көз, мутациямен тексерілген (`tests/wallElevation.test.ts`). Қайтарылатын
 * вектор бұл жағдайда ӘЛЕМДІК кадрде дайын тұр (айналым ЖОҚ), сондықтан
 * CameraRig-тегі `facingY` wall-* пресетінде 0 болуы КЕРЕК — әйтпесе бағыт
 * ЕКІ РЕТ бұрылып кетеді.
 */
function cameraOffset(
  preset: CameraPreset, W: number, H: number, D: number,
  wallCtx?: { room: Room; wallId: WallId } | undefined,
): [number, number, number] {
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
    // Қабырғаның ЭЛЕВАЦИЯСЫ: камера сол қабырғаның inward нормалі бойымен
    // СЫРТҚА (қабырғадан алыс) тұрады да, кері бағытта (сол қабырғаға қарай)
    // қарайды — сонда ғана сол қабырғаға қойылған жиһаз камераға ТУРА
    // қарайды (2026-09-20: цех адамы «Стена С бос» деп хабарлағаннан кейін
    // дәл осы бағыт бөлек, мутациямен тексерілген функцияға көшірілді).
    case 'wall-north':
    case 'wall-east':
    case 'wall-south':
    case 'wall-west': {
      if (!wallCtx) return [0, 0, span * 1.7] // қауіпсіз әдепкі, іс жүзінде әрқашан беріледі
      const off = wallElevationOffset(wallCtx.room, wallCtx.wallId, span * 1.7)
      return [off.x, 0, off.z]
    }
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
/**
 * ПРОГУЛКА — бірінші жақтан жүру. WASD жүру, тінтуірмен қарау (pointer-lock),
 * көз биіктігінде (1.6 м), бөлменің ішінен шықпайды. E — барлық есік/ящикті
 * ашу/жабу.
 *
 * ⚠ OrbitControls-пен ҚАТАР болмауы керек: екеуі де `makeDefault`, сондықтан
 * ол өшкенде ғана осы қосылады (`walk` күйі шешеді).
 */
/** Телефонда саусақпен қарау сезімталдығы: радиан / px. */
const LOOK_SPEED = 0.005
/** Осыдан аз жылжыған саусақ — ТҮРТУ (есік ашу), көп — қарау, px. */
const TAP_SLOP = 10

function WalkControls({
  room, focus,
}: {
  room: { width: number; depth: number }
  /** Прогулка басталғанда қарайтын нүкте (жиһаздың ортасы), мм. */
  focus: { x: number; z: number }
}) {
  const { camera, scene, gl } = useThree()
  // Телефон/планшет: pointer-lock жоқ — қарау саусақпен, жүру джойстикпен.
  const touch = useMemo(isTouchDevice, [])
  const keys = useRef<Record<string, boolean>>({})
  const stepTimer = useRef(0)
  const audio = useRef<{ ctx: AudioContext } | null>(null)

  // Бөлме ішіне, көз биіктігіне қою (бір рет).
  /*
   * ЖИҺАЗҒА ҚАРАП бастау. ⚠ Бұрын солтүстік қабырғаның ОРТАСЫНА қарайтын:
   * бұрыштағы шкаф телефонның тар экранына кірмей, клиент бос қабырғаны
   * көретін (09-13). Енді — жобаның ортасына (`view.target`), көз деңгейінен
   * сәл төмен (жиһаз еденде тұрады).
   */
  const fx = focus.x
  const fz = focus.z
  useEffect(() => {
    camera.position.set(room.width / 1000 / 2, 1.6, room.depth / 1000 - 0.6)
    camera.lookAt(fx / 1000, 1.1, fz / 1000)
    // Бір рет, кіргенде: `fx/fz` әдейі тізімде жоқ — жүріп жүргенде
    // корпус таңдалса да, камера адамның қарап тұрған жерінен бұрылмауы керек.
  }, [camera, room.width, room.depth])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'KeyE') {
        const st = useConfigurator.getState()
        st.setOpenness(st.openness > 0 ? 0 : 1)
      }
    }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    /*
     * БАСЫП АШУ: сәуле жіберіп, тиген ЕСІКТІ (не корпусты) ашамыз/жабамыз.
     * Тінтуірде — экран ортасынан (прицел), телефонда — саусақ тиген нүктеден.
     */
    const openAt = (ndc: Vector2) => {
      const ray = new Raycaster()
      ray.setFromCamera(ndc, camera)
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let obj: Object3D | null = hit.object
        while (obj) {
          const data = obj.userData as { cabinetId?: string; doorPid?: string }
          // Есікке/ящикке тисе — тек СОНЫ (қолмен, бір-бірлеп); әйтпесе корпусты.
          if (data.doorPid) { useConfigurator.getState().togglePanelOpen(data.doorPid); return }
          if (data.cabinetId) { useConfigurator.getState().toggleCabinetOpen(data.cabinetId); return }
          obj = obj.parent
        }
      }
    }
    const click = () => {
      if (!document.pointerLockElement) return
      openAt(new Vector2(0, 0))
    }
    /*
     * ТЕЛЕФОН: саусақпен СҮЙРЕУ — жан-жаққа қарау, ТҮРТУ (жылжымай) — тиген
     * есікті ашу. Жүру — джойстикпен (`walkInput`, useFrame-де).
     */
    const el = gl.domElement
    const euler = new Euler(0, 0, 0, 'YXZ')
    let last: { x: number; y: number; id: number } | null = null
    let travelled = 0
    const pdown = (e: PointerEvent) => {
      if (!touch) return
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
      travelled = 0
    }
    const pmove = (e: PointerEvent) => {
      if (!touch || !last || e.pointerId !== last.id) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last = { ...last, x: e.clientX, y: e.clientY }
      travelled += Math.abs(dx) + Math.abs(dy)
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= dx * LOOK_SPEED
      euler.x = Math.max(-1.2, Math.min(1.2, euler.x - dy * LOOK_SPEED))
      camera.quaternion.setFromEuler(euler)
    }
    const pup = (e: PointerEvent) => {
      if (!touch || !last || e.pointerId !== last.id) return
      if (travelled < TAP_SLOP) {
        const r = el.getBoundingClientRect()
        openAt(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1))
      }
      last = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    el.addEventListener('click', click)
    el.addEventListener('pointerdown', pdown)
    el.addEventListener('pointermove', pmove)
    el.addEventListener('pointerup', pup)
    el.addEventListener('pointercancel', pup)
    // Телефонда сүйреуді браузер беттің айналуына алмауы үшін.
    if (touch) el.style.touchAction = 'none'
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      el.removeEventListener('click', click)
      el.removeEventListener('pointerdown', pdown)
      el.removeEventListener('pointermove', pmove)
      el.removeEventListener('pointerup', pup)
      el.removeEventListener('pointercancel', pup)
      el.style.touchAction = ''
    }
  }, [camera, scene, gl, touch])

  /** Аяқ дыбысы: сүзілген шу серпіні (файлсыз, WebAudio). */
  const footstep = () => {
    try {
      const ctx = (audio.current ??= { ctx: new AudioContext() }).ctx
      if (ctx.state === 'suspended') void ctx.resume()
      const dur = 0.09
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      const src = ctx.createBufferSource(); src.buffer = buf
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450
      const g = ctx.createGain(); g.gain.value = 0.12
      src.connect(lp); lp.connect(g); g.connect(ctx.destination)
      src.start()
    } catch { /* аудио қолжетімсіз — үнсіз */ }
  }

  useFrame((_, dt) => {
    const speed = 2.4 * Math.min(dt, 0.05)
    const dir = new Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() > 0) dir.normalize()
    const right = new Vector3().crossVectors(dir, new Vector3(0, 1, 0)).normalize()
    const move = new Vector3()
    if (keys.current['KeyW'] || keys.current['ArrowUp']) move.add(dir)
    if (keys.current['KeyS'] || keys.current['ArrowDown']) move.sub(dir)
    if (keys.current['KeyD'] || keys.current['ArrowRight']) move.add(right)
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) move.sub(right)
    // Телефонның джойстигі: жылдамдық — ауытқуына қарай (ақырын итерсе, ақырын).
    const stick = walkInput.move
    const stickLen = Math.min(1, Math.hypot(stick.x, stick.y))
    const moving = move.lengthSq() > 0 || stickLen > 0.05
    if (move.lengthSq() > 0) {
      camera.position.add(move.normalize().multiplyScalar(speed))
    } else if (stickLen > 0.05) {
      const step = dir.clone().multiplyScalar(stick.y).add(right.clone().multiplyScalar(stick.x))
      camera.position.add(step.normalize().multiplyScalar(speed * stickLen))
    }
    // Көз биіктігі тұрақты, бөлмеден шықпайды (0.3 м шетте тоқтайды).
    camera.position.y = 1.6
    const inside = clampInsideRoom(room, { x: camera.position.x * 1000, z: camera.position.z * 1000 })
    camera.position.x = inside.x / 1000
    camera.position.z = inside.z / 1000
    // Қадам дыбысы: жүргенде әр ~0.42 с сайын.
    if (moving && (document.pointerLockElement || touch)) {
      stepTimer.current += dt
      if (stepTimer.current >= 0.42) { stepTimer.current = 0; footstep() }
    } else {
      stepTimer.current = 0.42
    }
  })

  /*
   * ⚠ `selector` — ТЕК 3D-холст. Онсыз drei тінтуірді бекітуді бүкіл
   * `document`-тің басылуына ілетін: Esc басып курсорды босатқан адам кез
   * келген батырманы (Выйти, Вид, мәзір) басқанда қайта прогулкаға кіріп
   * кететін (пайдаланушы, 09-13).
   */
  // Телефонда pointer-lock жоқ: қарау — саусақпен (жоғарыдағы pointer оқиғалары).
  return touch ? null : <PointerLockControls makeDefault selector={`#${SCENE_CANVAS_ID} canvas`} />
}

/** 3D-холсттың контейнері: прогулканың тінтуір бекітуі тек осыны басқанда. */
export const SCENE_CANVAS_ID = 'scene-3d'

/**
 * VR — гарнитурамен бөлменің ішінде тұру. Сол стик — жүру, оң стик — 45°-қа
 * бұрылу, курок — корпусты не техниканы басып ашу (`CabinetGroup`).
 *
 * Бастапқы орын — бөлменің оңтүстік жағы, көзқарас солтүстікке: генератор
 * ас үйді сонда қояды. Көздің биіктігін гарнитура береді (адамның өз бойы),
 * сондықтан мұнда тек ТАБАН (XROrigin) қойылады.
 */
function VrRig({ room }: { room: Room }) {
  const origin = useRef<Group>(null)
  useXRControllerLocomotion(origin, { speed: 1.5 }, { type: 'snap', degrees: 45 })

  // Орын пропспен берілмейді: әр рендерде жаңа массив R3F-те орынды
  // қайта қойып, жүрген адамды бастапқы нүктеге лақтырып тастар еді.
  useEffect(() => {
    origin.current?.position.set(room.width / 2000, 0, room.depth / 1000 - 0.8)
  }, [room.width, room.depth])

  useFrame(() => {
    const o = origin.current
    if (!o) return
    const inside = clampInsideRoom(room, { x: o.position.x * 1000, z: o.position.z * 1000 })
    o.position.x = inside.x / 1000
    o.position.z = inside.z / 1000
  })

  return <XROrigin ref={origin} />
}

function CameraRig({
  target, box, facingY, layoutKey, wallCtx,
}: {
  target: Vec3
  box: { W: number; H: number; D: number }
  /** Шкафтың бұрылу бұрышы: камера оның АЛДЫНА шығуы керек. */
  facingY: number
  /**
   * Көріністің КОМПОНОВКАСЫ: мазмұн, габариттер, белсенді модуль, қабырғалар
   * мен бұрылыстар. Камера ТЕК осы кілт (не пресет, «Вид», канвас) өзгергенде
   * қайта кадрланады. Модульдің қабырға бойымен жылжуы (сүйреу, «Смещение»,
   * ‹ ›, «От пола») кілтке КІРМЕЙДІ — төмендегі эффектіні қара.
   */
  layoutKey: string
  /** Тек `wall-*` пресетінде: `cameraOffset`-тің қай қабырғаны есептеу керегі. */
  wallCtx?: { room: Room; wallId: WallId } | undefined
}) {
  const preset = useConfigurator((s) => s.cameraPreset)
  const fitNonce = useConfigurator((s) => s.fitNonce)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  /*
   * ⚠ ref ЕМЕС, STATE.
   *
   * OrbitControls-тың сілтемесі R3F-тің өз реконсилерінде тіркеледі, ал ол
   * сыртқы React-тің эффектілерімен бір мезгілде БОЛМАУЫ мүмкін. Сол себепті
   * бірінші «кадрлау» кезінде `controls` бос болып шығатын да, бақылаушының
   * нысанасы (0,0,0) күйінде қалатын — содан кейін ол камераны БАСТАПҚЫ
   * НҮКТЕГЕ, яғни бөлменің бұрышындағы еденге қаратып жіберетін. Клиент
   * сілтемені ашқанда дәл сол бос еденді көретін.
   *
   * State болғандықтан, сілтеме тіркелген сәтте `fit` қайта жасалады да,
   * кадрлау бақылаушымен БІРГЕ бір рет қайталанады.
   */
  const [controls, setControls] = useState<Controls | null>(null)
  const { W, H, D } = box
  const { x: tx, y: ty, z: tz } = target

  const fit = useCallback(() => {
    const [lx0, oy0, lz0] = cameraOffset(preset, W, H, D, wallCtx)

    /*
     * Қашықтықты КАДРҒА қарап түзетеміз.
     *
     * Пресеттің ығысуы габариттің ең үлкен өлшемінен есептеледі, ал экранға
     * не сыятынын fov мен канвастың ара қатынасы шешеді. Биік шкаф жалпақ
     * канваста жоғарыдан да, төменнен де қиылып қалатын. Сондықтан бағыт
     * пресеттен алынады, ал ҚАШЫҚТЫҚ нысанды толық сыйдыратындай етіп
     * қайта саналады. «Ішінен» пресеті ӘДЕЙІ ішінде қалады.
     */
    const scale = (() => {
      if (preset === 'inside') return 1
      const aspect = size.height > 0 ? size.width / size.height : 1.6
      // Сахнада перспективалық камера ғана бар (Canvas оны `fov`-пен құрады);
      // ортографиялық болып қалса, кадрлаудың мағынасы жоқ, пресет қалады.
      if (!('fov' in camera)) return 1
      const fovV = ((camera as { fov: number }).fov * Math.PI) / 180
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)
      // Нысанның экрандағы биіктігі мен ені, мм.
      const needV = (H / 2) / Math.tan(fovV / 2)
      const needH = (Math.max(W, D) / 2) / Math.tan(fovH / 2)
      // 1.15 — шеттегі тыныс: өлшем жазуы мен көлеңке қиылмауы үшін.
      const need = Math.max(needV, needH) * 1.15
      const preset0 = Math.hypot(lx0, oy0, lz0)
      return preset0 > 0 ? Math.max(1, need / preset0) : 1
    })()

    const [lx, oy, lz] = [lx0 * scale, oy0 * scale, lz0 * scale]
    // Ығысу шкафтың ЛОКАЛ өсінде есептеледі де, сол бұрышпен бұрылады:
    // әйтпесе қабырғаға қарай бұрылған шкафқа камера АРТ жағынан қарайды.
    const a = (facingY * Math.PI) / 180
    const ox = lx * Math.cos(a) + lz * Math.sin(a)
    const oz = -lx * Math.sin(a) + lz * Math.cos(a)
    camera.position.set((tx + ox) * MM, (ty + oy) * MM, (tz + oz) * MM)
    // OrbitControls әлі тіркелмеген болса да камера нысанға қарауы керек:
    // онсыз бірінші кадр бос шығады да, тінтуір қозғалғанша солай тұрады.
    camera.lookAt(tx * MM, ty * MM, tz * MM)
    /*
     * Ортографиялық камерада қашықтық масштабты өзгертпейді — оны `zoom`
     * шешеді. Сондықтан нысанды кадрға сыйдыру да сол арқылы: экранның қай
     * жағы тар болса, сол шектейді.
     */
    if (!('fov' in camera)) {
      const spanMm = Math.max(H, Math.max(W, D))
      const fitZoom = Math.min(size.width, size.height) / (spanMm * MM * 1.25)
      if (Number.isFinite(fitZoom) && fitZoom > 0) camera.zoom = fitZoom
    }
    camera.updateProjectionMatrix()
    controls?.target.set(tx * MM, ty * MM, tz * MM)
    controls?.update()
    invalidate()
  }, [preset, camera, controls, size.width, size.height, invalidate, W, H, D, tx, ty, tz, facingY, wallCtx])

  /*
   * ҚАЙТА КАДРЛАУ ТЕК КӨРІНІС ӨЗГЕРГЕНДЕ, нысана жылжығанда ЕМЕС.
   *
   * Бұрын эффект `fit`-ке тәуелді еді, яғни нысананың әр жылжуына: модульді
   * сүйрегенде камера оның соңынан еріп, курсор модульден алыстайтын да,
   * модуль әр қадамда одан әрі лақтырылатын; ‹ › басқан сайын көрініс
   * секіретін. «Сүйреп жатыр» жалаушасы да көмектеспеді — соңғы қадамның
   * эффектісі pointerup-тан КЕЙІН жүріп, камера бәрібір секіретін.
   *
   * `fit` ref арқылы шақырылады: ол әрқашан соңғы нысананы біледі, бірақ
   * эффектіні өзі қоздырмайды. Жоба кейінірек келсе (сілтемемен ашылған
   * бет) — `layoutKey` өзгереді де, кадрлау қайталанады.
   */
  const fitRef = useRef(fit)
  useEffect(() => { fitRef.current = fit }, [fit])
  useEffect(() => { fitRef.current() }, [preset, camera, controls, size.width, size.height, layoutKey, fitNonce])

  return <OrbitControls ref={setControls} makeDefault enableDamping dampingFactor={0.12} />
}

function CabinetGroup({
  item, catalog, active, cabinetCount, stepOf,
}: {
  item: SceneItem
  catalog: Catalog
  active: boolean
  /** Жобадағы корпус саны — детальдің кілтін сол шешеді. */
  cabinetCount: number
  /** Жоба бойынша жинау қадамы: кілт → нөмір. */
  stepOf: Map<string, number>
}) {
  const showDimensions = useConfigurator((s) => s.showDimensions)
  // Фасадты жасыру — корпустың ішін көрудің ең тура жолы (мөлдірлікпен қатар).
  const showFronts = useConfigurator((s) => s.showFronts)
  const openness = useConfigurator((s) => s.openness)
  const openCabinets = useConfigurator((s) => s.openCabinets)
  const openPanels = useConfigurator((s) => s.openPanels)
  // VR-да курок корпусты АШАДЫ: гарнитурада детальді таңдаудың мәні жоқ.
  const vr = useConfigurator((s) => s.vr)
  const toggleCabinetOpen = useConfigurator((s) => s.toggleCabinetOpen)
  // Жеке ашылған корпус әрқашан толық ашық; әйтпесе жаһандық openness.
  const openAmt = openCabinets[item.cabinet.id] ? 1 : openness
  const materialOf = useMemo(() => {
    const map = new Map(catalog.materials.map((m) => [m.id, m]))
    return (id: string) => map.get(id)
  }, [catalog])

  const centre = useMemo(
    () => ({ x: item.cabinet.width / 2, y: item.cabinet.height / 2, z: item.cabinet.depth / 2 }),
    [item.cabinet],
  )

  /*
   * ЖИНАУ ҚАДАМЫ: сахнада тек осы қадамға дейінгі детальдар қалады. Рет
   * ЯДРОДАН, әрі ЖОБА БОЙЫНША — сондықтан «Жоба → Сборка» тізіміндегі
   * N-жол мен сахнадағы N-қадам БІР деталь.
   */
  const stepLimit = useConfigurator((s) => s.assemblyStep)
  const visible = useMemo(
    () => (stepLimit === null
      ? item.panels
      : item.panels.filter(
        (p) => (stepOf.get(projectPanelId(item.cabinet.id, p.id, cabinetCount)) ?? 0) <= stepLimit,
      )),
    [item.panels, item.cabinet.id, cabinetCount, stepOf, stepLimit],
  )

  /*
   * МОДУЛЬДІ СҮЙРЕП ЖЫЛЖЫТУ (qdesign сияқты): модуль ӨЗ ҚАБЫРҒАСЫ бойымен
   * сырғиды, 10 мм торға және көршінің шетіне жабысады (`snapOffset`).
   *
   * ⚠ Тек модульдің бір детальі БАСЫП ТАҢДАЛҒАНДА. Әйтпесе жалғыз шкаф
   * (ол әрқашан белсенді) экранның көбін алып тұрады да, камераны айналдырамын
   * деп басқан сайын шкаф жылжып кетер еді. Бірінші басу — таңдау, сосын сүйреу.
   * Басқа қабырғаға ауыстыру — оң панельдегі «Стена» өрісі.
   */
  const room = useConfigurator((s) => s.room)
  const walk = useConfigurator((s) => s.walk)
  const selected = useConfigurator((s) => s.selected)
  const hovered = useConfigurator((s) => s.hovered)
  const movePlacement = useConfigurator((s) => s.movePlacement)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const gl = useThree((s) => s.gl)
  const pids = useMemo(
    () => new Set(item.panels.map((p) => projectPanelId(item.cabinet.id, p.id, cabinetCount))),
    [item.panels, item.cabinet.id, cabinetCount],
  )
  const canDrag = active && !walk && !vr && selected !== null && pids.has(selected)
  const drag = useRef<{ pointerId: number; plane: Plane; grab: number; moved: boolean } | null>(null)

  // Қолмен ұстауға болатынын курсор айтады.
  const grabbable = canDrag && hovered !== null && pids.has(hovered)
  useEffect(() => {
    if (!grabbable) return
    const el = gl.domElement
    el.style.cursor = 'grab'
    return () => { el.style.cursor = '' }
  }, [grabbable, gl])

  /** Әлем нүктесінің (метр) қабырға бойындағы қашықтығы, мм. */
  const along = (point: Vector3, wall: Wall) =>
    (point.x / MM - wall.origin.x) * wall.direction.x + (point.z / MM - wall.origin.z) * wall.direction.z

  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    if (controls) controls.enabled = true
    gl.domElement.style.cursor = grabbable ? 'grab' : ''
  }
  // Сүйреп жатқанда модуль алынып тасталса (undo, жою) — камера қатып қалмасын.
  useEffect(() => endDrag, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group
      // Y — ілмелі модульдің еденнен биіктігі (`placement.elevation`).
      position={[item.pose.position.x, item.pose.position.y, item.pose.position.z]}
      rotation={[0, (item.pose.rotationY * Math.PI) / 180, 0]}
      // Прогулкада басып ашу үшін: raycast осы id-ді табады.
      userData={{ cabinetId: item.cabinet.id }}
      // VR: панель де, техника да басылғанда оқиға осы топқа көтеріледі.
      onClick={(e) => { if (!vr) return; e.stopPropagation(); toggleCabinetOpen(item.cabinet.id) }}
      onPointerDown={(e) => {
        if (!canDrag || e.button !== 0) return
        const placement = useConfigurator.getState().placements.find((p) => p.cabinetId === item.cabinet.id)
        if (!placement) return
        e.stopPropagation()
        const wall = wallById(room, placement.wall)
        /*
         * Жазықтық ұстаған нүкте арқылы өтеді. ⚠ Тек көлденең (еден) жазықтығы
         * камера адам бойында тұрғанда ЖАРАМАЙДЫ: сәуле оны өте жатық қиып,
         * курсордың аз қозғалысы модульді метрлерге лақтыратын (160 px → 2840 мм).
         * Сондықтан камераға көбірек қарайтыны алынады: қабырғаға параллель тік
         * жазықтық (модульдің алды) не көлденең жазықтық (жоғарыдан қарағанда).
         */
        const facing = new Vector3(wall.inward.x, 0, wall.inward.z)
        const up = new Vector3(0, 1, 0)
        const normal = Math.abs(e.ray.direction.dot(facing)) >= Math.abs(e.ray.direction.dot(up)) ? facing : up
        const plane = new Plane().setFromNormalAndCoplanarPoint(normal, e.point)
        drag.current = { pointerId: e.pointerId, plane, grab: placement.offset - along(e.point, wall), moved: false }
        // OrbitControls оқиғаны бізден БҰРЫН алады, бірақ әр қозғалыста `enabled`-ті
        // тексереді — сондықтан камера бір пиксель де бұрылмайды.
        if (controls) controls.enabled = false
        gl.domElement.style.cursor = 'grabbing'
        ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || e.pointerId !== d.pointerId) return
        e.stopPropagation()
        const s = useConfigurator.getState()
        const placement = s.placements.find((p) => p.cabinetId === item.cabinet.id)
        const hit = e.ray.intersectPlane(d.plane, new Vector3())
        if (!placement || !hit) return
        const wall = wallById(room, placement.wall)
        const neighbours = s.placements.flatMap((p) => {
          if (p.wall !== placement.wall || p.cabinetId === item.cabinet.id) return []
          const other = s.cabinets.find((c) => c.id === p.cabinetId)
          return other ? [placementSpan(other, p)] : []
        })
        const offset = snapOffset(d.grab + along(hit, wall), item.cabinet.width, wall.length, neighbours)
        if (offset === placement.offset) return
        // Бір сүйреу — бір undo қадамы, қанша баяу сүйресе де (coalesce терезесі 500 мс).
        movePlacement(item.cabinet.id, { offset }, { continueGesture: d.moved })
        d.moved = true
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        ;(e.target as unknown as Element).releasePointerCapture(e.pointerId)
        endDrag()
      }}
      onLostPointerCapture={endDrag}
    >
      {visible
        .filter((p) => showFronts || p.role !== 'front')
        .map((p) => {
        const material = materialOf(p.materialId)
        const mesh = (
          <PanelMesh
            catalog={catalog}
            key={p.id}
            pid={projectPanelId(item.cabinet.id, p.id, cabinetCount)}
            cabinetId={item.cabinet.id}
            panel={p}
            thickness={material?.thickness ?? 16}
            centre={centre}
            decorColor={material?.decor?.color}
          />
        )
        // Қолмен ашылған ЖЕКЕ есік — толық ашық; әйтпесе корпустыкі/жаһандық.
        const amount = openPanels[projectPanelId(item.cabinet.id, p.id, cabinetCount)] ? 1 : openAmt
        return amount > 0 && p.opening ? (
          <OpenedPanel key={p.id} opening={p.opening} panel={p} openness={amount}>
            {mesh}
          </OpenedPanel>
        ) : mesh
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

        /*
         * Аяқ. Пішіні түріне қарай: цилиндр, конус, шаршы. Жасырын тірек
         * ҚАСАҚАНА сұр әрі жіңішке — ол цокольдің артында тұрады, клиент
         * оны көрмеуі керек, бірақ конструктор оның бар екенін көруі керек.
         */
        if (h.kind === 'leg' && h.size) {
          const d = h.size.x
          const height = h.size.y
          const y = h.position.y
          const colour = h.legType === 'none' ? '#6b7280' : '#8b9199'
          const plate = h.plateSize ?? 0
          const plateThickness = 3
          // Табан дноға тіреледі: тұғыр одан төмен басталады.
          const plateY = h.position.y + height / 2 - plateThickness / 2
          const postHeight = Math.max(1, height - (plate > 0 ? plateThickness : 0))
          const postY = h.position.y - (plate > 0 ? plateThickness / 2 : 0)
          // Конуста асты ТАРЫРАҚ: нақты аяқ дәл солай көрінеді.
          const bottomRadius = h.legType === 'cone' ? d * 0.28 : d / 2

          return (
            <group key={`leg-${i}`}>
              {plate > 0 ? (
                <mesh position={[h.position.x, plateY, h.position.z]}>
                  {h.legPlate === 'square'
                    ? <boxGeometry args={[plate, plateThickness, plate]} />
                    : <cylinderGeometry args={[plate / 2, plate / 2, plateThickness, 24]} />}
                  <meshStandardMaterial color={colour} roughness={0.4} metalness={0.55} />
                </mesh>
              ) : null}
              {h.legType === 'none' ? null : (
                <mesh
                  position={[h.position.x, postY, h.position.z]}
                  // «Вектор» — қиғаш аяқ: сол қиғаштығы оны басқалардан ажыратады.
                  rotation={h.legType === 'vector' ? [0.18, 0, 0.18] : [0, 0, 0]}
                >
                  {h.legType === 'square'
                    ? <boxGeometry args={[d, postHeight, d]} />
                    : <cylinderGeometry args={[
                      h.legType === 'vector' ? d / 3 : d / 2,
                      h.legType === 'vector' ? d / 3 : bottomRadius,
                      postHeight, 20,
                    ]} />}
                  <meshStandardMaterial color={colour} roughness={0.4} metalness={0.55} />
                </mesh>
              )}
            </group>
          )
        }

        // Техника — өз пішінімен (тоңазытқыш, мойка, плита…). Орны мен
        // габариті ядродан; есігі корпуспен бірге ашылады.
        if (h.kind === 'appliance' && h.size && h.appliance) {
          return (
            <group key={`appliance-${i}`} position={[h.position.x, h.position.y, h.position.z]}>
              <ApplianceMesh kind={h.appliance} size={h.size} openness={openAmt} />
            </group>
          )
        }

        // Механизм — қорап. Техника ҚОЮ әрі мөлдір емес: клиент
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
      {/*
        LED ПОДСВЕТКА: корпустың астыңғы-алдыңғы жиегінде жарқыраған жолақ.
        Тек эмиссив (нақты жарық емес — көп корпуста ондаған жарық баяулатар
        еді), бірақ `toneMapped={false}` арқасында LED лентадай ЖАРҚЫРАЙДЫ.
      */}
      {item.cabinet.led ? (
        <mesh position={[item.cabinet.width / 2, 3, -4]}>
          <boxGeometry args={[Math.max(0, item.cabinet.width - 24), 5, 5]} />
          <meshStandardMaterial color="#fff6df" emissive="#ffe6a0" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}

/**
 * Ашылған есік пен шығарылған ящик.
 *
 * ⚠ Мұнда ЕШТЕҢЕ ШЕШІЛМЕЙДІ: қай жаққа ашылатыны да, қанша шығатыны да
 * панельдің `opening` өрісінде дайын тұр (`types.ts` қара). Бұл компонент
 * тек сол шешімді көрсетеді — әйтпесе 3D мен присадка бір күні алшақтайды.
 *
 * Есік ІЛГЕКТІҢ жиегі айналасында бұрылады, сондықтан ось панельдің шетіне
 * қойылады да, мазмұны кері жылжытылады: three.js-те топ өз нүктесінің
 * айналасында бұрылады.
 */
function OpenedPanel({
  opening, panel, openness, children,
}: {
  opening: PanelOpening
  panel: Panel
  /** 0 — жабық, 1 — толық ашық. */
  openness: number
  children: ReactNode
}) {
  if (opening.kind === 'drawer') {
    // Ящик АЛҒА шығады: −Z бағыты (корпустың алды).
    return <group position={[0, 0, -opening.travel * openness]}>{children}</group>
  }

  if (opening.kind === 'flap') {
    /*
     * Көтерілетін фасад ҮСТІҢГІ жиегі айналасында ашылады. Ось — сол жиек,
     * ал бұрылыс X осімен: фасад алға-жоғары шығады.
     */
    const topY = panel.position.y + panel.finishedLength
    return (
      <group position={[0, topY, 0]} rotation={[-FLAP_OPEN_ANGLE * openness, 0, 0]}>
        <group position={[0, -topY, 0]}>{children}</group>
      </group>
    )
  }

  // Есіктің ені — X бойымен (ORIENT_FACING), сондықтан ось сол не оң жиегінде.
  const width = panel.finishedWidth
  const hingeX = opening.side === 'left' ? panel.position.x : panel.position.x + width
  // Сол жақтағы ілгек есікті САҒАТ БАҒЫТЫМЕН ашады (Y осі жоғары қараған).
  const sign = opening.side === 'left' ? 1 : -1
  const angle = sign * openness * DOOR_OPEN_ANGLE

  return (
    <group position={[hingeX, 0, 0]} rotation={[0, angle, 0]}>
      <group position={[-hingeX, 0, 0]}>{children}</group>
    </group>
  )
}

/** Қабырғаның қалыңдығы мен плинтустың биіктігі, мм — тек көрініс үшін. */
const WALL_T = 40
const SKIRT_H = 90

/** Еденнің түрі → реңкі мен өрнегі (тек 3D). */
const FLOOR_LOOK: Record<FloorKind, { color: string; pattern: FloorPattern | null }> = {
  oak: { color: '#c49a6c', pattern: 'planks' },
  walnut: { color: '#7a5236', pattern: 'planks' },
  tile: { color: '#d6d3cc', pattern: 'tiles' },
  concrete: { color: '#8f8e8a', pattern: null },
}

/**
 * Бөлме: еден, төрт қабырға (терезе мен есіктің ОЙЫҒЫМЕН), плинтус.
 *
 * Шолуда қабырғалар мөлдір — ішіндегі жиһаз көрінуі керек, ал шекарасын
 * плинтус береді. ПРОГУЛКАДА олар тұтас әрі боялған: адам бөлменің ішінде
 * тұр, мөлдір қабырға оны сахнада тұрғандай сезіндіреді.
 *
 * ⚠ Қабырға ешқашан көлеңке ТАСТАМАЙДЫ: негізгі жарық бөлменің сыртында,
 * тұтас қабырға көлеңке тастаса, бүкіл ішті қарауытып жіберер еді.
 */
function RoomShell({ room, walk, entries }: {
  room: Room
  walk: boolean
  /** Корпустар — артында қалған терезе/есік салынбайды. */
  entries: { cabinet: CabinetConfig; placement: Placement }[]
}) {
  // Терезе мен есік тек ИММЕРСИВТІ көріністе (VR, прогулка): конструкторда
  // олар керек емес, қабырға тұтас (`room.ts`, «Терезе мен есік»).
  const openings = useMemo(() => (walk ? visibleOpenings(room, entries) : []), [walk, room, entries])
  const wallColor = room.finish?.wallColor ?? DEFAULT_WALL_COLOR
  const floorKind = room.finish?.floor ?? 'oak'
  const look = FLOOR_LOOK[floorKind]
  const floorMap = useMemo(
    () => (look.pattern ? floorTexture(look.pattern, floorKind, room.width, room.depth) : null),
    [look.pattern, floorKind, room.width, room.depth],
  )

  return (
    <group>
      {/* Еден торлы Grid-тен сәл жоғары: әйтпесе екеуі бір жазықтықта жыпылықтайды. */}
      <mesh position={[room.width / 2, 2, room.depth / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color={look.color} map={floorMap} roughness={0.75} />
      </mesh>
      {roomWalls(room).map((w) => (
        <WallMesh
          key={w.id}
          wall={w}
          height={room.height}
          openings={openings.filter((o) => o.wall === w.id)}
          color={wallColor}
          solid={walk}
        />
      ))}
      {walk ? <Ceiling room={room} /> : null}
    </group>
  )
}

/**
 * Бір қабырға. Топ қабырғаның offset = 0 нүктесінде, `rotationY`-пен бұрылған:
 * сонда локал +X — қабырғаның бойы (offset өседі), +Z — бөлменің СЫРТЫ
 * (корпустың локал өстерімен бірдей, `room.ts`). Бөлменің іші — теріс z.
 */
function WallMesh({ wall, height, openings, color, solid }: {
  wall: Wall
  height: number
  openings: RoomOpening[]
  color: string
  solid: boolean
}) {
  const pieces = useMemo(() => wallPieces(wall.length, height, openings), [wall.length, height, openings])
  const skirts = useMemo(() => skirtingSpans(wall.length, openings, SKIRT_H), [wall.length, openings])

  return (
    <group
      position={[wall.origin.x, 0, wall.origin.z]}
      rotation={[0, (wall.rotationY * Math.PI) / 180, 0]}
    >
      {pieces.map((p, i) => (
        <mesh key={i} position={[(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, WALL_T / 2]} receiveShadow={solid}>
          <boxGeometry args={[p.x1 - p.x0, p.y1 - p.y0, WALL_T]} />
          {/*
            ⚠ `key` МІНДЕТТІ. Екеуі бір типті элемент болғандықтан, онсыз React
            материалдың БАР данасын қайта қолданады, ал R3F алынып тасталған
            `transparent`/`opacity`/`depthWrite`-ті әдепкіге қайтармайды:
            шолудан прогулкаға ауысқанда қабырға 10% мөлдір күйінде қалатын.
          */}
          {solid
            ? <meshStandardMaterial key="solid" color={color} roughness={0.92} />
            : <meshStandardMaterial key="ghost" color="#b7b2a8" transparent opacity={0.12} depthWrite={false} />}
        </mesh>
      ))}
      {skirts.map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, SKIRT_H / 2, -6]}>
          <boxGeometry args={[b - a, SKIRT_H, 12]} />
          <meshStandardMaterial color={solid ? '#f2f0ea' : '#cfcac2'} roughness={0.6} />
        </mesh>
      ))}
      {openings.map((o) => (o.kind === 'window'
        ? <WindowMesh key={o.id} opening={o} />
        : <DoorMesh key={o.id} opening={o} />))}
    </group>
  )
}

/** Терезе: ақ жақтау, импост, әйнек, ішкі подоконник, сыртында аспан. */
function WindowMesh({ opening: o }: { opening: RoomOpening }) {
  const f = 60 // жақтаудың ені
  const cx = o.offset + o.width / 2
  const cy = o.elevation + o.height / 2
  const bars: [number, number, number, number][] = [
    [cx, o.elevation + o.height - f / 2, o.width, f],
    [cx, o.elevation + f / 2, o.width, f],
    [o.offset + f / 2, cy, f, o.height],
    [o.offset + o.width - f / 2, cy, f, o.height],
  ]
  if (o.width > 1000) bars.push([cx, cy, f * 0.8, o.height])

  return (
    <group>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, WALL_T / 2]} castShadow>
          <boxGeometry args={[w, h, 70]} />
          <meshStandardMaterial color="#f3f3f0" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[cx, cy, WALL_T / 2]}>
        <boxGeometry args={[o.width - 2 * f, o.height - 2 * f, 6]} />
        <meshStandardMaterial color="#bcd8ea" transparent opacity={0.22} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      {/* Подоконник бөлменің ІШІНЕ шығып тұрады. */}
      <mesh position={[cx, o.elevation - 10, -70]} castShadow receiveShadow>
        <boxGeometry args={[o.width + 100, 20, 220]} />
        <meshStandardMaterial color="#f5f4f0" roughness={0.6} />
      </mesh>
      {/* Сыртындағы аспан: ішінен қарағанда терезе жарық болып тұрады. */}
      <mesh position={[cx, cy, WALL_T + 600]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[o.width * 2.2, o.height * 2]} />
        <meshBasicMaterial color="#d6e8f7" toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Есік: наличник, ағаш жармасы, тұтқасы (бөлменің ішкі жағында). */
function DoorMesh({ opening: o }: { opening: RoomOpening }) {
  const casing = 70
  const cx = o.offset + o.width / 2
  const leafW = o.width - 20
  const leafH = o.height - 10
  const grain = grainTexture()
  const handleX = o.offset + o.width - 90

  return (
    <group>
      {[
        [cx, o.height + casing / 2, o.width + 2 * casing, casing],
        [o.offset - casing / 2, o.height / 2, casing, o.height],
        [o.offset + o.width + casing / 2, o.height / 2, casing, o.height],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x!, y!, -8]} castShadow>
          <boxGeometry args={[w!, h!, 16]} />
          <meshStandardMaterial color="#efece6" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[cx, leafH / 2, WALL_T / 2]} castShadow receiveShadow>
        <boxGeometry args={[leafW, leafH, 40]} />
        <meshStandardMaterial color="#cdb291" map={grain} roughness={0.6} />
      </mesh>
      <mesh position={[handleX, 1000, -24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[25, 25, 8, 20]} />
        <meshStandardMaterial color="#c3c8ce" roughness={0.3} metalness={0.55} />
      </mesh>
      <mesh position={[handleX - 50, 1000, -40]} castShadow>
        <boxGeometry args={[120, 16, 16]} />
        <meshStandardMaterial color="#c3c8ce" roughness={0.3} metalness={0.55} />
      </mesh>
    </group>
  )
}

/** Прогулкадағы төбе мен шам: іш күндізгідей жарық болсын. */
function Ceiling({ room }: { room: Room }) {
  const cx = room.width / 2
  const cz = room.depth / 2
  return (
    <group>
      <mesh position={[cx, room.height, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color="#f4f4f1" roughness={0.95} />
      </mesh>
      <mesh position={[cx, room.height - 5, cz]}>
        <cylinderGeometry args={[180, 180, 10, 32]} />
        <meshStandardMaterial color="#fffaf0" emissive="#fff4dc" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <pointLight position={[cx, room.height - 300, cz]} intensity={8} decay={2} color="#fff1dc" />
    </group>
  )
}

/**
 * АДАМНЫҢ СИЛУЭТІ — масштабтың өлшемі (`src/core/silhouette.ts`).
 *
 * Тегіс жазықтық, әрқашан КАМЕРАҒА ҚАРАП тұрады (billboard): адам
 * айналдырғанда силуэт қырынан «жоғалып кетпеуі» керек. Ол шкафтың СОЛ
 * ЖАҒЫНА, еденге қойылады да, өзі ешнәрсеге кедергі жасамайды —
 * деталировкаға да, раскройға да кірмейді.
 */
function Silhouette({ height, x, z }: { height: number; x: number; z: number }) {
  const invalidate = useThree((s) => s.invalidate)
  const texture = useMemo(() => {
    const loader = new TextureLoader()
    // Жүктеу асинхронды: `demand` кадр режимінде сурет келгенде кадрды өзіміз
    // сұраймыз, әйтпесе силуэт тінтуір қозғалғанша бос тақта болып тұрар еді.
    const t = loader.load(silhouetteDataUri(height, '#141a22'), () => invalidate())
    t.colorSpace = SRGBColorSpace
    return t
  }, [height, invalidate])
  const size = silhouetteSize(height)
  const ref = useRef<Mesh>(null)

  // Billboard: әр кадрда камераға бұрылады. `lookAt` тік өсті сақтайды —
  // силуэт еңкейіп кетпеуі керек.
  useFrame(({ camera }) => {
    const mesh = ref.current
    if (!mesh) return
    mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z)
  })

  return (
    <mesh ref={ref} position={[x, size.height / 2, z]}>
      <planeGeometry args={[size.width, size.height]} />
      {/* `transparent` + `depthWrite=false`: силуэттің мөлдір бөлігі
          артындағы шкафты жасырмауы керек. */}
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
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
  const projection = useConfigurator((s) => s.projection)
  const quality = useConfigurator((s) => s.quality)
  const silhouette = useConfigurator((s) => s.silhouette)
  const setLiveScene = useConfigurator((s) => s.setLiveScene)
  const walk = useConfigurator((s) => s.walk)
  const vr = useConfigurator((s) => s.vr)
  const setVr = useConfigurator((s) => s.setVr)
  const viewMode = useConfigurator((s) => s.viewMode)
  const canvas = canvasSettings(quality)
  const xrStore = useMemo(() => getXrStore(), [])
  // Сессия басталды/бітті → стордағы `vr`: бөлме тұтас болады, камера
  // басқаруы гарнитураға беріледі.
  useEffect(
    () => xrStore.subscribe((s, prev) => {
      if (Boolean(s.session) !== Boolean(prev.session)) setVr(Boolean(s.session))
    }),
    [xrStore, setVr],
  )

  /*
   * Жинау қадамдары ЖОБА БОЙЫНША саналады — дәл «Жоба → Сборка» тізіміндегі
   * тізбек (ол да `mergeProjectPanels`-тен кейінгі тізімді көреді).
   */
  const stepOf = useMemo(
    () => assemblyStepIndex(mergeProjectPanels(
      items.map((i) => ({ cabinetId: i.cabinet.id, panels: i.panels })),
    )),
    [items],
  )

  /*
   * КАМЕРА НЕГЕ ҚАРАЙДЫ.
   *
   * «Комната» — бүкіл бөлме, «Внутри» — белсенді корпустың іші. Қалғаны: бір
   * корпус болса — сол корпус, БІРНЕШЕУ болса — бүкіл жобаның габариті.
   *
   * ⚠ Бұрын әрқашан белсенді корпусқа қарайтын (09-13): 13 модульді ас үй
   * генерацияланған бойда экранда бір пеналдың жартысы ғана көрінетін,
   * «Вписать в кадр» да сол бір корпусты кадрлайтын, ал корпусты таңдаған
   * сайын камера секіретін. Енді таңдау камераны қозғамайды.
   */
  const view = useMemo<{
    target: Vec3
    box: { W: number; H: number; D: number }
    facingY: number
    wallCtx?: { room: Room; wallId: WallId } | undefined
  }>(() => {
    const wallId = WALL_VIEW_TARGET[preset]
    if (wallId) {
      // Элевация: бүкіл бөлме, көзқарас — сол қабырғаның СЫРТЫНАН (нысана
      // мен бағыт `lib/wallElevation.ts`-те, `wallCtx` арқылы `cameraOffset`-ке
      // беріледі). `facingY: 0` — вектор ӘЛЕМДІК кадрде дайын, қайта
      // бұрылмауы керек (жоғарыдағы `cameraOffset`-тегі ескертуді қара).
      return {
        target: wallElevationTarget(room),
        box: { W: room.width, H: room.height, D: room.depth },
        facingY: 0,
        wallCtx: { room, wallId },
      }
    }
    if (preset === 'room' || !active) {
      return {
        target: { x: room.width / 2, y: room.height / 3, z: room.depth / 2 },
        box: { W: room.width, H: room.height, D: room.depth },
        facingY: 0,
      }
    }
    if (items.length > 1 && preset !== 'inside') {
      let x0 = Infinity
      let x1 = -Infinity
      let z0 = Infinity
      let z1 = -Infinity
      let top = 0
      for (const item of items) {
        const f = placementFootprint(room, item.cabinet, item.placement)
        x0 = Math.min(x0, f.x)
        x1 = Math.max(x1, f.x + f.width)
        z0 = Math.min(z0, f.z)
        z1 = Math.max(z1, f.z + f.depth)
        top = Math.max(top, item.pose.position.y + item.cabinet.height)
      }
      return {
        target: { x: (x0 + x1) / 2, y: top / 2, z: (z0 + z1) / 2 },
        box: { W: x1 - x0, H: top, D: z1 - z0 },
        // Көзқарас бірінші корпустың алдынан: генератор оны негізгі қабырғаға қояды.
        facingY: items[0]!.pose.rotationY,
      }
    }
    const fp = placementFootprint(room, active.cabinet, active.placement)
    return {
      target: {
        x: fp.x + fp.width / 2,
        // Ілмелі модульге камера өз биіктігінде қарауы керек.
        y: active.pose.position.y + active.cabinet.height / 2,
        z: fp.z + fp.depth / 2,
      },
      box: { W: active.cabinet.width, H: active.cabinet.height, D: active.cabinet.depth },
      facingY: active.pose.rotationY,
    }
  }, [active, room, preset, items])

  /*
   * Силуэт қайда тұрады.
   *
   * Шкафтың СОЛ ЖАҒЫНДА әрі АЛДЫНДА: жанында тұрған адам шкафты жаппауы
   * керек, ал артында тұрса — көрінбей қалады. Орны бөлменің ішінде
   * ҚЫСЫЛАДЫ: сыртына шықса, қабырғаның артында қалып қояды да, батырма
   * басылған адам «неге ештеңе шықпады» деп ойлайды (дәл сол қате 09-04-те
   * жіберілді).
   */
  const spot = useMemo(() => {
    if (!active) return { x: room.width / 2, z: room.depth / 2 }
    /*
     * ⚠ БАҒЫТ ҚАБЫРҒАДАН ШЫҒАДЫ, «алдында» деген тұрақты жақтан ЕМЕС.
     * Алғашқы нұсқада силуэт `z + 500`-ге қойылған да, солтүстік қабырғадағы
     * шкафта ол қабырғаның АРТЫНА түсіп, мүлде көрінбей қалған (09-04).
     * Дұрысы: қабырғаның ІШКЕ қараған нормалі бойымен ілгері шығу, ал
     * қабырғаның бойымен модульдің СОЛ жағына жылжу.
     */
    const wall = wallById(room, active.placement.wall)
    const along = active.placement.offset - 400
    const out = active.cabinet.depth + 500
    const clamp = (v: number, max: number) => Math.min(max - 250, Math.max(250, v))
    return {
      x: clamp(wall.origin.x + wall.direction.x * along + wall.inward.x * out, room.width),
      z: clamp(wall.origin.z + wall.direction.z * along + wall.inward.z * out, room.depth),
    }
  }, [active, room])

  /*
   * НЕГІЗГІ ЖАРЫҚ бөлмеге БАЙЛАНЫСТЫ.
   *
   * Бұл `directionalLight` `<group scale={MM}>`-тан ТЫС тұр (АР экспорты
   * үшін бөлек), сондықтан оның координаттары МЕТРМЕН, ал `room.*` —
   * МИЛЛИМЕТРМЕН. Соңғысын `MM`-ге көбейтіп қана салыстыруға болады.
   *
   * ⚠ `target` қойылмаса, Three.js оны әлемнің (0,0,0) нүктесіне бағыттайды.
   * Бөлме дәл сол нүктеден БАСТАЛады (бұрышы 0, ені/тереңдігі оң жаққа
   * созылады), сондықтан жарық бөлменің ОРТАСЫНА емес, БҰРЫШЫНА қарап
   * тұрған. Түзету: target-ты бөлменің геометриялық центріне қоямыз, ал
   * `position`-ды сол центрге қатысты, ескі `[3, 5, 4]` бағытын сақтап
   * есептейміз (жоғарыдан, алдыңғы оң жақтан түсетін бағыт өзгермейді).
   */
  const roomCenterM = useMemo<Vec3>(
    () => ({ x: (room.width / 2) * MM, y: (room.height / 2) * MM, z: (room.depth / 2) * MM }),
    [room.width, room.height, room.depth],
  )
  const mainLightPosition = useMemo<[number, number, number]>(
    () => [roomCenterM.x + MAIN_LIGHT_OFFSET.x, roomCenterM.y + MAIN_LIGHT_OFFSET.y, roomCenterM.z + MAIN_LIGHT_OFFSET.z],
    [roomCenterM],
  )
  /** Rim жарығының дүниедегі позициясы — сол `roomCenterM` тәсілімен. */
  const rimLightPosition = useMemo<[number, number, number]>(
    () => [roomCenterM.x + RIM_LIGHT_OFFSET.x, roomCenterM.y + RIM_LIGHT_OFFSET.y, roomCenterM.z + RIM_LIGHT_OFFSET.z],
    [roomCenterM],
  )
  /*
   * Target — бөлек Object3D: Three.js `directionalLight.target` әдепкісі
   * сахнаға ешқашан ҚОСЫЛМАЙДЫ, сондықтан оның `matrixWorld`-і жаңармай,
   * позициясы әрқашан (0,0,0) болып қалады. Шешім — өз Object3D-ымызды
   * жасап (`<primitive>` арқылы сахна ағашына қосамыз), соны `target`
   * ретінде береміз. Референс тұрақты (`useMemo`, тәуелділіксіз) — жарық
   * әр рендерде жаңа объектіге ауыспасын.
   */
  const mainLightTarget = useMemo(() => new Object3D(), [])
  /*
   * Көлеңке камерасының шекарасы бөлменің ДИАГОНАЛІНЕ сай.
   *
   * Бұрын ±8 м (16×16 м) қатып тұрған — 4×3 м бөлмеге 2048×2048 көлеңке
   * картасының жартысынан көбі бос ауаға кетіп, контакт көлеңкесі бұлыңғыр
   * шығатын. Дұрысы: бөлменің центрден бұрышына дейінгі қашықтығын (3D
   * диагональдің жартысы — шар тәрізді қамту радиусы) есептеп, соған сай
   * ортографиялық жақтауды тарылту/өсіру. Радиус қолданылады, өйткені
   * сфераның кез келген қимасы диаметрден аспайды — жарықтың бағыты қандай
   * болса да бөлме толық сияды.
   */
  const mainLightShadow = useMemo(() => {
    const widthM = room.width * MM
    const depthM = room.depth * MM
    const heightM = room.height * MM
    const radius = Math.sqrt(widthM ** 2 + depthM ** 2 + heightM ** 2) / 2
    const margin = 1.15 // 15% қор — бұрыштағы жиһаздың көлеңкесі кесілмесін
    const offsetLength = Math.sqrt(
      MAIN_LIGHT_OFFSET.x ** 2 + MAIN_LIGHT_OFFSET.y ** 2 + MAIN_LIGHT_OFFSET.z ** 2,
    )
    return {
      half: radius * margin,
      far: (offsetLength + radius) * margin,
    }
  }, [room.width, room.depth, room.height])

  return (
    <Canvas
      id={SCENE_CANVAS_ID}
      shadows
      /*
       * КАДР ТЕК КЕРЕК КЕЗДЕ (`demand`). Бұрын әдепкі `always` еді: сахна
       * ештеңе өзгермесе де секундына 60 рет қайта салынатын. Қасиеттер
       * панелі кеңейген соң (09-13) 3D-нің ауданы екі есе өсті де, GPU-сыз
       * ноутбукте (және headless Chrome-да) негізгі ағын үнемі бос болмайтын:
       * әр әрекет 2–3 с кешігетін, e2e жалған құлайтын.
       *
       * `demand`-та R3F өзі кадр сұрайды: пропс өзгергенде (есік, габарит,
       * разнести), OrbitControls қозғалғанда, CameraRig-тің `invalidate()`-інде.
       * Тек ПРОГУЛКА (WASD әр кадрда) мен VR (цикл гарнитурада) — `always`.
       */
      frameloop={walk || vr ? 'always' : 'demand'}
      /*
       * Сапа адамның баптауынан келеді (`lib/appearance.ts`): 2× пиксель
       * тығыздығы 4 есе көп пиксель деген сөз, ал әлсіз ноутбукте дәл сол
       * кадрды екі есе жылдамдатады.
       */
      dpr={canvas.dpr}
      /*
       * `preserveDrawingBuffer` — ИИ-рендер үшін: онсыз `toDataURL()` БОС
       * сурет қайтарады (браузер кадрды салған соң буферді тазалайды).
       * Бағасы шамалы, ал онсыз «сурет ала алмадық» деген қате шығады.
       */
      /*
       * `NeutralToneMapping` (Khronos PBR Neutral): ақ ЛДСП ақ күйінде қалады,
       * декордың түсі бұрмаланбайды. Әдепкі ACES ақты сарғайтып, түсті
       * күңгірттейтін — клиентке «ақ» деп сатылған корпус сұр болып көрінетін.
       */
      gl={{ antialias: canvas.antialias, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
      /*
       * Өлшеу: debounce нөл әрі `offsetSize`.
       *
       * R3F контейнердің өлшемін `react-use-measure`-мен өлшейді де, өлшемі
       * нөл болса тамырды МОНТАЖДАМАЙДЫ. Гидратациядан кейінгі бірінші өлшеу
       * жайманың алдында жүрсе, `getBoundingClientRect` нөл қайтарады, ал
       * контейнердің өлшемі одан әрі өзгермейтіндіктен бақылаушы қайта
       * оянбайды. `offsetSize: true` өлшемді `offsetWidth/offsetHeight`-тен
       * алады — олар бірінші кадрда-ақ дұрыс.
       */
      resize={{ scroll: false, debounce: { scroll: 0, resize: 0 }, offsetSize: true }}
      camera={{ fov: 40, near: 0.01, far: 100, position: [2, 1.4, 2.4] }}
      /*
       * Тірі сахнаны сторға береміз — AR батырмасы содан алады.
       * `onCreated` БАР ЭЛЕМЕНТТІҢ қасиеті: Canvas ішіне жаңа компонент
       * қосқаннан гөрі сенімді (09-04-те дәл сол жерде уақыт жоғалды).
       */
      onCreated={(state) => setLiveScene(state.scene)}
    >
      <XR store={xrStore}>
        {/*
          * Ортографиялық проекция: параллель сызықтар қиылыспайды, сондықтан
          * өлшемді көзбен салыстыруға ыңғайлы (цехтың сызбасындағыдай).
          * `makeDefault` арқылы OrbitControls те, CameraRig те дәл осы камераны
          * көреді — екі камераны қатар ұстаудың қажеті жоқ.
          */}
        {projection === 'ortho' ? <OrthographicCamera makeDefault near={-100} far={100} /> : null}
        {/*
          ФОН ашық әрі бейтарап (qdesign-мен салыстыру, 09-12): қою фонда ақ
          корпус «әзірлеушінің құралы» сияқты көрінетін, ал ашықта — каталогтағы
          сурет сияқты.
        */}
        <color attach="background" args={['#eceae6']} />
        {/*
          ҚОРШАҒАН ОРТА: Lightformer-мен ОСЫ ЖЕРДЕ жасалады — желіден HDR
          жүктелмейді (PWA офлайн жұмыс істейді). Онсыз болат, шыны, плита мен
          лак ештеңені шағылыстырмай, сұр пластик болып көрінетін.
        */}
        <Environment resolution={256} environmentIntensity={0.55}>
          <Lightformer form="rect" intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
          <Lightformer form="rect" intensity={1} position={[-7, 2, 3]} rotation={[0, Math.PI / 2, 0]} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[7, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} />
        </Environment>
        {/*
          Жарық — үш нүктелі схема (§7, `docs/visual/light.md`): әлсіз
          ambient (негізгі жарықты орта береді) + ЖЫЛЫ негізгі жарық
          (көлеңке тастайды) + суық толтырғыш (қарама-қарсы жақ тым
          қараңғы қалмасын) + суық RIM (контурды фоннан бөлектейді, төменде).
          Ambient/hemisphere rim қосылған соң сәл АЗАЙТЫЛДЫ — жалпы
          жарықтылық сол қалпында, бірақ контраст (демек AO мен көлеңкенің
          көрінуі) қалпына келеді.
        */}
        <ambientLight intensity={0.08} />
        <hemisphereLight intensity={0.22} color="#ffffff" groundColor="#b5b0a8" />
        {/* Түсі БЕЙТАРАП: Neutral tone mapping жылы жарықты басып тастамайды —
            ақ қабырға мен ақ ЛДСП кремге ауып кететін. */}
        <directionalLight
          position={mainLightPosition}
          target={mainLightTarget}
          intensity={1.5}
          color="#fffaf3"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
          shadow-camera-near={0.1}
          shadow-camera-far={mainLightShadow.far}
          shadow-camera-left={-mainLightShadow.half}
          shadow-camera-right={mainLightShadow.half}
          shadow-camera-top={mainLightShadow.half}
          shadow-camera-bottom={-mainLightShadow.half}
        />
        {/*
          `directionalLight`-тың target-і: Three.js әдепкі target-ты сахнаға
          қоспайды, сондықтан оны өз алдымызға `<primitive>` арқылы ағашқа
          қосамыз (жоғарыдағы `mainLightTarget`-ті қара). Позициясы —
          бөлменің геометриялық центрі.
        */}
        <primitive object={mainLightTarget} position={[roomCenterM.x, roomCenterM.y, roomCenterM.z]} />
        <directionalLight position={[-4, 2, -3]} intensity={0.3} color="#e6eeff" />
        {/*
          RIM (артқы бөлектеу): негізгі жарыққа қарама-қарсы бұрыштан,
          жиһаз контурын фоннан бөлектейді (§7). `target` негізгі жарықпен
          ОРТАҚ — бөлме центріне бағытталған, сондықтан бөлек Object3D
          керек емес. `castShadow` ӘДЕЙІ жоқ: көлеңке картасы (2048×2048)
          екінші рет есептелмесін — шығыны бір қосымша directional шейдинг
          қана, кадр жиілігіне әсері жоқ.
        */}
        <directionalLight position={rimLightPosition} target={mainLightTarget} intensity={0.45} color="#eef2ff" castShadow={false} />
        <group scale={MM}>
          <RoomShell room={room} walk={walk || vr} entries={items} />
        </group>
        {/*
          ⚠ ЖИҺАЗ БӨЛЕК, АТАУЛЫ топта (`ar-furniture`), әрі өз масштабымен (MM).
          AR экспорты ТЕК ОСЫ топты алады: онсыз көлеңке жазықтығы (40×40 м),
          бөлме, тор да кетіп, телефонда алып АҚ ҚАБЫРҒА болып шығатын. Атаулы
          топты экспорттаса, оның scale=MM түбір түйінге жазылады да, жиһаз
          МЕТРМЕН, дұрыс өлшемде бөлмеге қойылады.
        */}
        <group name="ar-furniture" scale={MM}>
          {items.map((item) => (
            <CabinetGroup
              key={item.cabinet.id}
              item={item}
              catalog={catalog}
              active={item.cabinet.id === activeId}
              cabinetCount={items.length}
              stepOf={stepOf}
            />
          ))}
        </group>
        {/* Силуэт белсенді шкафтың СОЛ ЖАҒЫНА, еденге қойылады. */}
        {silhouette.on && active ? (
          <Silhouette
            height={silhouette.height}
            x={spot.x / 1000}
            z={spot.z / 1000}
          />
        ) : null}
        {/* Көлеңке ұстағыш: тек көлеңке көрінеді, әйтпесе мөлдір (еденді боямайды). */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial transparent opacity={0.28} />
        </mesh>
        <Grid
          args={[10, 10]}
          position={[0, -0.005, 0]}
          cellSize={0.1}
          cellColor="#d6d2ca"
          sectionSize={1}
          sectionColor="#bcb7ad"
          infiniteGrid
          fadeDistance={14}
        />
        <VrRig room={room} />
        {/* VR-да камераны гарнитура басқарады: екінші басқарушы оған қарсы шығар еді. */}
        {vr ? null : walk ? (
          <WalkControls room={room} focus={{ x: view.target.x, z: view.target.z }} />
        ) : (
          <CameraRig
            target={view.target}
            box={view.box}
            facingY={view.facingY}
            wallCtx={view.wallCtx}
            // Орын (offset, «От пола») ӘДЕЙІ жоқ — CameraRig-тің эффектісін қара.
            layoutKey={[
              room.width, room.depth, room.height, active?.cabinet.id ?? '',
              ...items.map((i) => `${i.cabinet.id}:${i.cabinet.width}x${i.cabinet.height}x${i.cabinet.depth}:${i.placement.wall}:${i.placement.rotate ?? 0}`),
            ].join('|')}
          />
        )}
        {/*
          БҰРЫШТАҒЫ КӨЛЕҢКЕ (N8AO): шкаф пен қабырғаның, сөре мен бүйірдің
          түйіскен жері күңгірттенеді — онсыз заттар ауада қалықтап тұрғандай.
          Тек «жоғары» сапада әрі тұтас көріністе: мөлдір режимде AO мөлдір
          панельдің артындағыны лайлайды. VR-да ӨШЕДІ — постпроцессинг WebXR
          сессиясында кадр бермейді.
        */}
        {quality === 'high' && viewMode === 'solid' && !vr ? (
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={0.35} distanceFalloff={1} intensity={2.2} quality="medium" halfRes />
          </EffectComposer>
        ) : null}
      </XR>
    </Canvas>
  )
}
