'use client'

/** Бір панельдегі тесіктер мақсаты бойынша инстанстарға бірігеді. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { DoubleSide, Object3D, Quaternion, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { drillLegend, markerGroups, type ColoredDrillMarker } from '@/lib/drillLegend'
import { t as tr } from '@/lib/i18n'

export type RenderedDrillMarker = ColoredDrillMarker
const Z = new Vector3(0, 0, 1)
const LIFT = 0.4

function PurposeMarkers({ markers, purpose, dimmed }: {
  markers: RenderedDrillMarker[]
  purpose: RenderedDrillMarker['purpose']
  dimmed: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  const [hover, setHover] = useState<number | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const legend = drillLegend.find((entry) => entry.purpose === purpose)!
  useEffect(() => {
    const dummy = new Object3D()
    for (const [index, marker] of markers.entries()) {
      const outward = new Vector3(-marker.direction.x, -marker.direction.y, -marker.direction.z)
      dummy.quaternion.copy(new Quaternion().setFromUnitVectors(Z, outward))
      dummy.position.set(marker.point.x, marker.point.y, marker.point.z).addScaledVector(outward, LIFT)
      dummy.scale.set(marker.diameter / 2, marker.diameter / 2, 1)
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(index, dummy.matrix)
    }
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true
      mesh.current.computeBoundingSphere()
    }
    invalidate()
  }, [markers, invalidate])
  const current = hover === null ? null : markers[hover]
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, markers.length]}
      onPointerOver={(event) => { event.stopPropagation(); setHover(event.instanceId ?? null) }}
      onPointerOut={() => setHover(null)}>
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial color={legend.color} toneMapped={false} side={DoubleSide}
        transparent={dimmed} opacity={dimmed ? 0.25 : 1} depthWrite={false} />
    </instancedMesh>
    {current && <Html position={[current.point.x, current.point.y, current.point.z]} center>
      <span className="pointer-events-none whitespace-nowrap border border-neutral-600 bg-neutral-950 px-2 py-1 text-xs text-white">
        {tr(legend.label)} · Ø{current.diameter} мм · {tr('Глубина')} {current.depth} мм
      </span>
    </Html>}
  </>
}

export function DrillMarkers({ markers, dimmed = false }: {
  markers: RenderedDrillMarker[]
  dimmed?: boolean
}) {
  const groups = useMemo(() => markerGroups(markers), [markers])
  return <>{groups.map((group) => <PurposeMarkers key={group.purpose}
    purpose={group.purpose} markers={group.markers} dimmed={dimmed} />)}</>
}
