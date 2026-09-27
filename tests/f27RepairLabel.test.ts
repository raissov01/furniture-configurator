import { describe, expect, it } from 'vitest'
import { printableRepairQr, printableRepairs } from '@/lib/mobile/repairLabel'
import { createInstallationTask } from '@/src/core/installation'
import { encodePartQr } from '@/src/core/partQr'

const task = createInstallationTask('task', 'project', ['panel'], 1)
const qr = encodePartQr({ projectId: 'project', panelId: 'panel', version: 2 })
const repaired = { ...task, repairs: [{ id: 'repair', defectId: 'defect', panelId: 'panel', status: 'complete' as const, labelVersion: 2, labelQr: qr, completedAt: 2 }] }

describe('F27 жөндеуден кейінгі бирка', () => {
  it('тек аяқталған жөндеудің серверлік QR-ын басады', () => {
    expect(printableRepairQr(repaired, 'repair')).toBe(qr)
    expect(() => printableRepairQr(task, 'repair')).toThrow()
    expect(() => printableRepairQr({ ...repaired, repairs: [{ ...repaired.repairs[0]!, status: 'open', completedAt: null }] }, 'repair')).toThrow()
  })
  it('қайта жөнделсе ескі бирканы қайта баспайды', () => {
    const newer = { id: 'repair-2', defectId: 'defect-2', panelId: 'panel', status: 'complete' as const,
      labelVersion: 3, labelQr: encodePartQr({ projectId: 'project', panelId: 'panel', version: 3 }), completedAt: 3 }
    const twice = { ...repaired, repairs: [...repaired.repairs, newer] }
    expect(printableRepairs(twice).map((item) => item.id)).toEqual(['repair-2'])
    expect(() => printableRepairQr(twice, 'repair')).toThrow(/ескірген/i)
  })
})
