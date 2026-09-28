/**
 * «Свойства» диалогының мінезі (P0-3): сыртқа басу өзгерісті ЖОЙМАЙДЫ,
 * Enter = OK, Esc = Отмена, «Применить» тек өзгеріс болғанда, жарамсыз
 * мән өрісте белгіленіп, себебі жазылады, OK бұғатталады.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { PropertiesDialog } from '../components/PropertiesDialog'
import { capturePropertiesSession } from '../lib/propertiesSession'
import { propertiesDirty, propertiesInvalid, propertiesKeyAction, propertiesProductionReady, propertiesChildModalActive, childExportAllowed, selectionPropertiesNotice } from '../lib/propertiesDialogState'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const original = useConfigurator.getState().exportProject()
const initialSnapshot = useConfigurator.getInitialState()
const originalInitialSnapshot = { ...initialSnapshot }
afterEach(() => { Object.assign(initialSnapshot, originalInitialSnapshot); useConfigurator.getState().loadProject(original) })

const widthError = { field: 'cabinet.width', message: 'cabinet.width: 5000 мм (рұқсат етілген: 100..4000 мм)', allowed: '100..4000 мм' }

function render(error: typeof widthError | null) {
  useConfigurator.getState().loadProject(referenceProject)
  const state = useConfigurator.getState()
  Object.assign(initialSnapshot, state)
  return renderToString(createElement(PropertiesDialog, {
    nodeId: state.activeId, catalog: state.catalog, panels: [], error, onClose: () => undefined,
  }))
}

const buttonTag = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''

describe('properties dialog state', () => {
  it('is clean right after opening and dirty after a real edit', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const baseline = capturePropertiesSession()
    expect(propertiesDirty(baseline, capturePropertiesSession())).toBe(false)
    const state = useConfigurator.getState()
    const cabinet = state.cabinets.find((entry) => entry.id === state.activeId)!
    state.edit('width', { width: cabinet.width + 100 })
    expect(propertiesDirty(baseline, capturePropertiesSession())).toBe(true)
  })

  it('treats the "show dimensions" toggle as a change that Cancel reverts', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const baseline = capturePropertiesSession()
    useConfigurator.getState().setShowDimensions(!baseline.showDimensions)
    expect(propertiesDirty(baseline, capturePropertiesSession())).toBe(true)
  })

  it('any edited slice (tree, layers, room, materials…) counts as a change', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const baseline = capturePropertiesSession()
    for (const key of ['root', 'layers', 'room', 'cabinets', 'placements', 'catalog', 'projectInfo', 'priceOverrides'] as const) {
      expect(propertiesDirty(baseline, { ...baseline, [key]: Array.isArray(baseline[key]) ? [...(baseline[key] as unknown[])] : { ...(baseline[key] as object) } }), key).toBe(true)
    }
  })

  it('ignores history bookkeeping (past/future) when deciding dirtiness', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const baseline = capturePropertiesSession()
    expect(propertiesDirty(baseline, { ...baseline, past: [], future: [], lastEditKey: 'x', lastEditAt: 1 })).toBe(false)
  })

  it('explains an invalid width with a readable label and range', () => {
    expect(propertiesInvalid(widthError)).toEqual({ field: 'cabinet.width', label: 'Ширина (W)', detail: '5000 мм', allowed: '100..4000 мм' })
    expect(propertiesInvalid({ field: 'fronts.count', message: 'fronts.count: 9', allowed: undefined }))
      .toEqual({ field: 'fronts.count', label: 'fronts.count', detail: '9', allowed: undefined })
    expect(propertiesInvalid(null)).toBeNull()
  })

  it('maps keys: Enter = OK, Esc = Cancel, Enter on buttons/selects/textarea is native', () => {
    expect(propertiesKeyAction({ key: 'Enter', target: 'input' })).toBe('ok')
    expect(propertiesKeyAction({ key: 'Escape', target: 'input' })).toBe('cancel')
    expect(propertiesKeyAction({ key: 'Escape', target: 'button' })).toBe('cancel')
    for (const target of ['button', 'select', 'textarea', 'a'] as const) expect(propertiesKeyAction({ key: 'Enter', target })).toBeNull()
    expect(propertiesKeyAction({ key: 'Enter', target: 'input', isComposing: true })).toBeNull()
    expect(propertiesKeyAction({ key: 'Enter', target: 'input', shiftKey: true })).toBeNull()
    expect(propertiesKeyAction({ key: 'a', target: 'input' })).toBeNull()
    expect(propertiesKeyAction({ key: 'Enter', target: 'input', exactInput: true })).toBeNull()
    expect(propertiesKeyAction({ key: 'Escape', target: 'input', exactInput: true })).toBe('cancel')
  })

  it('blocks every production export until Apply and ignores parent keys while a child modal is open', () => {
    expect(propertiesProductionReady(false, false, false)).toBe(true)
    expect(propertiesProductionReady(true, false, false)).toBe(false)
    expect(propertiesProductionReady(false, true, false)).toBe(false)
    expect(propertiesProductionReady(false, false, true)).toBe(false)
    expect(propertiesChildModalActive(false, false)).toBe(false)
    expect(propertiesChildModalActive(true, false)).toBe(true)
    expect(propertiesChildModalActive(false, true)).toBe(true)
    expect(propertiesChildModalActive(false, false, true, false)).toBe(true)
    expect(propertiesChildModalActive(false, false, false, true)).toBe(true)
    expect(childExportAllowed(true)).toBe(false)
    expect(childExportAllowed(false)).toBe(true)
  })

  it('explains that multi selection cannot be edited as one Properties form', () => {
    expect(selectionPropertiesNotice(0)).toBeNull()
    expect(selectionPropertiesNotice(1)).toBeNull()
    expect(selectionPropertiesNotice(2)).toContain('Выберите один объект')
  })
})

describe('properties dialog rendering', () => {
  it('keeps a stable desktop height across tabs while the body scrolls', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.p100-dialog \{[^}]*; height: min\(600px, 80dvh\); max-height: 80dvh/)
    expect(css).toMatch(/\.p100-dialog-body \{[^}]*overflow: auto/)
  })
  it('updates reactive baseline after Apply so the button can become disabled again', () => {
    const source = readFileSync(new URL('../components/PropertiesDialog.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/^\s+setBaseline\(savedBaseline\)/m)
  })
  it('starts with Apply disabled and OK enabled', () => {
    const html = render(null)
    expect(buttonTag(html, 'properties-apply')).toContain(' disabled=""')
    expect(buttonTag(html, 'properties-ok')).not.toContain(' disabled=""')
  })

  it('keeps cabinet tabs reachable when the node is locked', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const state = useConfigurator.getState()
    Object.assign(initialSnapshot, state)
    state.setNodeLocked(state.activeId, true)
    const locked = useConfigurator.getState()
    Object.assign(initialSnapshot, locked)
    const html = renderToString(createElement(PropertiesDialog, {
      nodeId: locked.activeId, catalog: locked.catalog, panels: [], error: null, onClose: () => undefined,
    }))
    expect(html).toMatch(/data-tour="tabs"[^>]*>.*?Общее/s)
    expect(html.indexOf('data-tour="tabs"')).toBeLessThan(html.indexOf('<fieldset'))
    expect(html).toMatch(/<fieldset[^>]*disabled=""/)
  })

  it('hides manufacturing exports while the dialog has unapplied edits', () => {
    useConfigurator.getState().loadProject(referenceProject)
    const state = useConfigurator.getState()
    Object.assign(initialSnapshot, state)
    const cabinet = state.cabinets.find((entry) => entry.id === state.activeId)!
    state.edit('width', { width: cabinet.width + 100 })
    const edited = useConfigurator.getState()
    const html = renderToString(createElement(PropertiesDialog, {
      nodeId: edited.activeId, catalog: edited.catalog, panels: [], error: null, onClose: () => undefined,
    }))
    expect(html).toContain('Сначала примените изменения для экспорта')
    expect(html).not.toContain('data-tour="export"')
  })

  it('marks the invalid field, states the reason and blocks OK', () => {
    const html = render(widthError)
    expect(html).toContain('data-testid="properties-invalid"')
    expect(html).toContain('Ширина (W)')
    expect(html).toContain('100..4000 мм')
    expect(html).toMatch(/aria-invalid="true"/)
    expect(buttonTag(html, 'properties-ok')).toContain(' disabled=""')
    expect(buttonTag(html, 'properties-apply')).toContain(' disabled=""')
  })

  it('clicking the backdrop does nothing (modal, like PRO100)', () => {
    const source = readFileSync(new URL('../components/PropertiesDialog.tsx', import.meta.url), 'utf8')
    const backdrop = source.match(/<div className="p100-dialog-backdrop"[^>]*>/)?.[0] ?? ''
    expect(backdrop).not.toBe('')
    expect(backdrop).not.toMatch(/onMouseDown|onClick|cancel/)
  })

  it('classic CSS paints invalid fields with a real red token above the neutral border rules', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    const token = css.match(/--p100-invalid:\s*(#[0-9a-f]{6})/i)?.[1]
    expect(token).toBeDefined()
    const [r, g, b] = token!.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16))
    expect(r!).toBeGreaterThan(150)
    expect(Math.max(g!, b!)).toBeLessThan(90)
    const rule = css.lastIndexOf('[aria-invalid="true"]')
    expect(rule).toBeGreaterThan(css.lastIndexOf('.p100-workspace .fixed.inset-0 :is(input, select, textarea)'))
    expect(css.slice(rule, css.indexOf('}', rule))).toContain('var(--p100-invalid)')
  })
})
