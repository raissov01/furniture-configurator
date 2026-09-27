import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassicIcon } from '../components/ClassicIcon'
import { classicShopTools } from '../lib/classicShopTools'

describe('classic shop toolbar meanings', () => {
  it('shows a quote sheet for estimate and a cut layout for nesting', () => {
    expect(classicShopTools.quote).toEqual({ icon: 'quote', label: 'Смета и раскрой' })
    expect(classicShopTools.nesting).toEqual({ icon: 'cut', label: 'Раскрой' })
    const icon = renderToString(createElement(ClassicIcon, { name: classicShopTools.nesting.icon }))
    expect(icon).toContain('M9 2v14')
    expect(icon).not.toContain('<circle')
  })
})
