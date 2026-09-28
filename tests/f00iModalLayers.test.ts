import { describe, expect, it } from 'vitest'
import { closeModal, hasModal, isTopModal, openModal } from '@/lib/modalStack'

describe('modal layers', () => {
  it('keeps the latest dialog on top and blocks workspace shortcuts', () => {
    const stack = openModal(openModal([], 'help'), 'ai')
    expect(hasModal(stack)).toBe(true)
    expect(isTopModal(stack, 'ai')).toBe(true)
    expect(isTopModal(stack, 'help')).toBe(false)
    expect(isTopModal(closeModal(stack, 'ai'), 'help')).toBe(true)
  })
})
