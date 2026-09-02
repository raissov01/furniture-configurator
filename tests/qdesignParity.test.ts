/**
 * qdesign-нің присадка схемасымен теңесу.
 *
 * Бұл жердегі сандардың бәрі олардың CNC экспортынан оқылған (2026-09-02,
 * модуль 517 × 1540 × 298). Мұнда «әдемі ме» деген сұрақ жоқ: цехтың станогы
 * дәл сол тесіктерді бұрғылауы керек, сондықтан тест те дәл сол схеманы
 * ұстайды.
 */
import { describe, expect, it } from 'vitest'
import {
  LEG_SCREW_SQUARE, RUNNER_TANDEM_OFFSETS,
  SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const build = (patch: Partial<CabinetConfig> = {}, template = 'kitchen-base-drawers-600'): Panel[] => {
  const config = templateToCabinet(findTemplate(template)!, SEED_CATALOG)
  return generateCabinet({ ...config, ...patch }, SEED_CATALOG)
}

describe('конфирмат', () => {
  const panels = build({}, 'wardrobe-penal-600')
  const holes = panels.flatMap((p) => p.drilling).filter((d) => d.purpose === 'confirmat')

  it('бетте Ø8 ӨТПЕЛІ, торцта Ø5 × 35 пилот', () => {
    const face = holes.filter((d) => !d.face.startsWith('edge'))
    const edge = holes.filter((d) => d.face.startsWith('edge'))
    expect(face.length).toBeGreaterThan(0)
    expect(edge).toHaveLength(face.length)
    for (const d of face) expect(d.diameter).toBe(8)
    for (const d of edge) {
      expect(d.diameter).toBe(5)
      expect(d.depth).toBe(35)
    }
  })

  it('беттегі тесік торцтағыдан ҮЛКЕН — бұранда одан өтуі керек', () => {
    const face = holes.find((d) => !d.face.startsWith('edge'))!
    const edge = holes.find((d) => d.face.startsWith('edge'))!
    expect(face.diameter).toBeGreaterThan(edge.diameter)
  })
})

describe('направляющая: Blum Tandem схемасы', () => {
  const panels = build()
  const side = panels.find((p) => p.id === 'side-left')!
  const runner = side.drilling.filter((d) => d.purpose === 'runner')

  it('Ø3 × 3 пилот', () => {
    expect(runner.length).toBeGreaterThan(0)
    for (const d of runner) {
      expect(d.diameter).toBe(3)
      expect(d.depth).toBe(3)
    }
  })

  it('32 мм жүйесі: аралықтары 64, 64, 32', () => {
    const ys = [...new Set(runner.map((d) => d.y))].sort((a, b) => a - b)
    // Бір ящикте төрт нүкте болады; бірнеше ящикте олар қайталанады.
    const gaps: number[] = []
    for (let i = 1; i < Math.min(ys.length, RUNNER_TANDEM_OFFSETS.length); i += 1) {
      gaps.push(ys[i]! - ys[i - 1]!)
    }
    expect(gaps.slice(0, 3)).toEqual([64, 64, 32])
  })

  it('тесік панельдің ІШКІ бетінде', () => {
    for (const d of runner) expect(d.face).toBe('inner')
  })
})

describe('аяқтардың бұрандасы', () => {
  const withLegs = build({ base: { kind: 'legs', height: 100 } })
  const bottom = withLegs.find((p) => p.id === 'bottom')!
  const legHoles = bottom.drilling.filter((d) => d.diameter === 3 && d.depth === 3)

  it('әр аяққа ТӨРТ бұранда, дноның АСТЫҢҒЫ бетіне', () => {
    expect(legHoles.length).toBeGreaterThanOrEqual(8)
    expect(legHoles.length % 4).toBe(0)
    for (const d of legHoles) expect(d.face).toBe('outer')
  })

  it('төрт бұранда 65 × 65 мм шаршы жасайды', () => {
    const xs = [...new Set(legHoles.map((d) => d.x))].sort((a, b) => a - b)
    const ys = [...new Set(legHoles.map((d) => d.y))].sort((a, b) => a - b)
    expect(xs[1]! - xs[0]!).toBe(LEG_SCREW_SQUARE)
    expect(ys[1]! - ys[0]!).toBe(LEG_SCREW_SQUARE)
  })

  it('аяқсыз корпуста бұл тесіктер ЖОҚ', () => {
    const plinth = build({ base: { kind: 'plinth', height: 100 } })
    const bottomPanel = plinth.find((p) => p.id === 'bottom')!
    expect(bottomPanel.drilling.filter((d) => d.diameter === 3 && d.depth === 3)).toEqual([])
  })

  it('тесік дноның шегінен шықпайды', () => {
    for (const d of legHoles) {
      expect(d.x).toBeGreaterThan(0)
      expect(d.x).toBeLessThan(bottom.cutLength)
      expect(d.y).toBeGreaterThan(0)
      expect(d.y).toBeLessThan(bottom.cutWidth)
    }
  })
})
