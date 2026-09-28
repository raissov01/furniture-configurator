/**
 * Бұрыштық корпусты қосқанда e2e браузері «қатып» қалатын (09-24 аудит).
 *
 * Түбірі: drei `<Environment>`-тің `useLayoutEffect`-і `children`-ке тәуелді.
 * Lightformer-лер Scene-нің JSX-інде тұрғанда, Scene-нің ӘР қайта рендері
 * жаңа `children` береді де, орта кубы (6 бет) мен PMREM (бұлдырату тізбегі)
 * қайта саналады. GPU-сыз Chrome-да (SwiftShader) бір PMREM ~2–3 с; бұрыштық
 * режим Scene-ді бірнеше рет қайта рендерлейді — renderer ReadPixels-те
 * минуттап тұрып қалатын. Нақты GPU-да да әр рендерде бекер куб + PMREM.
 *
 * Тест нақты R3F тамырын жалған рендерермен жүргізеді: ата-ана қайта
 * рендерленгенде CubeCamera.update қайта шақырылмауы керек.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { createRequire } from 'node:module'
import { act, createRoot, extend, type ReconcilerRoot } from '@react-three/fiber'
import { SceneEnvironment } from '../components/SceneEnvironment'

/*
 * `@react-three/fiber`-де `exports` жоқ, сондықтан Node оны (drei арқылы да)
 * CJS күйінде жүктейді, ал ол `three.cjs`-ті алады. Каталог пен шпион сол
 * ДАНАДАН болуы керек, әйтпесе `instanceof Color` өтпей, түс жолға айналады.
 * `<Canvas>` жасайтын каталог тіркеуін Canvas-сыз тамырда өзіміз жасаймыз.
 */
const THREE = createRequire(import.meta.url)('three') as typeof import('three')
extend(THREE as never)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function fakeRenderer() {
  const noop = () => {}
  return {
    render: noop,
    setSize: noop,
    setPixelRatio: noop,
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: noop,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    dispose: noop,
    forceContextLoss: noop,
    autoClear: true,
    shadowMap: { enabled: false, type: 0, needsUpdate: false },
    xr: { enabled: false, isPresenting: false, addEventListener: noop, removeEventListener: noop, setAnimationLoop: noop },
    outputColorSpace: 'srgb',
    toneMapping: 0,
    domElement: fakeCanvas(),
  }
}

function fakeCanvas() {
  return {
    width: 100, height: 100, style: {},
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, left: 0 }),
    parentElement: null,
  } as unknown as HTMLCanvasElement
}

/** Scene сияқты: әр рендерде өзгеретін пропс, ішінде — орта. */
function Host({ tick, children }: { tick: number; children?: ReactNode }) {
  return createElement('group', { name: `tick-${tick}` }, children)
}

let root: ReconcilerRoot<HTMLCanvasElement> | null = null
afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  vi.restoreAllMocks()
})

describe('SceneEnvironment', () => {
  it('Scene қайта рендерленгенде орта кубы мен PMREM қайта саналмайды', async () => {
    const update = vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(() => {})
    root = createRoot(fakeCanvas())
    await root.configure({
      gl: fakeRenderer() as never,
      frameloop: 'never',
      size: { width: 100, height: 100, top: 0, left: 0 },
    })
    // Scene-дегідей: `<SceneEnvironment />` ата-ананың JSX-інде жаңадан жасалады.
    const view = (tick: number) => createElement(Host, { tick }, createElement(SceneEnvironment))
    await act(async () => root!.render(view(0)))
    expect(update).toHaveBeenCalledTimes(1)

    for (let tick = 1; tick <= 5; tick += 1) {
      await act(async () => root!.render(view(tick)))
    }
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('Scene ортаны тек мемо-компонент арқылы қосады', () => {
    const scene = readFileSync('components/Scene.tsx', 'utf8')
    expect(scene).toContain('<SceneEnvironment />')
    expect(scene).not.toMatch(/<Environment[\s>]/)
    expect(scene).not.toContain('<Lightformer')
  })
})
