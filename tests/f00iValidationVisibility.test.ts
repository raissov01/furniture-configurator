import { describe, expect, it } from 'vitest'
import { visibleErrors, showIssue } from '@/lib/validationVisibility'

describe('validation visibility', () => {
  it('hides untouched errors until blur or submit', () => {
    const errors = { email: 'Email: required', password: 'Password: 1..100' }
    expect(visibleErrors(errors, {}, false)).toEqual({})
    expect(visibleErrors(errors, { email: true }, false)).toEqual({ email: 'Email: required' })
    expect(visibleErrors(errors, {}, true)).toEqual(errors)
  })

  it('shows survey issues only for touched fields or a submitted step', () => {
    expect(showIssue('height', {}, false)).toBe(false)
    expect(showIssue('height', { height: true }, false)).toBe(true)
    expect(showIssue('height', {}, true)).toBe(true)
  })
})
