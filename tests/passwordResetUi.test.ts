import { describe, expect, it } from 'vitest'
import { resetEmailError, resetPasswordError } from '../lib/passwordResetUi'

describe('қалпына келтіру өрістері', () => {
  it('пошта бос не қате болса нақты себеп береді', () => {
    expect(resetEmailError('')).toMatch(/Почта/)
    expect(resetEmailError('bad')).toMatch(/адрес/)
    expect(resetEmailError('a@example.com')).toBeNull()
  })
  it('қысқа парольді жібермейді', () => {
    expect(resetPasswordError('')).toMatch(/8–1024/)
    expect(resetPasswordError('1234567')).toMatch(/8–1024/)
    expect(resetPasswordError('12345678')).toBeNull()
  })
})
