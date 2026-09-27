import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { matchHotkey } from '../lib/hotkeys'

it('routes E through the single workspace hotkey handler in walk mode', () => {
  expect(matchHotkey({ key: 'e', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent)?.action).toEqual({ kind: 'openness' })
  const scene = readFileSync('components/Scene.tsx', 'utf8')
  const walkKeys = scene.slice(scene.indexOf('const down = (e: KeyboardEvent)'), scene.indexOf('const up = (e: KeyboardEvent)'))
  expect(walkKeys).not.toContain("e.code === 'KeyE'")
})
