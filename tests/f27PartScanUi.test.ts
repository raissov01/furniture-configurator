import { describe, expect, it } from 'vitest'
import { scanVersionStatus } from '@/lib/mobile/partScanUi'
import { createInstallationTask } from '@/src/core/installation'

const task = createInstallationTask('t', 'project-1', ['p'], 1)

describe('F27 QR оқу күйі', () => {
  it('жөндеуден кейінгі ескі QR жарамды болып көрінбейді', () => {
    const repaired = { ...task, repairs: [{ id: 'r', defectId: 'd', panelId: 'p', status: 'complete' as const, labelVersion: 2, labelQr: 'qr', completedAt: 2 }] }
    expect(scanVersionStatus({ projectId: 'project-1', panelId: 'p', version: 1 }, [repaired])).toBe('stale')
    expect(scanVersionStatus({ projectId: 'project-1', panelId: 'p', version: 2 }, [repaired])).toBe('current')
    expect(scanVersionStatus({ projectId: 'project-1', panelId: 'p', version: 3 }, [repaired])).toBe('unknown')
  })
  it('тапсырма жоқ болса нұсқаны растамайды', () => {
    expect(scanVersionStatus({ projectId: 'project-1', panelId: 'p', version: 1 }, [])).toBe('unknown')
    expect(scanVersionStatus({ projectId: 'other', panelId: 'p', version: 1 }, [task])).toBe('unknown')
  })
})
