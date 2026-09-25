'use client'

/** Өндіруші CAD активі емес: дайын Drill бойынша шағын процедуралық модель. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Object3D, Quaternion, Vector3 } from 'three'
import type { Group, InstancedMesh } from 'three'
import type { FittingVisual } from '@/lib/fittingGeometry'
import { t as tr } from '@/lib/i18n'

const Y = new Vector3(0, 1, 0)
const SILVER = '#a9adb2'
const MOUNT = '#68717b'

/** Физикалық операцияның символы: өлшемдері Drill/ShopProfile-ден алынған. */
function sizeFor(item: FittingVisual): { head: [number, number, number]; shaft: [number, number, number] } {
  const diameter = item.diameter
  if (item.purpose === 'hinge' && diameter >= 30) return {
    head: [diameter, 2, diameter], shaft: [diameter, item.depth, diameter],
  }
  if (item.purpose === 'minifix' && diameter >= 12) return {
    head: [diameter, 3, diameter], shaft: [diameter, item.depth, diameter],
  }
  if (item.purpose === 'runner') return {
    // Ұзын рельстің нақты ұзындығы бұл Drill-де жоқ; screw орнының
    // нышаны ғана. Нақты рельсті cabinet hardware/config дерегінен салу керек.
    head: [diameter + 3, 3, diameter + 3], shaft: [diameter, item.depth, diameter],
  }
  if (item.purpose === 'shelfPin') return {
    head: [diameter + 4, 3, diameter + 4], shaft: [diameter, item.depth, diameter],
  }
  return {
    head: [diameter + (item.purpose === 'confirmat' ? 3 : 1), 3,
      diameter + (item.purpose === 'confirmat' ? 3 : 1)],
    shaft: [diameter, item.purpose === 'confirmat' ? item.length : item.depth, diameter],
  }
}

function BatchedPurpose({ fittings }: { fittings: FittingVisual[] }) {
  const head = useRef<InstancedMesh>(null)
  const shaft = useRef<InstancedMesh>(null)
  const detail = useRef<InstancedMesh>(null)
  const group = useRef<Group>(null)
  const [hover, setHover] = useState<number | null>(null)
  const { camera, invalidate } = useThree()
  const world = useMemo(() => new Vector3(), [])
  const purpose = fittings[0]?.purpose
  const transforms = useMemo(() => fittings.map((item) => {
    const normal = new Vector3(item.normal.x, item.normal.y, item.normal.z)
    const q = new Quaternion().setFromUnitVectors(Y, normal)
    const p = new Vector3(item.point.x, item.point.y, item.point.z)
    const dimensions = sizeFor(item)
    return { p, q, normal, dimensions }
  }), [fittings])

  useEffect(() => {
    const dummy = new Object3D()
    transforms.forEach(({ p, q, normal, dimensions }, i) => {
      dummy.quaternion.copy(q)
      dummy.position.copy(p).addScaledVector(normal, 1)
      dummy.scale.set(...dimensions.head)
      dummy.updateMatrix()
      head.current?.setMatrixAt(i, dummy.matrix)
      dummy.position.copy(p).addScaledVector(normal, -dimensions.shaft[1] / 2)
      dummy.scale.set(...dimensions.shaft)
      dummy.updateMatrix()
      shaft.current?.setMatrixAt(i, dummy.matrix)
      if (purpose === 'hinge' || purpose === 'runner') {
        // Көзге танылатын иін/рельс; тек көрініс. Дәл монтаж тесігі әрдайым
        // Drill-дағы нүкте, ал рельстің толық ұзындығы бұл деректе жоқ.
        dummy.position.copy(p).addScaledVector(normal, 4)
        dummy.scale.set(
          purpose === 'hinge' ? dimensions.head[0] * 1.6 : dimensions.head[0] * 6,
          3,
          purpose === 'hinge' ? dimensions.head[0] * 0.35 : dimensions.head[0] * 0.4,
        )
        dummy.updateMatrix()
        detail.current?.setMatrixAt(i, dummy.matrix)
      }
    })
    if (head.current) head.current.instanceMatrix.needsUpdate = true
    if (shaft.current) shaft.current.instanceMatrix.needsUpdate = true
    if (detail.current) detail.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [transforms, purpose, invalidate])

  // Алыста ұсақ бекіткіштерді салудың пайдасы жоқ. Demand кадрда камера
  // қозғалғанда useFrame шақырылады; жақындағанда қайта көрінеді.
  useFrame(() => {
    if (!group.current) return
    group.current.getWorldPosition(world)
    const visible = world.distanceTo(camera.position) < 5
    if (head.current) head.current.visible = visible
    if (shaft.current) shaft.current.visible = visible
    if (detail.current) detail.current.visible = visible
  })

  if (fittings.length === 0) return null
  const current = hover === null ? null : fittings[hover]
  return <group ref={group}>
    <instancedMesh ref={shaft} args={[undefined, undefined, fittings.length]} raycast={() => null}>
      <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
      <meshStandardMaterial color={purpose === 'dowel' ? '#b99772' : MOUNT}
        metalness={purpose === 'dowel' ? 0 : 0.45} roughness={0.42} />
    </instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, fittings.length]}
      onPointerOver={(event) => { event.stopPropagation(); setHover(event.instanceId ?? null) }}
      onPointerOut={() => setHover(null)}>
      <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
      <meshStandardMaterial color={purpose === 'dowel' ? '#b99772' : SILVER}
        metalness={purpose === 'dowel' ? 0 : 0.55} roughness={0.34} />
    </instancedMesh>
    {(purpose === 'hinge' || purpose === 'runner') &&
      <instancedMesh ref={detail} args={[undefined, undefined, fittings.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={MOUNT} metalness={0.55} roughness={0.35} />
      </instancedMesh>}
    {current && <Html position={[current.point.x, current.point.y, current.point.z]} center>
      <span className="pointer-events-none whitespace-nowrap border border-neutral-600 bg-neutral-950 px-2 py-1 text-xs text-white">
        {tr(current.name)}{current.purpose === 'confirmat' ? ` 7×${current.length}` : ''} · {tr(current.article)}
      </span>
    </Html>}
  </group>
}

export function FittingMeshes({ fittings }: { fittings: FittingVisual[] }) {
  const groups = useMemo(() => {
    const byPurpose = new Map<FittingVisual['purpose'], FittingVisual[]>()
    for (const item of fittings) {
      const group = byPurpose.get(item.purpose) ?? []
      group.push(item)
      byPurpose.set(item.purpose, group)
    }
    return [...byPurpose]
  }, [fittings])
  return <>{groups.map(([purpose, items]) => <BatchedPurpose key={purpose} fittings={items} />)}</>
}
