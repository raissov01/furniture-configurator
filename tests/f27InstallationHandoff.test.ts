import { describe, expect, it } from 'vitest'
import { installationCreateAction } from '@/lib/installationHandoff'

describe('F27 сақталған жобадан монтажға беру', () => {
  it('жоба ID-ін монтаж әрекетіне қосып, бастапқы revision-ді 0 қояды', () => {
    expect(installationCreateAction('cloud-42', 'task-1', 'action-1', 123)).toEqual({
      id: 'action-1', kind: 'installation.create', entityId: 'task-1', payload: { projectId: 'cloud-42' },
      baseRevision: { version: 0, updatedAt: 0 }, createdAt: 123,
    })
  })
  it('бос жоба ID-ін қабылдамайды', () => {
    expect(() => installationCreateAction('', 'task-1', 'action-1', 123)).toThrow()
  })
})
