'use client'

/** Бір панельдегі тесіктер мақсаты бойынша инстанстарға бірігеді. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Object3D, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { drillLegend, markerGroups, type ColoredDrillMarker } from '@/lib/drillLegend'
import { t as tr } from '@/lib/i18n'
import { markerAppearance } from '@/lib/drillMarkerAppearance'

export type RenderedDrillMarker = ColoredDrillMarker
const LIFT = 0.4

function PurposeMarkers({ markers, purpose, dimmed, xray }: {
  markers: RenderedDrillMarker[]
  purpose: RenderedDrillMarker['purpose']
  dimmed: boolean
  xray: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  const [hover, setHover] = useState<number | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const legend = drillLegend.find((entry) => entry.purpose === purpose)!
  useEffect(() => {
    const dummy = new Object3D()
    for (const [index, marker] of markers.entries()) {
      const outward = new Vector3(-marker.direction.x, -marker.direction.y, -marker.direction.z)
      const appearance = markerAppearance(marker.diameter, xray, dimmed)
      dummy.position.set(marker.point.x, marker.point.y, marker.point.z).addScaledVector(outward, LIFT)
      dummy.scale.setScalar(appearance.radius)
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(index, dummy.matrix)
    }
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true
      mesh.current.computeBoundingSphere()
    }
    invalidate()
  }, [markers, xray, dimmed, invalidate])
  const current = hover === null ? null : markers[hover]
  const appearance = markerAppearance(markers[0]?.diameter ?? 5, xray, dimmed)
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, markers.length]} renderOrder={xray ? 1000 : 0}
      onPointerOver={(event) => { event.stopPropagation(); setHover(event.instanceId ?? null) }}
      onPointerOut={() => setHover(null)}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color={legend.color} toneMapped={false}
        transparent opacity={appearance.opacity} depthTest={appearance.depthTest} depthWrite={false} />
    </instancedMesh>
    {current && <Html position={[current.point.x, current.point.y, current.point.z]} center>
      <span className="pointer-events-none whitespace-nowrap border border-neutral-600 bg-neutral-950 px-2 py-1 text-xs text-white">
        {tr(legend.label)} · Ø{current.diameter} мм · {tr('Глубина')} {current.depth} мм
      </span>
    </Html>}
  </>
}

export function DrillMarkers({ markers, dimmed = false, xray = false }: {
  markers: RenderedDrillMarker[]
  dimmed?: boolean
  xray?: boolean
}) {
  const groups = useMemo(() => markerGroups(markers), [markers])
  return <>{groups.map((group) => <PurposeMarkers key={group.purpose}
    purpose={group.purpose} markers={group.markers} dimmed={dimmed} xray={xray} />)}</>
}
