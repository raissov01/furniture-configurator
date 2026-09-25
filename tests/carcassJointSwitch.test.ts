import { describe, expect, it } from 'vitest'
import { countHardware, generateCabinet, migrateV3ToV4, parseProjectV4 } from '../src/core/index'
import { catalog, oneSection, referenceProject, referenceWardrobe, withCabinet } from './fixtures'

const jointHoles = (kind: 'confirmat' | 'minifix') => {
  const config = withCabinet({ carcassJoint: kind, sections: oneSection({ contents: [{ kind: 'shelves', count: 1, shelfKind: 'fixed' }] }) })
  return generateCabinet(config, catalog)
}

describe('корпус бекіткішін ауыстыру', () => {
  it('конфирмат ↔ минификс барлық корпус және тұрақты сөре буындарының присадкасын бірге ауыстырады', () => {
    const baseline = jointHoles('confirmat')
    const switched = jointHoles('minifix')
    expect(switched.map((p) => [p.id, p.finishedLength, p.finishedWidth, p.cutLength, p.cutWidth]))
      .toEqual(baseline.map((p) => [p.id, p.finishedLength, p.finishedWidth, p.cutLength, p.cutWidth]))
    for (const panel of switched.filter((p) => ['side', 'top', 'bottom', 'divider', 'shelf'].includes(p.role))) {
      expect(panel.drilling.some((d) => d.purpose === 'confirmat'), panel.id).toBe(false)
    }
    expect(switched.flatMap((p) => p.drilling).filter((d) => d.purpose === 'minifix').length).toBeGreaterThan(0)
    expect(switched.find((p) => p.role === 'shelf')!.drilling.some((d) => d.purpose === 'minifix')).toBe(true)
    expect(countHardware(switched).get('minifix-15')).toBeGreaterThan(0)
    expect(countHardware(switched).get('confirmat-7x50') ?? 0).toBe(0)
    expect(jointHoles('confirmat')).toEqual(baseline)
  })

  it('v4 JSON бұл таңдауды сақтайды, ал бұрынғы жоба әдепкі конфирматты сақтайды', () => {
    const old = generateCabinet(referenceWardrobe, catalog)
    const project = migrateV3ToV4(structuredClone(referenceProject))
    const node = project.root.children.find((item) => item.kind === 'cabinet')
    if (!node || node.kind !== 'cabinet') throw new Error('cabinet node жоқ')
    node.config.carcassJoint = 'minifix'
    const reopened = parseProjectV4(JSON.parse(JSON.stringify(project)))
    const reopenedNode = reopened.root.children.find((item) => item.kind === 'cabinet')
    if (!reopenedNode || reopenedNode.kind !== 'cabinet') throw new Error('reopened cabinet node жоқ')
    expect(reopenedNode.config.carcassJoint).toBe('minifix')
    expect(generateCabinet(reopenedNode.config, catalog).flatMap((p) => p.drilling).some((d) => d.purpose === 'minifix')).toBe(true)
    expect(generateCabinet(referenceWardrobe, catalog)).toEqual(old)
  })

  it('екінші құрастыру тәсілінде де минификс ұясы торц панелінде, штифт тесігі бет панелінде', () => {
    const panels = generateCabinet(withCabinet({ construction: 'topBottomOverlay', carcassJoint: 'minifix' }), catalog)
    const side = panels.find((p) => p.id === 'side-left')!
    const top = panels.find((p) => p.id === 'top')!
    expect(side.drilling.some((d) => d.purpose === 'minifix' && d.diameter === 15 && d.depth === 12.7)).toBe(true)
    expect(top.drilling.some((d) => d.purpose === 'minifix' && d.diameter === 5 && d.depth === 13)).toBe(true)
    expect(panels.flatMap((p) => p.drilling).some((d) => d.purpose === 'confirmat')).toBe(false)
  })
})
