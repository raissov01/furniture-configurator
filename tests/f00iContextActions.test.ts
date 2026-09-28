import { describe, expect, it } from 'vitest'
import { contextActions } from '@/lib/contextActions'

describe('tree context actions', () => {
  it('enables grouping for a multi-selection and ungrouping for a group', () => {
    expect(contextActions('cabinet', 2, 3, false)).toMatchObject({ group: true, ungroup: false, copy: true })
    expect(contextActions('group', 1, 3, false)).toMatchObject({ group: false, ungroup: true, copy: false })
  })
  it('protects locked items and the last cabinet', () => {
    expect(contextActions('cabinet', 1, 1, false).delete).toBe(false)
    expect(contextActions('board', 1, 2, true).delete).toBe(false)
  })
})
