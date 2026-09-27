import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OwnMaterialChooser } from '../components/OwnMaterialChooser'
import { OwnCatalogImportPanel, SavedBasisImport } from '../components/OwnCatalogImportPanel'
import { FittingArticlePicker } from '../components/FittingArticlePicker'
import { FittingsCatalogPanel } from '../components/FittingsCatalogPanel'
import { defaultHingeSystems } from '../src/core/fittings'
import { FITTINGS_CATALOG } from '../src/core/data/fittings'

describe('own catalogue entry points', () => {
  it('offers manufacturer, collection and decor code controls with source disclosure', () => {
    const html = renderToStaticMarkup(createElement(OwnMaterialChooser, { existingIds: [], onAdd: () => undefined }))
    expect(html).toContain('aria-label="Производитель"')
    expect(html).toContain('aria-label="Коллекция"')
    expect(html).toContain('aria-label="Код декора"')
    expect(html).toContain('Источник')
  })

  it('requires an explicit rights confirmation before saving a private import', () => {
    const html = renderToStaticMarkup(createElement(OwnCatalogImportPanel, { onApplyMaterials: () => undefined }))
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('Базис Excel')
    expect(html).toContain('PRO100 textures.ini')
  })

  it('shows official article sources and warns when drilling is incomplete', () => {
    const html = renderToStaticMarkup(createElement(FittingArticlePicker, {
      system: defaultHingeSystems()[0]!, onChange: () => undefined,
    }))
    expect(html).toContain('Артикул производителя')
    expect(html).toContain('Недостаточно данных для присадки')
    expect(html).toContain('href="https://')
  })

  it('selects one private material at a time and bounds the rendered choices for a large Excel import', () => {
    const materials = Array.from({ length: 41 }, (_, index) => ({
      id: `item-${index}`, name: `material-${index}`, thickness: 16, sheetWidth: 2800, sheetHeight: 2070,
      hasGrain: false, pricePerSheet: 0, trimEdge: 10,
    }))
    const html = renderToStaticMarkup(createElement(SavedBasisImport, {
      preview: { materials, edgeBands: [], errors: [], skipped: 0 }, onApplyMaterials: () => undefined,
    }))
    expect(html).toContain('material-29')
    expect(html).not.toContain('material-30')
    expect(html).toContain('Добавить выбранный материал')
    expect(html).not.toContain('Добавить материалы в цех')
  })

  it('exposes all fitting brands and official drilling sources as a reference catalog', () => {
    const html = renderToStaticMarkup(createElement(FittingsCatalogPanel))
    expect(html).toContain('Blum')
    expect(html).toContain('Hettich')
    expect(html).toContain('Boyard')
    expect(html).toContain('GTV')
    expect(html).toContain('AKS')
    expect(html).toContain('href="https://')
    expect((html.match(/<article\b/g) ?? [])).toHaveLength(FITTINGS_CATALOG.products.length)
  })
})
