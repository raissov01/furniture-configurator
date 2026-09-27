import { describe, expect, it } from 'vitest'
import { labelExportOptions, labelSizeLimits, projectLabelIdentity } from '@/lib/labelExportOptions'
import type { GroupNode } from '@/src/core/tree'

describe('F18 жапсырма параметрлері', () => {
  it('бірінші шығарылымды монтаждағы жөндеу нұсқасынан ажыратады', () => {
    const root = { id: 'root', children: [{ id: 'cabinet-uuid' }] } as GroupNode
    expect(projectLabelIdentity(root)).toEqual({ projectId: 'cabinet-uuid', version: 1 })
  })
  it('58 × 40 мм A4 және A5 үшін QR дерегін сақтайды', () => {
    for (const page of ['a4', 'a5'] as const) {
      const value = labelExportOptions({ page, widthMm: 58, heightMm: 40 }, 'project-1', 4)
      expect(value).toEqual({ size: { page, widthMm: 58, heightMm: 40 }, projectId: 'project-1', version: 4 })
    }
  })

  it('бос, бөлшек және парақтан асқан өлшемді қабылдамайды', () => {
    expect(labelSizeLimits('a5')).toEqual({ width: 138, height: 200 })
    expect(() => labelExportOptions({ page: 'a4', widthMm: 58.5, heightMm: 40 }, 'p', 4)).toThrow(/ені.*58.*200/i)
    expect(() => labelExportOptions({ page: 'a5', widthMm: 139, heightMm: 40 }, 'p', 4)).toThrow(/ені.*58.*138/i)
    expect(() => labelExportOptions({ page: 'a5', widthMm: 58, heightMm: 0 }, 'p', 4)).toThrow(/биіктігі.*40.*200/i)
  })
})
