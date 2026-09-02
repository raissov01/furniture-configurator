/**
 * Жинау реті мен материалдардың қолданылуы.
 *
 * Екеуі де «көрсету» үшін көрінеді, бірақ екеуі де ЦЕХТЫҢ шешіміне әсер
 * етеді: рет қате болса, жинаушы крышканы ерте қойып, ішіне қол жеткізе
 * алмайды; материал тізімі қате болса, ауыстырар алдында қай детальға
 * тиетінін білмейді.
 */
import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY_STAGE_NAMES, SEED_CATALOG, assemblySteps, findTemplate, generateCabinet,
  projectUsage, rolesLabel, templateToCabinet,
} from '../src/core/index'
import type { Panel } from '../src/core/index'

const panelsOf = (id: string): Panel[] =>
  generateCabinet(templateToCabinet(findTemplate(id)!, SEED_CATALOG), SEED_CATALOG)

const panels = panelsOf('wardrobe-rod-drawers-1600')
const steps = assemblySteps(panels)
const stepOf = (predicate: (p: Panel) => boolean) => {
  const panel = panels.find(predicate)!
  return steps.find((s) => s.panelId === panel.id)!
}

describe('жинау реті', () => {
  it('әр детальға бір қадам, нөмірлер үзіліссіз', () => {
    expect(steps).toHaveLength(panels.length)
    expect(steps.map((s) => s.step)).toEqual(panels.map((_, i) => i + 1))
  })

  it('дно — БІРІНШІ, крышка одан КЕЙІН', () => {
    expect(stepOf((p) => p.role === 'bottom').step).toBeLessThan(stepOf((p) => p.role === 'top').step)
    expect(stepOf((p) => p.role === 'bottom').step).toBe(1)
  })

  it('крышка бүйірлер мен перегородкалардан КЕЙІН тұрады', () => {
    const top = stepOf((p) => p.role === 'top').step
    for (const role of ['side', 'divider'] as const) {
      const panel = panels.find((p) => p.role === role)
      if (panel) expect(stepOf((p) => p.id === panel.id).step, role).toBeLessThan(top)
    }
  })

  it('фасад ЕҢ СОҢҒЫ кезеңде', () => {
    const fronts = steps.filter((s) => s.stage === 'front')
    expect(fronts.length).toBeGreaterThan(0)
    const lastOther = Math.max(...steps.filter((s) => s.stage !== 'front').map((s) => s.step))
    for (const front of fronts) expect(front.step).toBeGreaterThan(lastOther)
  })

  it('сөре мен ящик корпустан кейін, фасадтан бұрын', () => {
    const shelf = steps.find((s) => s.stage === 'movable')!
    const carcassLast = Math.max(...steps.filter((s) => s.stage === 'carcass').map((s) => s.step))
    expect(shelf.step).toBeGreaterThan(carcassLast)
  })

  it('бағыт панельдің жазықтығынан шығады', () => {
    expect(stepOf((p) => p.role === 'bottom').direction).toBe('снизу')
    expect(stepOf((p) => p.role === 'top').direction).toBe('сверху')
    expect(stepOf((p) => p.role === 'shelf').direction).toBe('сверху')
    expect(stepOf((p) => p.role === 'side').direction).toBe('слева')
    expect(stepOf((p) => p.role === 'front').direction).toBe('спереди')
    const back = panels.find((p) => p.role === 'back')
    if (back) expect(stepOf((p) => p.id === back.id).direction).toBe('сзади')
  })

  it('тесік саны панельдікімен бірдей', () => {
    for (const step of steps) {
      expect(step.holes).toBe(panels.find((p) => p.id === step.panelId)!.drilling.length)
    }
  })

  it('кезеңдердің аты толық', () => {
    for (const step of steps) expect(ASSEMBLY_STAGE_NAMES[step.stage]).toBeTruthy()
  })

  it('панельдер тізімі ӨЗГЕРМЕЙДІ', () => {
    const copy = [...panels]
    assemblySteps(panels)
    expect(panels).toEqual(copy)
  })
})

describe('материалдардың қолданылуы', () => {
  const usage = projectUsage(panels, SEED_CATALOG)

  it('деталь саны жобадағымен тең', () => {
    expect(usage.totalParts).toBe(panels.length)
    expect(usage.materials.reduce((sum, m) => sum + m.parts, 0)).toBe(panels.length)
  })

  it('аудан ГОТОВЫЙ өлшемнен саналады', () => {
    const total = panels.reduce((sum, p) => sum + p.finishedLength * p.finishedWidth, 0)
    expect(usage.materials.reduce((sum, m) => sum + m.area, 0)).toBe(total)
  })

  it('рет — ауданы бойынша кемумен', () => {
    const areas = usage.materials.map((m) => m.area)
    expect([...areas].sort((a, b) => b - a)).toEqual(areas)
  })

  it('әр материалда қай рөлде кездескені жазылады', () => {
    const carcass = usage.materials.find((m) => m.roles.includes('side'))!
    expect(rolesLabel(carcass)).toContain('боковина')
    expect(rolesLabel(carcass).length).toBeGreaterThan(0)
  })

  it('ең үлкен деталь шынымен ең үлкені', () => {
    for (const m of usage.materials) {
      const own = panels.filter((p) => p.materialId === m.materialId)
      const maxArea = Math.max(...own.map((p) => p.finishedLength * p.finishedWidth))
      expect(m.largest.length * m.largest.width).toBe(maxArea)
    }
  })

  it('кромка метрі деталировкамен келіседі', () => {
    const total = usage.edges.reduce((sum, e) => sum + e.metres, 0)
    let expected = 0
    for (const p of panels) {
      if (p.edges.L1) expected += p.finishedLength * 0.001
      if (p.edges.L2) expected += p.finishedLength * 0.001
      if (p.edges.W1) expected += p.finishedWidth * 0.001
      if (p.edges.W2) expected += p.finishedWidth * 0.001
    }
    expect(total).toBeCloseTo(expected, 6)
  })

  it('парақ саны БЕРІЛМЕЙДІ — оны тек раскрой біледі', () => {
    for (const m of usage.materials) {
      expect(m).not.toHaveProperty('sheets')
    }
  })
})
