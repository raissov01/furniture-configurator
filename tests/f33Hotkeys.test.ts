import { describe, expect, it } from 'vitest'
import { HOTKEYS, classicFileHint, matchHotkey } from '../lib/hotkeys'

function event(key: string): KeyboardEvent {
  return { key, ctrlKey: true, metaKey: false, shiftKey: false } as KeyboardEvent
}

describe('classic file shortcuts', () => {
  it.each([
    ['n', 'newCabinet', 'Ctrl+N'],
    ['o', 'openProject', 'Ctrl+O'],
    ['s', 'saveProject', 'Ctrl+S'],
    ['p', 'printProject', 'Ctrl+P'],
  ])('maps Ctrl+%s to %s and the same menu hint', (key, kind, hint) => {
    expect(matchHotkey(event(key))?.action.kind).toBe(kind)
    expect(classicFileHint(kind as Parameters<typeof classicFileHint>[0])).toBe(hint)
    expect(HOTKEYS.some((entry) => entry.keys === hint)).toBe(true)
  })

  it('keeps bare O for the projection command', () => {
    expect(matchHotkey({ ...event('o'), ctrlKey: false } as KeyboardEvent)?.action.kind).toBe('projection')
  })
})
