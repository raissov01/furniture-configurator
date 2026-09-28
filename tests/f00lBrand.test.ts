import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { Cta, Dimension, Sheet } from '@/components/brand'

describe('shared brand primitives', () => {
  it('renders a labelled dimensional line and a semantic sheet', () => {
    const html = renderToStaticMarkup(createElement(Sheet, {
      caption: 'Cut plan',
      children: createElement(Dimension, { label: 'Cabinet', value: '2000 (H) × 600 (W) × 450 (D)' }),
    }))
    expect(html).toContain('<figure')
    expect(html).toContain('Cut plan')
    expect(html).toContain('2000 (H) × 600 (W) × 450 (D)')
    expect(html).toContain('dimline')
  })

  it('keeps the primary action large enough for touch', () => {
    const html = renderToStaticMarkup(createElement(Cta, { href: '/configurator', children: 'Open' }))
    expect(html).toContain('min-h-11')
    expect(html).toContain('site-cta')
  })
})
