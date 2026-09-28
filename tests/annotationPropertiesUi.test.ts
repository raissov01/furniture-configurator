import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validAnnotationText } from '../lib/annotationDraft'
import { propertiesNodeSupported } from '../lib/propertiesNodeUi'
import { PropertiesDialog } from '../components/PropertiesDialog'
import { useConfigurator } from '../store/configurator'

describe('annotation Properties editor', () => {
  it('accepts annotation and group nodes', () => {
    expect(propertiesNodeSupported('annotation')).toBe(true)
    expect(propertiesNodeSupported('group')).toBe(true)
  })

  it('keeps empty and overlong drafts out of the saved node', () => {
    expect(validAnnotationText('')).toBe(false)
    expect(validAnnotationText('   ')).toBe(false)
    expect(validAnnotationText('x'.repeat(501))).toBe(false)
    expect(validAnnotationText('Текст')).toBe(true)
  })

  it('uses the dialog transaction and opens it from a scene double click', () => {
    const dialog = readFileSync(new URL('../components/PropertiesDialog.tsx', import.meta.url), 'utf8')
    const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8')
    expect(dialog).toContain('<AnnotationProperties')
    expect(dialog).toContain('autoApply')
    expect(dialog).toContain("updateDraftErrors(current, 'annotationText', isInvalid)")
    expect(scene).toContain('detail: annotation.nodeId')
  })

  it('renders the selected annotation editor inside Properties', () => {
    const original = useConfigurator.getState().exportProject()
    const serverSnapshot = useConfigurator.getInitialState()
    const originalServerSnapshot = { ...serverSnapshot }
    try {
      const nodeId = useConfigurator.getState().addAnnotation()
      const state = useConfigurator.getState()
      Object.assign(serverSnapshot, state)
      const catalog = state.catalog
      const html = renderToStaticMarkup(createElement(PropertiesDialog, {
        nodeId, catalog, panels: [], error: null, onClose: () => undefined,
      }))
      expect(html).toContain('data-testid="properties-dialog"')
      expect(html).toContain('data-testid="annotation-properties"')
    } finally {
      Object.assign(serverSnapshot, originalServerSnapshot)
      useConfigurator.getState().loadProject(original)
    }
  })
})
