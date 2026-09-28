'use client'

/** Өндіруші CAD активі емес: дайын Drill бойынша шағын процедуралық модель. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Object3D, Quaternion, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { fittingShape, type FittingVisual } from '@/lib/fittingGeometry'
import { t as tr } from '@/lib/i18n'

const Y = new Vector3(0, 1, 0)
const SILVER = '#a9adb2'
const MOUNT = '#68717b'

function BatchedPurpose({ fittings }: { fittings: FittingVisual[] }) {
  const head = useRef<InstancedMesh>(null)
  const shaft = useRef<InstancedMesh>(null)
  const detail = useRef<InstancedMesh>(null)
  const plate = useRef<InstancedMesh>(null)
  const railMesh = useRef<InstancedMesh>(null)
  const [hover, setHover] = useState<number | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const purpose = fittings[0]?.purpose
  const rails = useMemo(() => fittings.filter((item) => item.rail), [fittings])
  const transforms = useMemo(() => fittings.map((item) => {
    const normal = new Vector3(item.normal.x, item.normal.y, item.normal.z)
    const q = new Quaternion().setFromUnitVectors(Y, normal)
    const p = new Vector3(item.point.x, item.point.y, item.point.z)
    const dimensions = fittingShape(item)
    return { p, q, normal, dimensions }
  }), [fittings])

  useEffect(() => {
    const dummy = new Object3D()
    transforms.forEach(({ p, q, normal, dimensions }, i) => {
      dummy.quaternion.copy(q)
      // Басы сыртқа шығып тұрған қара өзекке айналмауы үшін бетпен бір деңгейде.
      dummy.position.copy(p).addScaledVector(normal, -Math.min(dimensions.head[1] / 2, dimensions.shaft[1] / 2))
      dummy.scale.set(...dimensions.head)
      dummy.updateMatrix()
      head.current?.setMatrixAt(i, dummy.matrix)
      dummy.position.copy(p).addScaledVector(normal, -dimensions.shaft[1] / 2)
      dummy.scale.set(...dimensions.shaft)
      dummy.updateMatrix()
      shaft.current?.setMatrixAt(i, dummy.matrix)
      if (dimensions.arm) {
        // Көзге танылатын иін/рельс; тек көрініс. Дәл монтаж тесігі әрдайым
        // Drill-дағы нүкте, ал рельстің толық ұзындығы бұл деректе жоқ.
        dummy.position.copy(p).addScaledVector(normal, dimensions.arm[1] / 2)
        dummy.scale.set(...dimensions.arm)
        dummy.updateMatrix()
        detail.current?.setMatrixAt(i, dummy.matrix)
      } else if (detail.current) {
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        detail.current.setMatrixAt(i, dummy.matrix)
      }
      if (dimensions.plate) {
        dummy.position.copy(p).addScaledVector(normal, dimensions.arm![1] + dimensions.plate[1] / 2)
        dummy.scale.set(...dimensions.plate)
        dummy.updateMatrix()
        plate.current?.setMatrixAt(i, dummy.matrix)
      } else if (plate.current) {
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        plate.current.setMatrixAt(i, dummy.matrix)
      }
    })
    rails.forEach((item, index) => {
      const rail = item.rail!
      dummy.quaternion.identity()
      dummy.position.set(rail.center.x, rail.center.y, rail.center.z)
      dummy.scale.set(rail.sideClearance, rail.length, item.diameter)
      dummy.updateMatrix()
      railMesh.current?.setMatrixAt(index, dummy.matrix)
    })
    for (const mesh of [head.current, shaft.current, detail.current, plate.current, railMesh.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    invalidate()
  }, [transforms, purpose, rails, invalidate])

  if (fittings.length === 0) return null
  const current = hover === null ? null : fittings[hover]
  return <group>
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
    {purpose === 'hinge' &&
      <instancedMesh ref={detail} args={[undefined, undefined, fittings.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={MOUNT} metalness={0.55} roughness={0.35} />
      </instancedMesh>}
    {purpose === 'hinge' &&
      <instancedMesh ref={plate} args={[undefined, undefined, fittings.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={SILVER} metalness={0.55} roughness={0.35} />
      </instancedMesh>}
    {purpose === 'runner' && rails.length > 0 &&
      <instancedMesh ref={railMesh} args={[undefined, undefined, rails.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={MOUNT} metalness={0.7} roughness={0.3} />
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
