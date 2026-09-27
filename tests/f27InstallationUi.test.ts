import { describe, expect, it } from 'vitest'
import { closeBlockReason, canEditInstallation, signatureHasStroke, installationQueueNotice } from '@/lib/mobile/installationUi'
import { createInstallationTask } from '@/src/core/installation'

const task = createInstallationTask('task-1', 'project-1', ['panel-1'], 1)

describe('F27 монтаж интерфейсі', () => {
  it('чеклист, қол және ашық жөндеу орындалмай жабуды бұғаттайды', () => {
    expect(closeBlockReason(task)).toMatch(/фото/i)
    const checked = { ...task, checklist: Object.fromEntries(Object.entries(task.checklist).map(([key, value]) =>
      [key, { ...value, checked: true, photo: { id: key, dataUrl: 'photo' } }])) as typeof task.checklist }
    expect(closeBlockReason(checked)).toMatch(/қол/i)
    const signed = { ...checked, signature: { id: 'sig', dataUrl: 'png' } }
    expect(closeBlockReason(signed)).toBeNull()
    expect(closeBlockReason({ ...signed, repairs: [{ id: 'r', defectId: 'd', panelId: 'panel-1', status: 'open', labelVersion: 2, labelQr: 'qr', completedAt: null }] })).toMatch(/жөндеу/i)
    expect(canEditInstallation({ ...signed, status: 'closed' })).toBe(false)
  })
  it('pointerup және бір нүкте қолтаңба емес', () => {
    expect(signatureHasStroke(0)).toBe(false)
    expect(signatureHasStroke(1)).toBe(true)
  })
  it('сервер растамаған әрекетті жіберілді деп атамайды', () => {
    expect(installationQueueNotice('rejected', '422')).toMatch(/422/)
    expect(installationQueueNotice('conflict', '')).toMatch(/қайшылық/i)
    expect(installationQueueNotice('pending', '')).toMatch(/кезекте/i)
    expect(installationQueueNotice('sent', '')).toMatch(/жіберілді/i)
  })
})
