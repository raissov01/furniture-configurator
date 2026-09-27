import { describe, expect, it, vi } from 'vitest'
import { loadProjectFromFile, projectFileErrorMessage } from '../lib/projectFile'

describe('project file error presentation', () => {
  it('returns a failure to the caller without replacing the current project', async () => {
    const load = vi.fn()
    const broken = new File(['{bad json'], 'бүлінген.json', { type: 'application/json' })
    await expect(loadProjectFromFile(broken, load)).rejects.toThrow('бүлінген.json')
    expect(load).not.toHaveBeenCalled()
  })

  it('gives the inline alert a useful translated message', () => {
    const message = projectFileErrorMessage(new Error('бүлінген.json: JSON'))
    expect(message).toContain('бүлінген.json')
    expect(message).not.toContain('SyntaxError')
  })
})
