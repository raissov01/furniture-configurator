import { describe, expect, it } from 'vitest'
import { closeModal, modalZIndex, openModal } from '../lib/modalStack'

describe('modal stack', () => {
  it('places the last opened dialog above Properties and restores order after closing it', () => {
    const properties = openModal([], 'properties')
    const gallery = openModal(properties, 'gallery')
    const shop = openModal(gallery, 'shop')
    expect(modalZIndex(shop, 'properties')).toBeLessThan(modalZIndex(shop, 'gallery'))
    expect(modalZIndex(shop, 'gallery')).toBeLessThan(modalZIndex(shop, 'shop'))
    expect(closeModal(shop, 'shop')).toEqual(gallery)
    expect(openModal(shop, 'gallery')).toEqual(['properties', 'shop', 'gallery'])
  })
})
