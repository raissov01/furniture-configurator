import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { Dense, Field, NumberInput } from '../components/ui'
import { hasDraftErrors, parseNumberDraft, stepAvailable, updateDraftErrors } from '../lib/numberDraft'

describe('number draft validation', () => {
  it('keeps empty, fractional, text and out-of-range drafts out of the model', () => {
    expect(parseNumberDraft('', { min: 100, max: 4000 })).toEqual({ error: 'required' })
    expect(parseNumberDraft('1234.5', { min: 100, max: 4000 })).toEqual({ error: 'integer' })
    expect(parseNumberDraft('қазақ', { min: 100, max: 4000 })).toEqual({ error: 'number' })
    expect(parseNumberDraft('99', { min: 100, max: 4000 })).toEqual({ error: 'range' })
    expect(parseNumberDraft('4001', { min: 100, max: 4000 })).toEqual({ error: 'range' })
    expect(parseNumberDraft('1235', { min: 100, max: 4000 })).toEqual({ value: 1235 })
    expect(parseNumberDraft('0.15', { min: 0.1, max: 10, integer: false })).toEqual({ value: 0.15 })
  })

  it('disables steps that cannot change the stored value', () => {
    expect(stepAvailable(100, -1, 10, 100, 4000)).toBe(false)
    expect(stepAvailable(4000, 1, 10, 100, 4000)).toBe(false)
    expect(stepAvailable(105, -1, 10, 100, 4000)).toBe(true)
    expect(stepAvailable(100, 1, 10, 100, 4000)).toBe(true)
  })

  it('does not clear another field error when one field is corrected', () => {
    const two = updateDraftErrors(updateDraftErrors({}, 'cabinet.height', true), 'cabinet.width', true)
    expect(hasDraftErrors(updateDraftErrors(two, 'cabinet.height', false))).toBe(true)
    expect(hasDraftErrors(updateDraftErrors(two, 'cabinet.width', false))).toBe(true)
    expect(hasDraftErrors(updateDraftErrors(updateDraftErrors(two, 'cabinet.height', false), 'cabinet.width', false))).toBe(false)
  })

  it('renders a disabled decrease button at the minimum', () => {
    const html = renderToString(createElement(Dense, {
      children: createElement(Field, {
        label: 'Высота (H)',
        children: createElement(NumberInput, { value: 100, min: 100, max: 4000, step: 10, onChange: () => undefined }),
      }),
    }))
    expect(html).toMatch(/aria-label="Уменьшить"[^>]*disabled=""/)
    expect(html).toMatch(/aria-label="Увеличить"[^>]*title="Увеличить"/)
  })

  it('blocks exports while an uncommitted dimension draft is invalid', () => {
    const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(workspace).toMatch(/canExport: hasActiveCabinet && !production\.error && !draftInvalid/)
    expect(workspace).toMatch(/canExportPdf: hasActiveCabinet && !draftInvalid/)
    expect(workspace).toMatch(/cabinet && !production\.error && !draftInvalid \? <ExportMenu/)
  })
})
