import { afterEach, describe, expect, it, vi } from 'vitest'
import { passwordResetMailMode, sendPasswordReset } from '../lib/server/resetMail'

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('қалпына келтіру хатының адаптері', () => {
  it('SMTP толық емес кезде сілтеме тек сервер журналына түседі', async () => {
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('SMTP_FROM', '')
    vi.stubEnv('SMTP_USER', '')
    vi.stubEnv('SMTP_PASSWORD', '')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(passwordResetMailMode()).toBe('server-log')
    expect(await sendPasswordReset('person@example.com', 'https://example.test/reset-password?token=secret'))
      .toBe('server-log')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('https://example.test/reset-password?token=secret'))
  })
})
