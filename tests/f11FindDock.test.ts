import { describe, expect, it } from 'vitest'
import { treeDockTabs } from '../lib/f11FindDock'

describe('F11 іздеу қойындысы', () => {
  it('негізгі доктың екі режиміне де ортақ Найти қойындысы бар', () => {
    expect(treeDockTabs).toContain('find')
    expect(new Set(treeDockTabs).size).toBe(treeDockTabs.length)
  })
})
