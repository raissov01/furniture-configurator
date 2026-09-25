import { z } from 'zod'
import { encodePartQr } from './export/labels'
import type { SyncAction, Revision } from './sync/types'

const identifier = z.string().trim().min(1).max(120)
const imageData = z.string().max(2_800_000).regex(/^data:image\/(?:png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
const evidence = z.strictObject({ id: identifier, dataUrl: imageData })
const signatureEvidence = evidence.refine((value) => value.dataUrl.startsWith('data:image/png;base64,'), 'Қолтаңба PNG суреті болуы керек')
const checklistKey = z.enum(['delivery', 'assembly', 'alignment', 'cleaning', 'acceptance'])

export const INSTALLATION_CHECKLIST = checklistKey.options
export type ChecklistKey = z.infer<typeof checklistKey>
export type ImageEvidence = z.infer<typeof evidence>
export type InstallationActionKind = 'installation.create' | 'installation.checklist' | 'installation.signature' |
  'installation.defect' | 'installation.repairComplete' | 'installation.close'
export type InstallationAction = SyncAction & { kind: InstallationActionKind }
export type InstallationTask = {
  schemaVersion: 1
  id: string
  projectId: string
  panelIds: string[]
  status: 'open' | 'closed'
  revision: Revision
  checklist: Record<ChecklistKey, { checked: boolean; photo: ImageEvidence | null }>
  signature: ImageEvidence | null
  defects: { id: string; panelId: string; note: string; photo: ImageEvidence; reportedAt: number }[]
  repairs: { id: string; defectId: string; panelId: string; status: 'open' | 'complete';
    labelVersion: number; labelQr: string; completedAt: number | null }[]
  closedAt: number | null
}
export type InstallationEvent = { kind: 'finalPaymentLinkRequested'; taskId: string; projectId: string }

const revisionSchema = z.strictObject({ version: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative() })
const actionBase = z.strictObject({
  id: identifier, kind: z.string(), entityId: identifier, payload: z.unknown(),
  baseRevision: revisionSchema, createdAt: z.number().int().nonnegative(),
})
const payloads = {
  'installation.create': z.strictObject({ projectId: identifier }),
  'installation.checklist': z.strictObject({ key: checklistKey, checked: z.boolean(), photo: evidence.optional() })
    .refine((value) => !value.checked || !!value.photo, 'Белгіленген пунктке фото керек'),
  'installation.signature': z.strictObject({ signature: signatureEvidence }),
  'installation.defect': z.strictObject({ id: identifier, panelId: identifier, note: z.string().trim().min(1).max(2000), photo: evidence }),
  'installation.repairComplete': z.strictObject({ repairId: identifier }),
  'installation.close': z.strictObject({}),
} as const

export function parseInstallationAction(raw: unknown): InstallationAction {
  const base = actionBase.parse(raw)
  if (!(base.kind in payloads)) throw new Error('Белгісіз монтаж әрекеті')
  const kind = base.kind as InstallationActionKind
  payloads[kind].parse(base.payload)
  return { ...base, kind, payload: base.payload as InstallationAction['payload'] }
}

export function createInstallationTask(id: string, projectId: string, panelIds: string[], now: number): InstallationTask {
  identifier.parse(id); identifier.parse(projectId)
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Уақыт жарамсыз')
  if (new Set(panelIds).size !== panelIds.length || panelIds.some((panelId) => !identifier.safeParse(panelId).success)) {
    throw new Error('Деталь тізімі жарамсыз')
  }
  const checklist = Object.fromEntries(INSTALLATION_CHECKLIST.map((key) => [key, { checked: false, photo: null }])) as InstallationTask['checklist']
  return { schemaVersion: 1, id, projectId, panelIds: [...panelIds], status: 'open',
    revision: { version: 1, updatedAt: now }, checklist, signature: null, defects: [], repairs: [], closedAt: null }
}

export function applyInstallationAction(task: InstallationTask, raw: unknown, now: number): { task: InstallationTask; events: InstallationEvent[] } {
  const action = parseInstallationAction(raw)
  if (action.entityId !== task.id) throw new Error('Монтаж тапсырмасының ID-і сәйкес емес')
  if (action.kind === 'installation.create') throw new Error('Бұл тапсырма бұрын құрылған')
  if (action.baseRevision.version !== task.revision.version) throw new Error('Монтаж нұсқасы ескірген')
  if (task.status === 'closed') throw new Error('Жабылған монтаж өзгермейді')
  if (!Number.isSafeInteger(now) || now < task.revision.updatedAt) throw new Error('Уақыт жарамсыз')
  const next: InstallationTask = { ...task, revision: { version: task.revision.version + 1, updatedAt: now } }
  const events: InstallationEvent[] = []
  switch (action.kind) {
    case 'installation.checklist': {
      const value = payloads[action.kind].parse(action.payload)
      next.checklist = { ...task.checklist, [value.key]: { checked: value.checked, photo: value.checked ? value.photo! : null } }
      break
    }
    case 'installation.signature':
      next.signature = payloads[action.kind].parse(action.payload).signature
      break
    case 'installation.defect': {
      const value = payloads[action.kind].parse(action.payload)
      if (!task.panelIds.includes(value.panelId)) throw new Error('Ақау белгісіз детальға байланған')
      if (task.defects.some((item) => item.id === value.id)) throw new Error('Ақау ID-і бұрын қолданылған')
      const labelVersion = 2 + task.repairs.filter((item) => item.panelId === value.panelId).length
      next.defects = [...task.defects, { ...value, reportedAt: now }]
      next.repairs = [...task.repairs, { id: `repair-${value.id}`, defectId: value.id, panelId: value.panelId,
        status: 'open', labelVersion, labelQr: encodePartQr({ projectId: task.projectId, panelId: value.panelId, version: labelVersion }), completedAt: null }]
      break
    }
    case 'installation.repairComplete': {
      const value = payloads[action.kind].parse(action.payload)
      if (!task.repairs.some((repair) => repair.id === value.repairId && repair.status === 'open')) throw new Error('Ашық ремонт тапсырмасы табылмады')
      next.repairs = task.repairs.map((repair) => repair.id === value.repairId ? { ...repair, status: 'complete', completedAt: now } : repair)
      break
    }
    case 'installation.close':
      if (INSTALLATION_CHECKLIST.some((key) => !task.checklist[key].checked || !task.checklist[key].photo)) throw new Error('Барлық пункт пен фото міндетті')
      if (!task.signature) throw new Error('Клиенттің экрандағы қолы міндетті')
      if (task.repairs.some((repair) => repair.status !== 'complete')) throw new Error('Ашық ремонт тапсырмасы бар')
      next.status = 'closed'
      next.closedAt = now
      events.push({ kind: 'finalPaymentLinkRequested', taskId: task.id, projectId: task.projectId })
      break
  }
  return { task: next, events }
}
