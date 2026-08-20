'use client'

/**
 * R3F көрінісі. Мұнда бірде-бір өлшем ЕСЕПТЕЛМЕЙДІ — тек Panel[] оқылады.
 * Ядро миллиметрмен жұмыс істейді, сахна метрге келтіріледі (scale 0.001).
 */

import { useEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { DimensionLabels } from '@/components/DimensionLabels'
import { PanelMesh } from '@/components/PanelMesh'
import { useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'
import type { CabinetConfig, Catalog, Panel } from '@/src/core/index'

type Controls = ComponentRef<typeof OrbitControls>

const MM = 0.001

/** Камера пресеттері: көзқарас нүктесі кабинет габаритіне қатысты есептеледі. */
function cameraFor(preset: CameraPreset, W: number, H: number, D: number): [number, number, number] {
  const span = Math.max(W, H, D)
  switch (preset) {
    case 'front':
      return [0, 0, span * 1.6]
    case 'plan':
      return [0, span * 1.9, 1] // 1 мм — дәл тік қарағанда OrbitControls тұрып қалмас үшін
    case 'inside':
      return [0, 0, D * 0.35]
    case 'three-quarter':
    default:
      return [span * 0.95, span * 0.55, span * 1.15]
  }
}

function CameraRig({ cabinet }: { cabinet: CabinetConfig }) {
  const preset = useConfigurator((s) => s.cameraPreset)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useRef<Controls>(null)
  const { width: W, height: H, depth: D } = cabinet

  useEffect(() => {
    const [x, y, z] = cameraFor(preset, W, H, D)
    camera.position.set(x * MM, y * MM, z * MM)
    // OrbitControls әлі тіркелмеген болса да камера кабинетке қарауы керек:
    // онсыз бірінші кадр бос шығады да, тінтуір қозғалғанша солай тұрады.
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    controls.current?.target.set(0, 0, 0)
    controls.current?.update()
    invalidate()
  }, [preset, camera, invalidate, W, H, D])

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} />
}

function Cabinet({ panels, cabinet, catalog }: { panels: Panel[]; cabinet: CabinetConfig; catalog: Catalog }) {
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const thicknessOf = useMemo(() => {
    const map = new Map(catalog.materials.map((m) => [m.id, m.thickness]))
    return (id: string) => map.get(id) ?? 16
  }, [catalog])

  const centre = useMemo(
    () => ({ x: cabinet.width / 2, y: cabinet.height / 2, z: cabinet.depth / 2 }),
    [cabinet],
  )

  return (
    // Кабинетті ортаға келтіру: түбі — еденде, ені мен тереңдігі центрленген.
    <group position={[-cabinet.width / 2, -cabinet.height / 2, -cabinet.depth / 2]}>
      {panels.map((p) => (
        <PanelMesh key={p.id} panel={p} thickness={thicknessOf(p.materialId)} centre={centre} />
      ))}
      {showDimensions ? <DimensionLabels cabinet={cabinet} /> : null}
    </group>
  )
}

export default function Scene({
  panels, cabinet, catalog,
}: { panels: Panel[]; cabinet: CabinetConfig; catalog: Catalog }) {
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
        <Cabinet panels={panels} cabinet={cabinet} catalog={catalog} />
      </group>
      <Grid
        args={[10, 10]}
        position={[0, -cabinet.height / 2 * MM, 0]}
        cellSize={0.1}
        cellColor="#b8b8b8"
        sectionSize={1}
        sectionColor="#8f8f8f"
        infiniteGrid
        fadeDistance={12}
      />
      <CameraRig cabinet={cabinet} />
    </Canvas>
  )
}
