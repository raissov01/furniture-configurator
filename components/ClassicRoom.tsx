'use client'

/**
 * PRO100 бөлмесі (классикалық жұмыс орны).
 *
 * Бос бөлме — ақ фондағы ЖІҢІШКЕ ҚЫЗҒЫЛТ ТОР: еден, төбе және қабырғалар
 * жазықтығы торланып сызылады, текстура да, көлеңке де жоқ. Камера қай
 * жақтан қараса, сол жақтағы қабырға (камера мен бөлменің арасындағы)
 * салынбайды — PRO100-де бөлме «алдыңғы қабырғасыз қорап» болып көрінеді.
 *
 * Координаттар — ММ, топ `scale={MM}` ішінде тұрады (Scene.tsx).
 */

import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3, type Group, type Mesh, type PointLight } from 'three'
import { roomWalls } from '@/src/core/index'
import type { Room, Vec3 } from '@/src/core/index'

/** Тор қадамы, мм — эталондағы бөлменің тор ұяшығына жуық. */
export const ROOM_GRID_STEP = 500
const MM = 0.001

type Face = { origin: Vec3; inward: Vec3 }

/**
 * Камера жазықтықтың ІШКІ жағында ма. Сыртында тұрса, бет камера мен
 * бөлменің арасында қалады да, ішін жабады — ондай бет салынбайды.
 */
export function cameraInsideFace(cameraMm: Vec3, face: Face): boolean {
  const dx = cameraMm.x - face.origin.x
  const dy = cameraMm.y - face.origin.y
  const dz = cameraMm.z - face.origin.z
  return dx * face.inward.x + dy * face.inward.y + dz * face.inward.z > 0
}

/** Камера ішкі жағында тұрғанда ғана көрінетін топ. */
export function CulledFace({ face, children }: { face: Face; children: ReactNode }) {
  const ref = useRef<Group>(null)
  const point = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    if (!ref.current) return
    camera.getWorldPosition(point)
    ref.current.visible = cameraInsideFace({ x: point.x / MM, y: point.y / MM, z: point.z / MM }, face)
  })
  return <group ref={ref}>{children}</group>
}

/** Тіктөртбұрыштың ішіндегі тор сызықтары (екі шеті де кіреді). */
export function gridLines(width: number, height: number, step: number): number[] {
  const out: number[] = []
  const stops = (length: number) => {
    const values: number[] = []
    for (let v = 0; v < length; v += step) values.push(v)
    values.push(length)
    return values
  }
  for (const x of stops(width)) out.push(x, 0, 0, x, height, 0)
  for (const y of stops(height)) out.push(0, y, 0, width, y, 0)
  return out
}

function GridPlane({ width, height, color }: { width: number; height: number; color: string }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(gridLines(width, height, ROOM_GRID_STEP), 3))
    return g
  }, [width, height])
  return <lineSegments geometry={geometry} raycast={() => null}>
    <lineBasicMaterial color={color} />
  </lineSegments>
}

export function SchematicRoom({ room, color }: { room: Room; color: string }) {
  const walls = roomWalls(room)
  return <group data-testid="schematic-room">
    {/* Еден: локал XY жазықтығы әлемнің XZ-іне бұрылады. */}
    <CulledFace face={{ origin: { x: 0, y: 0, z: 0 }, inward: { x: 0, y: 1, z: 0 } }}>
      <group rotation={[Math.PI / 2, 0, 0]}><GridPlane width={room.width} height={room.depth} color={color} /></group>
    </CulledFace>
    <CulledFace face={{ origin: { x: 0, y: room.height, z: 0 }, inward: { x: 0, y: -1, z: 0 } }}>
      <group position={[0, room.height, 0]} rotation={[Math.PI / 2, 0, 0]}><GridPlane width={room.width} height={room.depth} color={color} /></group>
    </CulledFace>
    {walls.map((wall) => <CulledFace key={wall.id} face={wall}>
      <group position={[wall.origin.x, 0, wall.origin.z]} rotation={[0, (wall.rotationY * Math.PI) / 180, 0]}>
        <GridPlane width={wall.length} height={room.height} color={color} />
      </group>
    </CulledFace>)}
  </group>
}

/** Шынайы классикалық бөлменің төбесі: PRO100-дегідей күңгірт, жарықсыз жазықтық. */
export function ClassicCeiling({ room }: { room: Room }) {
  return <CulledFace face={{ origin: { x: 0, y: room.height, z: 0 }, inward: { x: 0, y: -1, z: 0 } }}>
    <mesh position={[room.width / 2, room.height, room.depth / 2]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial color="#5c5c5a" roughness={1} />
    </mesh>
  </CulledFace>
}

/**
 * PRO100-дің 8 ТҰТҚАСЫ: таңдалған элементтің ЭКРАНДАҒЫ шекарасының төрт
 * бұрышы мен төрт қабырғасының ортасы. Көк боялған мештер (`userData.p100Selected`)
 * жиналып, олардың әлемдік қорабы экранға проекцияланады; нәтиже канвастың
 * үстіндегі DOM қабатына жазылады (React күйі емес — әр кадрда ререндер жоқ).
 */
export function SelectionHandles2D({ overlay }: { overlay: RefObject<HTMLDivElement | null> }) {
  const box = useMemo(() => new Box3(), [])
  const part = useMemo(() => new Box3(), [])
  const point = useMemo(() => new Vector3(), [])
  useFrame(({ scene, camera, size }) => {
    const element = overlay.current
    if (!element) return
    box.makeEmpty()
    scene.traverseVisible((object) => {
      if (object.userData?.p100Selected && (object as Mesh).isMesh) box.union(part.setFromObject(object))
    })
    if (box.isEmpty()) { element.style.display = 'none'; return }
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      point.set(x, y, z).project(camera)
      const px = (point.x + 1) / 2 * size.width
      const py = (1 - point.y) / 2 * size.height
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
    element.style.display = 'block'
    element.style.left = `${Math.round(minX)}px`
    element.style.top = `${Math.round(minY)}px`
    element.style.width = `${Math.max(0, Math.round(maxX - minX))}px`
    element.style.height = `${Math.max(0, Math.round(maxY - minY))}px`
  })
  return null
}

/** «Свет → камера»: камерамен бірге жүретін жұмсақ жарық (PRO100-дегі «налобный» жарық). */
export function CameraHeadlight({ intensity }: { intensity: number }) {
  const ref = useRef<PointLight>(null)
  useFrame(({ camera }) => { ref.current?.position.copy(camera.position) })
  return intensity > 0 ? <pointLight ref={ref} intensity={intensity} decay={0} color="#ffffff" /> : null
}
