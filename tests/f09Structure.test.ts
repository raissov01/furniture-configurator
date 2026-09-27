import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassicStructureWindow } from '@/components/ClassicStructureWindow'

describe('F09 classic structure access', () => {
  it('offers a visible properties action in the structure window', () => {
    const html = renderToStaticMarkup(createElement(ClassicStructureWindow, {
      onClose: () => {}, onProperties: () => {}, canOpenProperties: true,
    }))
    expect(html).toMatch(/<button[^>]*>Свойства<\/button>/)
  })
})
