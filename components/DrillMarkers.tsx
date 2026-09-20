'use client'

/**
 * Присадка тесігінің 3D белгісі — жазық шеңбер, мақсатына (`purpose`)
 * қарай ТҰТАС түсті, диаметрі НАҒЫЗ масштабта (Ø5 мен Ø35 көзге бірден
 * ажыратылады). Градиент/blur жоқ.
 *
 * ⚠ НАҒЫЗ тесік ОЙЫЛМАЙДЫ (CSG қымбат, жоба `frameloop="demand"`-та): бұл
 * тек панельдің бетіне жабыстырылған белгі, геометрияны өзгертпейді.
 *
 * Координатаны `lib/drillGeometry.ts` (таза, тестелген функция) есептейді.
 * Бұл компонент тек СЫЗАДЫ — қай рендер кеңістігінде сызатынын
 * `components/PanelMesh.tsx` шешеді (бокс па, фигуралы/қиғаш па —
 * `markers` пропы сол кеңістікте ДАЙЫН келеді).
 *
 * Әдепкіде ӨШІРУЛІ (`store/configurator.ts: showDrilling`) — қосу/өшіру
 * қосқышын «Вид» мәзіріне қосу integrator-дың ісі
 * (`.superpowers/sdd/2026-09-20-free-form-editor-phase1/drill-3d-report.md`
 * қара).
 */
import { Edges } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { DrillPurpose } from '@/src/core/index'
import type { DrillMarker3D } from '@/lib/drillGeometry'

/** Мақсат бойынша ТҰТАС түс (градиент жоқ) — цех адамы Ø-ны осы арқылы ажыратады. */
const PURPOSE_COLOR: Record<DrillPurpose, string> = {
  confirmat: '#f59e0b',
  dowel: '#8b5cf6',
  minifix: '#06b6d4',
  shelfPin: '#22c55e',
  hinge: '#ef4444',
  runner: '#3b82f6',
  handle: '#94a3b8',
  leg: '#ec4899',
  facadeScrew: '#f97316',
}

export type RenderedDrillMarker = DrillMarker3D & { purpose: DrillPurpose }

/** Бетке жабыспай, сәл сыртқа шығу үшін, мм — әйтпесе z-fighting шығады. */
const SURFACE_LIFT = 0.4

/**
 * Бағыт әрқашан бірлік ось (±x/±y/±z, `drillGeometry.ts`) — сондықтан
 * дөңгелек жазықтығын дәл сол өске бұру ЖАЙ switch-пен шешіледі, quaternion
 * есептеудің қажеті жоқ.
 */
function markerRotation(direction: DrillMarker3D['direction']): [number, number, number] {
  if (direction.x !== 0) return [0, Math.PI / 2, 0]
  if (direction.y !== 0) return [Math.PI / 2, 0, 0]
  return [0, 0, 0]
}

export function DrillMarkers({ markers }: { markers: RenderedDrillMarker[] }) {
  if (markers.length === 0) return null
  return (
    <group>
      {markers.map((m, i) => {
        const radius = m.diameter / 2
        const lifted: [number, number, number] = [
          m.point.x - m.direction.x * SURFACE_LIFT,
          m.point.y - m.direction.y * SURFACE_LIFT,
          m.point.z - m.direction.z * SURFACE_LIFT,
        ]
        return (
          // Белгі тінтуірді ҰСТАМАЙДЫ: әйтпесе есікті ашу/таңдау үшін
          // басқанда белгінің өзі оқиғаны ұстап алар еді (PanelEdges-тегі
          // үлгімен бірдей).
          <mesh key={i} position={lifted} rotation={markerRotation(m.direction)} raycast={() => null}>
            <circleGeometry args={[radius, 20]} />
            {/* ⚠ R3F материал `key` гочасы (2026-09-20): `purpose` өзгерсе
                (сирек, бірақ HMR/қайта генерацияда болады) осы `key`
                материалды МӘЖБҮРЛЕП жаңартады — әйтпесе ескі түс қалып қояды. */}
            <meshBasicMaterial
              key={m.purpose}
              color={PURPOSE_COLOR[m.purpose]}
              toneMapped={false}
              side={DoubleSide}
              transparent
              opacity={0.92}
              depthWrite={false}
            />
            <Edges color="#1c1917" />
          </mesh>
        )
      })}
    </group>
  )
}
