'use client'

/**
 * ТЕХНИКАНЫҢ 3D КӨРІНІСІ: тоңазытқыш, духовка, СВЧ, посудомойка, мойка,
 * варочная панель, сорғыш.
 *
 * ⚠ Мұнда ЕШТЕҢЕ ОРНАЛАСТЫРЫЛМАЙДЫ: орны мен габариті ядродан
 * (`HardwarePlacement.size`, `hardware.ts`). Бұл компонент тек сол қораптың
 * ішіне нақты техникаға ұқсайтын пішін салады — сондықтан ол ешқашан
 * ұядан шығып кетпейді. Сандар — тек КӨРІНІС (тұтқаның жуандығы,
 * конфорканың радиусы): раскройға да, присадкаға да тимейді.
 *
 * Координаттың нөлі — габариттің ОРТАСЫ. Алды — ең кіші z (бөлмеге қарайды).
 *
 * Хук ЖОҚ (useFrame/useThree): тек пропс → меш. Canvas ішіндегі жаңа модуль
 * dev-режимде екі данада жүктелсе де, R3F контекстіне тәуелді емес.
 */

import type { HardwarePlacement, Vec3 } from '@/src/core/index'

export type ApplianceKindVisual = NonNullable<HardwarePlacement['appliance']>

const STEEL = '#cfd4d9'
const STEEL_DARK = '#7d858c'
const BLACK_GLASS = '#15181b'
const PANEL_DARK = '#272b30'
const INTERIOR = '#e8ecef'

function Steel({ color = STEEL }: { color?: string }) {
  // Металдық ТӨМЕН: қоршаған орта картасы жоқ сахнада металл қарайып кетеді
  // (0.5-те тоңазытқыштың есігі қара-сұр болып көрінді).
  return <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
}

function Glass({ color = BLACK_GLASS }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.12} metalness={0.25} />
}

function Matte({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
}

/** Дисплейдің жарығы — тек эмиссив, нақты жарық көзі емес. */
function Display({ w, h, position }: { w: number; h: number; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[w, h, 1]} />
      <meshStandardMaterial color="#0b2a1f" emissive="#57e0a8" emissiveIntensity={0.8} toneMapped={false} />
    </mesh>
  )
}

/** Рейлинг-тұтқа: екі аяқ + ұстағыш. `position` — фасадтың бетіндегі ортасы. */
function BarHandle({ length, vertical = false, position }: {
  length: number
  vertical?: boolean
  position: [number, number, number]
}) {
  const standoff = 28
  const end = length / 2 - 15
  return (
    <group position={position}>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={vertical ? [0, s * end, -standoff / 2] : [s * end, 0, -standoff / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[5, 5, standoff, 10]} />
          <Steel />
        </mesh>
      ))}
      <mesh position={[0, 0, -standoff]} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[7, 7, length, 16]} />
        <Steel />
      </mesh>
    </group>
  )
}

/** Тоңазытқыш: астында мұздатқыш, екі есік те СОЛ жиектегі ілгекпен ашылады. */
function Fridge({ size, openness }: { size: Vec3; openness: number }) {
  const { x: W, y: H, z: D } = size
  const face = -D / 2
  const doorT = 40
  const gap = 6
  const freezerH = Math.round(H * 0.38)
  const upperH = H - freezerH - gap
  const angle = openness * ((100 * Math.PI) / 180)
  const doorW = W - 4

  const door = (key: string, h: number, y0: number, handleY: number) => (
    // Ось есіктің сол жиегінде: оң бағытта бұрылғанда есік бөлмеге шығады.
    <group key={key} position={[-W / 2, 0, face]} rotation={[0, angle, 0]}>
      <group position={[W / 2, 0, 0]}>
        <mesh position={[0, y0 + h / 2, doorT / 2]} castShadow receiveShadow>
          <boxGeometry args={[doorW, h, doorT]} />
          <Steel />
        </mesh>
        <BarHandle vertical length={Math.min(520, h * 0.55)} position={[doorW / 2 - 45, handleY, 0]} />
      </group>
    </group>
  )

  return (
    <group>
      {/* Корпусы: есік ашылғанда ақ ішкі камерасы көрінеді. */}
      <mesh position={[0, 0, doorT / 2]} receiveShadow>
        <boxGeometry args={[W - 6, H, D - doorT]} />
        <Matte color={INTERIOR} />
      </mesh>
      {/* Шыны сөрелер — тек есік ашылғанда көрінеді. */}
      {[0.35, 0.55, 0.75].map((k) => (
        <mesh key={k} position={[0, -H / 2 + freezerH + gap + upperH * k, face + doorT + 1]}>
          <boxGeometry args={[W - 40, 5, 2]} />
          <Glass color="#9fb2bd" />
        </mesh>
      ))}
      {door('freezer', freezerH, -H / 2, -H / 2 + freezerH * 0.7)}
      {door('fridge', upperH, -H / 2 + freezerH + gap, -H / 2 + freezerH + gap + upperH * 0.3)}
    </group>
  )
}

/** Духовка: қара шыны есік, терезе, үстінде басқару жолағы; есік ТӨМЕН ашылады. */
function Oven({ size, openness }: { size: Vec3; openness: number }) {
  const { x: W, y: H, z: D } = size
  const face = -D / 2
  const strip = Math.min(90, H * 0.15)
  const doorH = H - strip - 6
  const doorT = 30
  const angle = openness * ((80 * Math.PI) / 180)
  const stripY = H / 2 - strip / 2

  return (
    <group>
      <mesh position={[0, 0, doorT / 2]}>
        <boxGeometry args={[W - 6, H, D - doorT]} />
        <Matte color={PANEL_DARK} />
      </mesh>
      {/* Басқару жолағы: екі тетік пен дисплей. */}
      <mesh position={[0, stripY, face + doorT / 2]} castShadow>
        <boxGeometry args={[W - 6, strip, doorT]} />
        <Glass color="#1f2327" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 70), stripY, face - 9]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[17, 17, 18, 24]} />
          <Steel />
        </mesh>
      ))}
      <Display w={90} h={26} position={[0, stripY, face - 0.6]} />
      {/* Есік астыңғы жиегінің айналасында бөлмеге қарай құлайды. */}
      <group position={[0, -H / 2, face]} rotation={[-angle, 0, 0]}>
        <mesh position={[0, doorH / 2, doorT / 2]} castShadow>
          <boxGeometry args={[W - 6, doorH, doorT]} />
          <Glass />
        </mesh>
        <mesh position={[0, doorH * 0.5, -0.3]}>
          <boxGeometry args={[W * 0.76, doorH * 0.56, 0.5]} />
          <Matte color="#3a3f45" />
        </mesh>
        <mesh position={[0, doorH * 0.5, -0.7]}>
          <boxGeometry args={[W * 0.7, doorH * 0.5, 0.5]} />
          <Glass color="#07090b" />
        </mesh>
        <BarHandle length={W * 0.8} position={[0, doorH - 40, 0]} />
      </group>
    </group>
  )
}

/** Микротолқынды пеш: сол жақта терезе, оң жақта басқару тақтасы. */
function Microwave({ size }: { size: Vec3 }) {
  const { x: W, y: H, z: D } = size
  const face = -D / 2
  const panelW = W * 0.24
  const panelX = W / 2 - panelW / 2 - 10
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[W - 6, H - 4, D]} />
        <Glass color="#1b1e22" />
      </mesh>
      <mesh position={[-W * 0.12, 0, face - 0.3]}>
        <boxGeometry args={[W * 0.64, H * 0.72, 0.5]} />
        <Matte color="#33383e" />
      </mesh>
      <mesh position={[-W * 0.12, 0, face - 0.7]}>
        <boxGeometry args={[W * 0.58, H * 0.62, 0.5]} />
        <Glass color="#06080a" />
      </mesh>
      <mesh position={[panelX, 0, face - 0.5]}>
        <boxGeometry args={[panelW, H * 0.82, 1]} />
        <Matte color={PANEL_DARK} />
      </mesh>
      <Display w={panelW * 0.7} h={22} position={[panelX, H * 0.28, face - 1.2]} />
      <mesh position={[panelX, -H * 0.15, face - 8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[18, 18, 14, 24]} />
        <Steel />
      </mesh>
    </group>
  )
}

/** Посудомойка: болат фасад, үстінде басқару жолағы мен тұтқа. */
function Dishwasher({ size }: { size: Vec3 }) {
  const { x: W, y: H, z: D } = size
  const face = -D / 2
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[W - 4, H, D]} />
        <Steel color="#d9dde1" />
      </mesh>
      <mesh position={[0, H / 2 - 32, face - 1]}>
        <boxGeometry args={[W - 4, 60, 2]} />
        <Matte color={PANEL_DARK} />
      </mesh>
      <Display w={80} h={18} position={[W / 4, H / 2 - 32, face - 2.2]} />
      <BarHandle length={W * 0.6} position={[0, H / 2 - 95, face]} />
    </group>
  )
}

/**
 * Мойка: столешницаның ҮСТІНДЕГІ борты, күңгірт шарасы, ағызғышы және краны.
 * Габариттің астыңғы жазықтығы — столешницаның беті.
 */
/** Кран доғасының радиусы, мм: шүмек құбырдан 2R алға шығады. */
const SPOUT_R = 85

function Sink({ size }: { size: Vec3 }) {
  const { x: W, y: H, z: D } = size
  const s = -H / 2
  const rim = 3
  const bowl = { w: W - 60, d: D - 60 }
  const back = D / 2 - 40
  const pipeH = 230
  const top = s + rim + 30 + pipeH
  return (
    <group>
      <mesh position={[0, s + rim / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, rim, D]} />
        <Steel />
      </mesh>
      <mesh position={[0, s + rim + 0.5, 0]} receiveShadow>
        <boxGeometry args={[bowl.w, 1, bowl.d]} />
        <meshStandardMaterial color="#737b82" roughness={0.45} metalness={0.5} />
      </mesh>
      {/* Шараның ішкі жиегі — тереңдік әсерін беретін қараңғы жолақ. */}
      {[
        { p: [0, bowl.d / 2 - 6] as const, a: [bowl.w, 12] as const },
        { p: [0, -bowl.d / 2 + 6] as const, a: [bowl.w, 12] as const },
        { p: [bowl.w / 2 - 6, 0] as const, a: [12, bowl.d] as const },
        { p: [-bowl.w / 2 + 6, 0] as const, a: [12, bowl.d] as const },
      ].map((e, i) => (
        <mesh key={i} position={[e.p[0], s + rim + 1.2, e.p[1]]}>
          <boxGeometry args={[e.a[0], 0.5, e.a[1]]} />
          <meshStandardMaterial color="#4f565c" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, s + rim + 1.4, 0]}>
        <cylinderGeometry args={[24, 24, 1, 24]} />
        <Matte color="#2e3338" />
      </mesh>
      {/* Кран: табан, тік құбыр, «қаз мойын» доғасы, шүмек, тетік. */}
      <mesh position={[0, s + rim + 15, back]} castShadow>
        <cylinderGeometry args={[20, 22, 30, 20]} />
        <Steel />
      </mesh>
      <mesh position={[0, s + rim + 30 + pipeH / 2, back]} castShadow>
        <cylinderGeometry args={[11, 11, pipeH, 16]} />
        <Steel />
      </mesh>
      {/*
        Жарты тор — құбырдың ұшынан мойканың ортасына қарай иілген доға.
        Y бойынша 90° бұрылғанда тордың сақинасы YZ жазықтығына түседі:
        артқы ұшы құбырдың үстінде, алдыңғысы шүмектің үстінде.
      */}
      <mesh position={[0, top, back - SPOUT_R]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[SPOUT_R, 10, 12, 32, Math.PI]} />
        <Steel />
      </mesh>
      <mesh position={[0, top - 15, back - 2 * SPOUT_R]} castShadow>
        <cylinderGeometry args={[12, 12, 30, 16]} />
        <Steel />
      </mesh>
      <mesh position={[0, s + rim + 110, back + 22]} rotation={[-0.5, 0, 0]} castShadow>
        <boxGeometry args={[12, 10, 70]} />
        <Steel />
      </mesh>
    </group>
  )
}

/** Конфорканың орны мен радиусы: алды (−z) — оң жақта кішісі. */
const BURNERS: [number, number, number][] = [
  [-0.25, -0.24, 44],
  [0.25, -0.24, 32],
  [-0.25, 0.24, 36],
  [0.25, 0.24, 40],
]

/** Варочная панель: газда — конфорка мен шойын тор, электрде — шыныдағы шеңбер. */
function Hob({ size, gas }: { size: Vec3; gas: boolean }) {
  const { x: W, y: H, z: D } = size
  const s = -H / 2
  const plate = 5
  const grateY = s + H - 4
  return (
    <group>
      <mesh position={[0, s + plate / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, plate, D]} />
        <Glass />
      </mesh>
      {BURNERS.map(([kx, kz, r], i) => {
        const x = kx * W
        const z = kz * D
        return gas ? (
          <group key={i}>
            <mesh position={[x, s + plate + 4, z]} castShadow>
              <cylinderGeometry args={[r, r, 8, 28]} />
              <Steel color="#3a3d40" />
            </mesh>
            <mesh position={[x, s + plate + 11, z]}>
              <cylinderGeometry args={[r * 0.6, r * 0.6, 6, 28]} />
              <Matte color="#121314" />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={[x, s + plate + 0.2, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r * 1.1, r * 1.5, 48]} />
            <meshStandardMaterial color="#5a2a24" emissive="#2a0b06" roughness={0.3} />
          </mesh>
        )
      })}
      {gas ? (
        <>
          {/* Шойын тор: екі жартысы, әрқайсысы рама + айқыш. */}
          {[-1, 1].map((side) => {
            const cx = side * W / 4
            const gw = W / 2 - 24
            const gd = D - 36
            return (
              <group key={side}>
                {[
                  [cx, grateY, -gd / 2, gw, 8],
                  [cx, grateY, gd / 2, gw, 8],
                  [cx, grateY, 0, gw, 8],
                ].map(([x, y, z, w, d], i) => (
                  <mesh key={`h${i}`} position={[x!, y!, z!]} castShadow>
                    <boxGeometry args={[w!, 8, d!]} />
                    <Matte color="#1c1c1c" />
                  </mesh>
                ))}
                {[cx - gw / 2 + 4, cx, cx + gw / 2 - 4].map((x, i) => (
                  <mesh key={`v${i}`} position={[x, grateY, 0]} castShadow>
                    <boxGeometry args={[8, 8, gd]} />
                    <Matte color="#1c1c1c" />
                  </mesh>
                ))}
              </group>
            )
          })}
          {/* Тетіктер алдыңғы жиекте. */}
          {[-0.36, -0.12, 0.12, 0.36].map((k) => (
            <mesh key={k} position={[k * W, s + plate + 8, -D / 2 + 22]} castShadow>
              <cylinderGeometry args={[13, 13, 16, 20]} />
              <Steel color="#b7bcc1" />
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, s + plate + 0.3, -D / 2 + 30]}>
          <boxGeometry args={[W * 0.5, 0.5, 26]} />
          <Matte color="#3a4046" />
        </mesh>
      )}
    </group>
  )
}

/** Сорғыш: күмбезі, мұржасы, астында екі шамы. Арты — қабырғада. */
function Hood({ size }: { size: Vec3 }) {
  const { x: W, y: H, z: D } = size
  const bottom = -H / 2
  const canopy = 60
  const taper = 90
  const chimneyH = H - canopy - taper
  return (
    <group>
      <mesh position={[0, bottom + canopy / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, canopy, D]} />
        <Steel />
      </mesh>
      <mesh position={[0, bottom + canopy + taper / 2, D / 2 - D * 0.3]} castShadow>
        <boxGeometry args={[W * 0.55, taper, D * 0.6]} />
        <Steel />
      </mesh>
      <mesh position={[0, bottom + canopy + taper + chimneyH / 2, D / 2 - 115]} castShadow>
        <boxGeometry args={[260, chimneyH, 230]} />
        <Steel />
      </mesh>
      <mesh position={[0, bottom - 0.3, 0]}>
        <boxGeometry args={[W - 40, 0.5, D - 40]} />
        <Steel color={STEEL_DARK} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * W / 4, bottom - 0.8, -D / 8]}>
          <cylinderGeometry args={[22, 22, 1, 20]} />
          <meshStandardMaterial color="#fff6dd" emissive="#fff0c8" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function ApplianceMesh({ kind, size, openness }: {
  kind: ApplianceKindVisual
  size: Vec3
  /** 0 — жабық, 1 — толық ашық (тоңазытқыш пен духовканың есігі). */
  openness: number
}) {
  switch (kind) {
    case 'fridge': return <Fridge size={size} openness={openness} />
    case 'oven': return <Oven size={size} openness={openness} />
    case 'microwave': return <Microwave size={size} />
    case 'dishwasher': return <Dishwasher size={size} />
    case 'sink': return <Sink size={size} />
    case 'hobGas': return <Hob size={size} gas />
    case 'hobElectric': return <Hob size={size} gas={false} />
    case 'hood': return <Hood size={size} />
  }
}
