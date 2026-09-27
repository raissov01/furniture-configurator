import { describe, expect, it } from 'vitest'
import { shouldCloseGalleryOnKey } from '../lib/galleryKeyboard'

describe('F01 gallery Escape', () => {
  it('closes the gallery only when its own dialog is active', () => {
    expect(shouldCloseGalleryOnKey('Escape', false)).toBe(true)
    expect(shouldCloseGalleryOnKey('Escape', true)).toBe(false)
    expect(shouldCloseGalleryOnKey('Enter', false)).toBe(false)
  })
})
