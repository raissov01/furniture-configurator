import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DecorPicker } from '../components/DecorPicker'
import { ownCatalogBuild } from '../src/core/data/catalog'

describe('editor decor picker', () => {
  it('offers maker, collection and decor code filters for added public catalog materials', () => {
    const material = ownCatalogBuild().materials[0]!
    const html = renderToStaticMarkup(createElement(DecorPicker, { materials: [material], value: material.id, onChange: () => undefined }))
    expect(html).toContain('aria-label="Производитель"')
    expect(html).toContain('aria-label="Коллекция"')
    expect(html).toContain('aria-label="Код декора"')
  })

  it('keeps the compact selector for unrelated custom materials', () => {
    const material = { ...ownCatalogBuild().materials[0]!, id: 'shop-custom' }
    const html = renderToStaticMarkup(createElement(DecorPicker, { materials: [material], value: material.id, onChange: () => undefined }))
    expect(html).not.toContain('aria-label="Производитель"')
  })
})
