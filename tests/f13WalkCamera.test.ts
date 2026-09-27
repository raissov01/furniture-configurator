import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { useOrthographicCamera } from '../lib/viewProjection'

it('uses perspective during a walk and restores the previous orthographic view on exit', () => {
  expect(useOrthographicCamera('ortho', false)).toBe(true)
  expect(useOrthographicCamera('ortho', true)).toBe(false)
  expect(useOrthographicCamera('perspective', false)).toBe(false)
  expect(readFileSync('components/Scene.tsx', 'utf8')).toContain("useOrthographicCamera(projection, walk)")
})
