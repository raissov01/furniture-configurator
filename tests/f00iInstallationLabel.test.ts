import { describe, expect, it } from 'vitest'
import { installationTaskLabel } from '@/lib/mobile/installationUi'

describe('installation list names', () => {
  it('uses the saved project name and a human status', () => {
    expect(installationTaskLabel({ projectId: 'uuid-1', status: 'open' }, [{ id: 'uuid-1', name: 'Кухня' }], (key) => key))
      .toBe('Кухня · Монтаж открыт')
    expect(installationTaskLabel({ projectId: 'uuid-1', status: 'closed' }, [], (key) => key))
      .toBe('Проект · Монтаж закрыт')
  })
})
