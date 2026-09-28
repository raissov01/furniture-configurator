'use client'

/**
 * Шаблон превьюінің СТУДИЯСЫ (тек `/dev/thumb` және `scripts/renderTemplateThumbs.mjs`).
 *
 * Сурет қолмен салынбайды: корпус `generateCabinet()`/`generateHardware()`
 * нәтижесінен, редактордағы дәл сол `CabinetGroup` арқылы салынады (§3) —
 * фасад, ручка, цоколь, столешница, техника, текстура бәрі нақты панельден.
 * Бөлме, тор, өлшем жазуы ЖОҚ: тек жиһаз, ашық жалпақ фонда, изометрия 3/4.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Box3, NeutralToneMapping, Object3D, OrthographicCamera, Vector3 } from 'three'
import type { Group } from 'three'
import { CabinetGroup } from '@/components/Scene'
import type { SceneItem } from '@/components/Scene'
import type { Catalog, SettingsOverride } from '@/src/core/index'

const MM = 0.001

/** Фон — галерея карточкасымен бірдей ашық бейтарап түс, градиентсіз. */
export const THUMB_BACKGROUND = '#f4f3f0'

/**
 * Көзқарас бағыты корпустың ЛОКАЛ кадрінде: редактордағы «3/4» пресетімен
 * бірдей (`Scene.tsx` → `cameraOffset`, `three-quarter`). Алды — теріс Z.
 */
const VIEW_DIR = new Vector3(0.95, 0.62, -1.15).normalize()

/** Кадрдың шетіндегі бос орын (әр жағынан үлес). */
const PADDING = 0.05

function Framer({ target, facingY, onFramed }: {
  target: React.RefObject<Group | null>
  facingY: number
  onFramed: () => void
}) {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useLayoutEffect(() => {
    const group = target.current
    if (!group) return
    group.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(group)
    if (box.isEmpty()) return
    const centre = box.getCenter(new Vector3())
    const a = (facingY * Math.PI) / 180
    const dir = new Vector3(
      VIEW_DIR.x * Math.cos(a) + VIEW_DIR.z * Math.sin(a),
      VIEW_DIR.y,
      -VIEW_DIR.x * Math.sin(a) + VIEW_DIR.z * Math.cos(a),
    )
    const radius = box.getSize(new Vector3()).length()
    camera.position.copy(centre).addScaledVector(dir, radius * 2 + 1)
    camera.up.set(0, 1, 0)
    camera.lookAt(centre)
    camera.updateMatrixWorld(true)

    // Габарит қораптың 8 бұрышы камера кеңістігінде: кадр солардан шығады.
    const inv = camera.matrixWorldInverse
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new Vector3(x, y, z).applyMatrix4(inv)
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
    }
    const aspect = size.width / Math.max(1, size.height)
    let w = (x1 - x0) * (1 + 2 * PADDING)
    let h = (y1 - y0) * (1 + 2 * PADDING)
    if (w / h > aspect) h = w / aspect
    else w = h * aspect
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    camera.left = cx - w / 2
    camera.right = cx + w / 2
    camera.top = cy + h / 2
    camera.bottom = cy - h / 2
    camera.zoom = 1
    camera.near = 0.01
    camera.far = radius * 5 + 10
    camera.updateProjectionMatrix()
    invalidate()
    onFramed()
  })
  return null
}

function InvalidateBridge({ onInvalidate }: { onInvalidate: (fn: () => void) => void }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { onInvalidate(() => invalidate()) }, [invalidate, onInvalidate])
  return null
}

export function ThumbStage({
  items, catalog, settings, facingY, onFramed, onInvalidate,
}: {
  items: SceneItem[]
  catalog: Catalog
  settings: SettingsOverride
  /** Бірінші корпустың бұрылысы — камера соның алдынан қарайды. */
  facingY: number
  onFramed: () => void
  /** Скрипт текстура келгеннен кейін кадрды қолмен сұрайды (`frameloop="demand"`). */
  onInvalidate: (fn: () => void) => void
}) {
  const furniture = useRef<Group>(null)
  const lightTarget = useMemo(() => new Object3D(), [])
  const stepOf = useMemo(() => new Map<string, number>(), [])

  // Көлеңке жазықтығы мен жарық жиһаздың габаритіне қарай қойылады.
  const bounds = useMemo(() => {
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity; let h = 0
    for (const item of items) {
      const { x, z } = item.pose.position
      const r = Math.hypot(item.cabinet.width, item.cabinet.depth)
      x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r)
      z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r)
      h = Math.max(h, item.pose.position.y + item.cabinet.height)
    }
    if (!Number.isFinite(x0)) return { cx: 0, cz: 0, span: 1, h: 1 }
    return { cx: ((x0 + x1) / 2) * MM, cz: ((z0 + z1) / 2) * MM, span: Math.max(x1 - x0, z1 - z0, h) * MM, h: h * MM }
  }, [items])

  useEffect(() => { lightTarget.position.set(bounds.cx, bounds.h / 2, bounds.cz) }, [lightTarget, bounds])

  const half = bounds.span * 1.2
  const a = (facingY * Math.PI) / 180
  /*
   * Негізгі жарық камера жақтан (алдыңғы-оң) әрі БИІКТЕН: көлеңке корпустың
   * астына/артына түседі. Бүйірден түссе, әр суретте жиһаздың сол жағында
   * сұр сына пайда болып, «артефакт» сияқты көрінетін.
   */
  const lx = 0.7 * Math.cos(a) + -1.0 * Math.sin(a)
  const lz = -0.7 * Math.sin(a) + -1.0 * Math.cos(a)

  return (
    <Canvas
      orthographic
      shadows
      frameloop="demand"
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
      camera={{ near: 0.01, far: 100, position: [2, 2, -2] }}
    >
      <color attach="background" args={[THUMB_BACKGROUND]} />
      <Environment resolution={256} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={1} position={[-7, 2, 3]} rotation={[0, Math.PI / 2, 0]} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={1} position={[7, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} />
      </Environment>
      <ambientLight intensity={0.12} />
      <hemisphereLight intensity={0.45} color="#ffffff" groundColor="#b5b0a8" />
      <primitive object={lightTarget} />
      <directionalLight
        position={[bounds.cx + lx * bounds.span * 2, bounds.h + bounds.span * 4, bounds.cz + lz * bounds.span * 2]}
        target={lightTarget}
        intensity={1.45}
        color="#fffaf3"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-near={0.05}
        shadow-camera-far={bounds.span * 8 + 5}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
      />
      <directionalLight position={[bounds.cx - 3, 2, bounds.cz + 3]} intensity={0.3} color="#e6eeff" />
      <group ref={furniture} scale={MM}>
        {items.map((item) => (
          <CabinetGroup
            key={item.cabinet.id}
            item={{ ...item, editable: false }}
            catalog={catalog}
            active={false}
            cabinetCount={items.length}
            stepOf={stepOf}
            allowDimensionLabels={false}
            settings={settings}
          />
        ))}
      </group>
      {/* Тек көлеңке: еден боялмайды, фон тұтас қалады. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.cx, 0.0005, bounds.cz]} receiveShadow>
        <planeGeometry args={[bounds.span * 6, bounds.span * 6]} />
        <shadowMaterial transparent opacity={0.12} />
      </mesh>
      <InvalidateBridge onInvalidate={onInvalidate} />
      <Framer target={furniture} facingY={facingY} onFramed={onFramed} />
    </Canvas>
  )
}
