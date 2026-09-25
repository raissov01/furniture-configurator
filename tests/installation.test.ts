import { describe, expect, it } from 'vitest'
import { applyInstallationAction, createInstallationTask, parseInstallationAction } from '../src/core/installation'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
const jpeg = 'data:image/jpeg;base64,/9j/2Q=='
const photo = { id: 'photo-1', dataUrl: jpeg }
const signature = { id: 'signature-1', dataUrl: png }
const panels = new Set(['side-1', 'top-1'])

function action(kind: string, payload: unknown, version: number) {
  return parseInstallationAction({ id: `action-${kind}-${version}`, kind, entityId: 'task-1',
    payload, baseRevision: { version, updatedAt: version ? 1000 + version : 0 }, createdAt: 1000 + version })
}

describe('монтаж актісінің өзегі', () => {
  it('барлық фото мен клиент қолы жоқ болса жабылмайды', () => {
    let task = createInstallationTask('task-1', 'project-1', [...panels], 1000)
    expect(() => applyInstallationAction(task, action('installation.close', {}, 1), 1002)).toThrow(/фото|қол/)
    for (const key of ['delivery', 'assembly', 'alignment', 'cleaning', 'acceptance'] as const) {
      task = applyInstallationAction(task, action('installation.checklist', { key, checked: true, photo }, task.revision.version), 1001).task
    }
    expect(() => applyInstallationAction(task, action('installation.close', {}, task.revision.version), 1002)).toThrow(/қол/)
    task = applyInstallationAction(task, action('installation.signature', { signature }, task.revision.version), 1002).task
    const closed = applyInstallationAction(task, action('installation.close', {}, task.revision.version), 1003)
    expect(closed.task.status).toBe('closed')
    expect(closed.events).toEqual([{ kind: 'finalPaymentLinkRequested', taskId: 'task-1', projectId: 'project-1' }])
    expect(() => applyInstallationAction(closed.task, action('installation.checklist', { key: 'delivery', checked: false }, closed.task.revision.version), 1004)).toThrow(/жабылған/i)
  })

  it('ақау нақты детальға байланысады, жаңа QR алады және аяқталмайынша жабуды бөгейді', () => {
    let task = createInstallationTask('task-1', 'project-1', [...panels], 1000)
    for (const key of ['delivery', 'assembly', 'alignment', 'cleaning', 'acceptance'] as const) {
      task = applyInstallationAction(task, action('installation.checklist', { key, checked: true, photo }, task.revision.version), 1001).task
    }
    task = applyInstallationAction(task, action('installation.signature', { signature }, task.revision.version), 1002).task
    expect(() => applyInstallationAction(task, action('installation.defect', { id: 'defect-1', panelId: 'unknown', note: 'Сызат', photo }, task.revision.version), 1003)).toThrow(/деталь/)
    task = applyInstallationAction(task, action('installation.defect', { id: 'defect-1', panelId: 'side-1', note: 'Сызат', photo }, task.revision.version), 1003).task
    expect(task.repairs[0]).toMatchObject({ panelId: 'side-1', status: 'open', labelVersion: 2 })
    expect(task.repairs[0]!.labelQr).toMatch(/^F1\./)
    expect(() => applyInstallationAction(task, action('installation.close', {}, task.revision.version), 1004)).toThrow(/ремонт/)
    task = applyInstallationAction(task, action('installation.repairComplete', { repairId: task.repairs[0]!.id }, task.revision.version), 1004).task
    expect(applyInstallationAction(task, action('installation.close', {}, task.revision.version), 1005).task.status).toBe('closed')
  })

  it('сурет дерегін, action мәнін және базалық нұсқаны тексереді', () => {
    const task = createInstallationTask('task-1', 'project-1', [...panels], 1000)
    expect(() => action('installation.signature', { signature: { id: 'x', dataUrl: 'https://example.kz/sign.png' } }, 1)).toThrow()
    expect(() => action('installation.checklist', { key: 'delivery', checked: true }, 1)).toThrow()
    expect(() => action('installation.defect', { id: 'x', panelId: 'side-1', note: 'a', photo: { id: 'x', dataUrl: 'data:image/png;base64,%%%%' } }, 1)).toThrow()
    expect(() => applyInstallationAction(task, action('installation.signature', { signature }, 0), 1001)).toThrow(/нұсқа/)
    expect(() => action('installation.unknown', {}, 1)).toThrow()
  })
})
