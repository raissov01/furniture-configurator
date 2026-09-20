/**
 * K8 (audit C6 + C7): бұрыштық ас үй, солтүстік↔шығыс қатардың түйіскен жері.
 *
 * `kitchen.ts`-тегі `q` бұрыштағы модульдің КОРПУС тереңдігінен басталады,
 * ал соқыр панель (`frontPanel`) — накладной деталь, корпустың АЛДЫНДА тұр.
 * Сол қалыңдық есепке алынбаса:
 *
 *   C6 — ТӨМЕНГІ қатарда шығыс қатар СОҚЫР ПАНЕЛЬГЕ кіріп тұрады (қабаттасу).
 *   C7 — ҮСТІҢГІ қатарда шығыс қатар төменгінің q-ымен қойылады, ал үстіңгі
 *        тереңдік бөлек (320 vs 500) — саңылау қалады.
 *
 * Екі жағдайда да дұрыс формула біреу: шығыс қатардың бастапқы «ығысуы»
 * СОЛ қатардың өз тереңдігі + соқыр панельдің қалыңдығы болуы керек, ешбір
 * артық, ешбір кем.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, generateKitchen } from '../src/core/index'

const LENGTH_A = 3000
const LENGTH_B = 2000

const materialThickness = (id: string): number => {
  const m = SEED_CATALOG.materials.find((mat) => mat.id === id)
  if (!m) throw new Error(`материал табылмады: ${id}`)
  return m.thickness
}

describe('K8 / C6: төменгі қатар — соқыр панельге қабаттаспайды', () => {
  it('шығыс қатардың бірінші (бұрыштағы жақын) корпусы дәл '
    + 'depthAtStart + соқыр панель қалыңдығынан басталады', () => {
    const r = generateKitchen(
      { layout: 'corner', lengthA: LENGTH_A, lengthB: LENGTH_B, sink: true, upper: true, appliances: true },
      SEED_CATALOG,
    )
    const byId = new Map(r.cabinets.map((c) => [c.id, c]))

    // Бұрыштағы (солтүстік, offset 0) төменгі корпус — соқыр панельді мойка.
    const cornerPlacement = r.placements.find((p) => p.wall === 'north' && p.offset === 0 && !(p.elevation ?? 0))!
    const cornerCab = byId.get(cornerPlacement.cabinetId)!
    expect(cornerCab.frontPanel).toBeDefined()
    const panelThickness = materialThickness(cornerCab.frontMaterialId)

    // Шығыс қатардың бұрышқа ЕҢ ЖАҚЫН (offset ең үлкен) төменгі корпусы.
    const eastLower = r.placements
      .filter((p) => p.wall === 'east' && !(p.elevation ?? 0))
      .sort((a, b) => b.offset - a.offset)[0]!
    const eastLowerCab = byId.get(eastLower.cabinetId)!

    const expectedOffset = r.room.depth - (cornerCab.depth + panelThickness) - eastLowerCab.width
    expect(eastLower.offset).toBe(expectedOffset)

    // Ескі ақау: q = depthAtStart (панель қалыңдығысыз) — 16 мм артық
    // үлкен offset беретін, яғни корпус соқыр панельге КІРІП тұратын.
    const buggyOffset = r.room.depth - cornerCab.depth - eastLowerCab.width
    expect(eastLower.offset).not.toBe(buggyOffset)
    expect(buggyOffset - eastLower.offset).toBe(panelThickness)
  })
})

describe('K8 / C7: үстіңгі қатар — саңылаусыз, өз тереңдігінен', () => {
  it('шығыс қатардың бірінші үстіңгі корпусы солтүстіктің ҮСТІҢГІ '
    + 'тереңдігі + соқыр панель қалыңдығынан басталады (төменгінікінен ЕМЕС)', () => {
    const r = generateKitchen(
      { layout: 'corner', lengthA: LENGTH_A, lengthB: LENGTH_B, sink: true, upper: true, appliances: true },
      SEED_CATALOG,
    )
    const byId = new Map(r.cabinets.map((c) => [c.id, c]))

    const cornerUpperPlacement = r.placements
      .find((p) => p.wall === 'north' && p.offset === 0 && (p.elevation ?? 0) > 0)!
    const cornerUpperCab = byId.get(cornerUpperPlacement.cabinetId)!
    expect(cornerUpperCab.frontPanel).toBeDefined()
    const upperPanelThickness = materialThickness(cornerUpperCab.frontMaterialId)

    const eastUpper = r.placements
      .filter((p) => p.wall === 'east' && (p.elevation ?? 0) > 0)
      .sort((a, b) => b.offset - a.offset)[0]!
    const eastUpperCab = byId.get(eastUpper.cabinetId)!

    const expectedOffset = r.room.depth - (cornerUpperCab.depth + upperPanelThickness) - eastUpperCab.width
    expect(eastUpper.offset).toBe(expectedOffset)

    // Ескі ақау: үстіңгі қатар ТӨМЕНГІ қатардың q-ымен қойылатын
    // (depthAtStart негізінде, 500 мм), ал өз тереңдігі 320 мм — 164 мм-ге
    // жуық саңылау қалдыратын.
    const cornerLowerPlacement = r.placements
      .find((p) => p.wall === 'north' && p.offset === 0 && !(p.elevation ?? 0))!
    const cornerLowerCab = byId.get(cornerLowerPlacement.cabinetId)!
    const lowerPanelThickness = materialThickness(cornerLowerCab.frontMaterialId)
    const buggyOffset = r.room.depth - (cornerLowerCab.depth + lowerPanelThickness) - eastUpperCab.width
    expect(eastUpper.offset).not.toBe(buggyOffset)
    expect(eastUpper.offset - buggyOffset)
      .toBe((cornerLowerCab.depth + lowerPanelThickness) - (cornerUpperCab.depth + upperPanelThickness))
  })
})
