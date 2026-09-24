/**
 * Store тарихының инварианттары, кездейсоқ тізбекпен: ағаш операциялары,
 * қабаттар және ескі шкаф редакторы араласа жүргенде әр undo алдыңғы күйді
 * (root, layers, room) ДӘЛ қайтарады, redo — келесісін; ескі `cabinets`/
 * `placements` проекциясы әрқашан root-тан туады; ешбір әрекет күйді орнында
 * өзгертпейді (күй мұздатылған — өзгертсе, strict mode қате лақтырады).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flattenTree, parseProjectV4, walkTree } from '../src/core/index'
import { ConfigValidationError } from '../src/core/errors'
import { useConfigurator } from '../store/configurator'
import { cabinetsFromTree } from '../store/treeAdapters'
import { referenceProject, threeSectionProject } from './fixtures'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

function rng(seed: number): () => number {
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
}
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}
const freezeState = () => {
  const s = useConfigurator.getState()
  for (const value of [s.root, s.layers, s.cabinets, s.placements, s.room, s.past, s.future]) freeze(value)
}
const view = () => {
  const s = useConfigurator.getState()
  return JSON.stringify({ root: s.root, layers: s.layers, room: s.room, name: s.projectName })
}
const expectDerived = (label: string) => {
  const s = useConfigurator.getState()
  const derived = cabinetsFromTree(s.root, s.room, s.layers)
  expect(s.cabinets, label).toEqual(derived.cabinets)
  expect(s.placements, label).toEqual(derived.placements)
}

describe('store тарихының инварианттары', () => {
  it('undo/redo кездейсоқ тізбектен кейін күйді дәл қайтарады', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed)
      const file = freeze(parseProjectV4({ ...referenceProject,
        cabinets: [...referenceProject.cabinets, ...threeSectionProject.cabinets.map((c) => ({ ...c, id: `${c.id}-b` }))],
        placements: [...referenceProject.placements,
          ...threeSectionProject.placements.map((p) => ({ ...p, cabinetId: `${p.cabinetId}-b`, wall: 'east' as const }))] }))
      useConfigurator.getState().loadProject(file)
      useConfigurator.setState({ past: [], future: [] })
      const states = [view()]
      let groupSeq = 0
      for (let step = 0; step < 30; step++) {
        // Кейде ортада бір қадам қайтарамыз: келесі өзгеріс redo-ны өшіруі керек.
        if (states.length > 1 && r() < 0.1) {
          freezeState()
          useConfigurator.getState().undo()
          states.pop()
          expect(view()).toBe(states[states.length - 1])
          continue
        }
        const s = useConfigurator.getState()
        const all: string[] = []
        const groups: string[] = []
        walkTree(s.root, (node) => {
          if (node.id !== s.root.id) all.push(node.id)
          if (node.kind === 'group') groups.push(node.id)
        })
        const pick = () => all[Math.floor(r() * all.length)]!
        const anyCabinet = () => s.cabinets[Math.floor(r() * s.cabinets.length)]
        const anyLayer = () => s.layers[Math.floor(r() * s.layers.length)]
        const op = Math.floor(r() * 15)
        freezeState()
        const before = view()
        const pastBefore = s.past.length
        try {
          if (op === 0) s.reparent(pick(), groups[Math.floor(r() * groups.length)]!)
          else if (op === 1) {
            const id = pick()
            let siblings: string[] = []
            walkTree(s.root, (node) => { if (node.kind === 'group' && node.children.some((c) => c.id === id)) siblings = node.children.map((c) => c.id) })
            s.groupSelected(siblings.slice(0, 2), `grp-${seed}-${groupSeq++}`, 'G')
          } else if (op === 2) s.ungroup(groups[Math.floor(r() * groups.length)]!)
          else if (op === 3) s.setNodeHidden(pick(), r() < 0.5)
          else if (op === 4) s.setNodeLocked(pick(), r() < 0.3)
          else if (op === 5) {
            const cabinet = anyCabinet()
            if (!cabinet) continue
            s.setActive(cabinet.id)
            useConfigurator.getState().edit(`width-${step}`, { width: 1500 + Math.floor(r() * 20) * 10 })
          } else if (op === 6) s.editRoom({ width: s.room.width + (r() < 0.5 ? 100 : -100) })
          else if (op === 7) s.renameNode(pick(), `name-${step}`)
          else if (op === 8) {
            const placement = s.placements[Math.floor(r() * s.placements.length)]
            if (!placement) continue
            s.movePlacement(placement.cabinetId, { offset: Math.max(0, placement.offset + 10) })
          } else if (op === 9) s.addCabinet()
          else if (op === 10) { const cabinet = anyCabinet(); if (!cabinet) continue; s.duplicateCabinet(cabinet.id) }
          else if (op === 11) { const cabinet = anyCabinet(); if (!cabinet) continue; s.removeCabinet(cabinet.id) }
          else if (op === 12) {
            if (s.layers.length < 3) s.createLayer(`L${step}`)
            else s.assignNodeLayer(pick(), anyLayer()!.id)
          } else if (op === 13) {
            const layer = anyLayer()
            if (!layer) continue
            if (r() < 0.5) s.setLayerVisible(layer.id, !layer.visible)
            else s.setLayerLocked(layer.id, !layer.locked)
          } else { const layer = anyLayer(); if (!layer) continue; s.deleteLayer(layer.id) }
        } catch (error) {
          if (!(error instanceof ConfigValidationError)) throw error
          expect(view()).toBe(before)
          continue
        }
        // Слайдер біріктіруі (coalesce) бұл тестте әр қимылды бөлек қадам етеді.
        useConfigurator.setState({ lastEditKey: null })
        const after = useConfigurator.getState()
        if (after.past.length === pastBefore) { expect(view()).toBe(before); continue }
        expect(after.future).toEqual([])
        states.push(view())
        const ids: string[] = []
        walkTree(after.root, (node) => ids.push(node.id))
        expect(new Set(ids).size).toBe(ids.length)
        expectDerived(`seed ${seed} step ${step} op ${op}`)
        try {
          flattenTree(after.root, after.catalog, after.projectSettings, after.layers)
        } catch (error) {
          if (!(error instanceof ConfigValidationError)) throw error
        }
      }
      for (let i = states.length - 1; i > 0; i--) {
        expect(view(), `seed ${seed}: undo → ${i}`).toBe(states[i])
        freezeState()
        useConfigurator.getState().undo()
        expectDerived(`seed ${seed}: undo → ${i - 1}`)
      }
      expect(view()).toBe(states[0])
      for (let i = 1; i < states.length; i++) {
        useConfigurator.getState().redo()
        expect(view(), `seed ${seed}: redo → ${i}`).toBe(states[i])
        expectDerived(`seed ${seed}: redo → ${i}`)
      }
    }
  })
})
