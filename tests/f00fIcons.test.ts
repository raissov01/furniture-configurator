import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { classicIconTone } from '../lib/classicIconPalette'
import { ClassicIcon } from '../components/ClassicIcon'

describe('F00f classic icon colour meaning', () => {
  it('reserves red for deletion, yellow for file opening and blue for views or saving', () => {
    expect(classicIconTone('delete')).toBe('red')
    expect(classicIconTone('open')).toBe('yellow')
    for (const name of ['save', 'view', 'eye', 'fit', 'render', 'room'] as const) {
      expect(classicIconTone(name)).toBe('blue')
    }
    for (const name of ['magnet', 'board', 'layers', 'walk', 'light', 'structure'] as const) {
      expect(classicIconTone(name)).toBe('neutral')
    }
  })

  it('draws AR and VR as distinct icons and uses them in both controls', () => {
    const ar = renderToStaticMarkup(createElement(ClassicIcon, { name: 'ar' }))
    const vr = renderToStaticMarkup(createElement(ClassicIcon, { name: 'vr' }))
    expect(ar).toContain('<path')
    expect(vr).toContain('<path')
    expect(ar).not.toBe(vr)
    const arButton = readFileSync(new URL('../components/ArButton.tsx', import.meta.url), 'utf8')
    const vrButton = readFileSync(new URL('../components/VrButton.tsx', import.meta.url), 'utf8')
    expect(arButton).toContain('<ClassicIcon name="ar" />')
    expect(vrButton).toContain('<ClassicIcon name="vr" />')
  })
})
