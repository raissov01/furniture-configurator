import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ReferencePriceList } from '../components/ReferencePriceList'
import { OWN_REFERENCE_PRICES } from '../src/core/data/catalog'
import { t as tr } from '../lib/i18n'

it('анықтамалық баға парағы дереккөзді, күнді, қаланы, бірлікті және ескіру ескертуін көрсетеді', () => {
  const first = OWN_REFERENCE_PRICES[0]!
  const html = renderToStaticMarkup(createElement(ReferencePriceList))
  expect(html).toContain(first.supplier)
  expect(html).toContain(first.city)
  expect(html).toContain(first.dateSeen)
  expect(html).toContain(first.url)
  expect(html).toContain(first.unit === 'sheet' ? tr('лист') : tr('п.м.'))
  expect(html).toContain(tr('Цены могут устареть. Это справочник поставщиков, а не прайс вашего цеха.'))
})
