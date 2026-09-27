import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { modalBlocksHotkeys, shouldCloseModalKey, tourZIndex } from '@/lib/modalStack'

const source = (name: string) => readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8')

describe('classic modal stack', () => {
  it('guards shortcuts and Escape for the top dialog only', () => {
    expect(modalBlocksHotkeys([])).toBe(false)
    expect(modalBlocksHotkeys(['properties', 'ai'])).toBe(true)
    expect(shouldCloseModalKey('Escape', true)).toBe(true)
    expect(shouldCloseModalKey('Escape', false)).toBe(false)
  })

  it('keeps the tour above Properties but below an explicitly opened Help dialog', () => {
    expect(tourZIndex(['properties'])).toBe(85)
    expect(tourZIndex(['properties', 'help'])).toBe(85)
    expect(tourZIndex([])).toBe(60)
  })

  it.each(['AiPanel', 'HelpPanel', 'HistoryPanel', 'ProjectPanel', 'RenderPanel', 'RoomPlan', 'SketchEditor', 'CustomParts'])(
    '%s joins the shared stack', (name) => {
      expect(source(name)).toMatch(/useModalLayer\(open, '/)
      expect(source(name)).not.toMatch(/fixed inset-0 z-50/)
    },
  )

  it('suppresses workspace shortcuts while a dialog is open', () => {
    expect(source('Workspace')).toMatch(/modalBlocksHotkeys\(getModalStack\(\)\)/)
  })
})
