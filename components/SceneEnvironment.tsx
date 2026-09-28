'use client'

import { memo } from 'react'
import { Environment, Lightformer } from '@react-three/drei'

/**
 * ҚОРШАҒАН ОРТА: Lightformer-мен ОСЫ ЖЕРДЕ жасалады — желіден HDR
 * жүктелмейді (PWA офлайн жұмыс істейді). Онсыз болат, шыны, плита мен
 * лак ештеңені шағылыстырмай, сұр пластик болып көрінетін.
 *
 * ⚠ `memo` ӘДЕЙІ, пропссыз. drei `<Environment>`-тің `useLayoutEffect`-і
 * `children`-ке тәуелді: Lightformer-лер Scene-нің JSX-інде тұрғанда
 * Scene-нің ӘР қайта рендері жаңа `children` беріп, орта кубын (6 бет) және
 * PMREM-ді (бұлдырату тізбегі) қайта санатады. GPU-сыз Chrome-да бір PMREM
 * ~2–3 с — бұрыштық корпусты қосқанда (Scene бірнеше рет қайта рендерленеді)
 * бет минуттап қатып қалатын (09-24 аудит, e2e «Бұрыштық (переходной)»).
 * Мұнда ата-ана қайта рендерленсе де, бұл компонент рендерленбейді, орта бір
 * рет салынады. Пропс қосылса — тұрақты (примитив/мемо) болсын.
 *
 * `intensity` — PRO100 «Освещение» диалогының орта жарығы (сан, примитив).
 * drei `environmentIntensity`-ді тек `children` өзгергенде қолданады, сондықтан
 * ол өзгергенде ғана компонент қайта рендерленіп, орта бір рет қайта салынады.
 */
export const SceneEnvironment = memo(function SceneEnvironment({ intensity = 0.55 }: { intensity?: number }) {
  return (
    <Environment resolution={256} environmentIntensity={intensity}>
      <Lightformer form="rect" intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
      <Lightformer form="rect" intensity={1} position={[-7, 2, 3]} rotation={[0, Math.PI / 2, 0]} scale={[12, 3, 1]} />
      <Lightformer form="rect" intensity={1} position={[7, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} />
    </Environment>
  )
})
