import { describe, expect, it } from 'vitest'
import { revokeError } from '../lib/accountPanelState'

describe('F23 invitation revocation status', () => {
  it('preserves a failed API result as an error and accepts only success', () => {
    expect(revokeError(false, 'Серверная ошибка')).toBe('Серверная ошибка')
    expect(revokeError(false, null)).toBeTruthy()
    expect(revokeError(true, null)).toBeNull()
  })
})
