import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MenuItem } from '../components/ui'
import { classicMenuItemTitle } from '../lib/classicMenuUi'

describe('classic menu accessibility', () => {
  it('uses the translated command and its shortcut in a native tooltip', () => {
    expect(classicMenuItemTitle('Жобаны сақтау', 'Ctrl+S')).toBe('Жобаны сақтау · Ctrl+S')
    expect(classicMenuItemTitle('Қабаттар')).toBe('Қабаттар')
  })

  it('announces the current option to assistive technology', () => {
    const active = renderToString(createElement(MenuItem, { active: true, title: 'Ашық', children: 'Ашық' }))
    expect(active).toContain('aria-current="true"')
    expect(active).toContain('title="Ашық"')
  })
})
