import { describe, expect, it } from 'vitest'
import { classicDockTools } from '../lib/classicDockTools'

describe('classic dock toolbar', () => {
  it('exposes a separate icon for structure, layers, and library', () => {
    expect(Object.values(classicDockTools).map((tool) => tool.tab)).toEqual(['structure', 'layers', 'library'])
    expect(Object.values(classicDockTools).map((tool) => tool.icon)).toEqual(['structure', 'layers', 'library'])
  })
})
