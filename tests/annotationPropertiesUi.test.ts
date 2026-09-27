import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validAnnotationText } from '../lib/annotationDraft'
import { propertiesNodeSupported } from '../lib/propertiesNodeUi'

describe('annotation Properties editor', () => {
  it('accepts annotation nodes and rejects groups', () => {
    expect(propertiesNodeSupported('annotation')).toBe(true)
    expect(propertiesNodeSupported('group')).toBe(false)
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
})
