import { INSTALLATION_CHECKLIST, type InstallationTask } from '@/src/core/installation'
import type { SyncStatus } from '@/src/core/sync/types'

export function canEditInstallation(task: InstallationTask): boolean {
  return task.status !== 'closed'
}

export function closeBlockReason(task: InstallationTask): string | null {
  if (!canEditInstallation(task)) return 'Монтаж жабылған'
  if (INSTALLATION_CHECKLIST.some((key) => !task.checklist[key].checked || !task.checklist[key].photo)) {
    return 'Барлық чеклист пункті мен фото міндетті'
  }
  if (!task.signature) return 'Клиенттің экрандағы қолы міндетті'
  if (task.repairs.some((repair) => repair.status === 'open')) return 'Ашық жөндеу тапсырмасы бар'
  return null
}

/** A pointer must travel and paint at least one segment; pointerup alone is blank. */
export function signatureHasStroke(strokes: number): boolean {
  return Number.isSafeInteger(strokes) && strokes > 0
}

export function installationQueueNotice(status: SyncStatus, reason: string): string {
  if (status === 'sent') return 'Әрекет жіберілді'
  if (status === 'rejected') return `Әрекет қабылданбады: ${reason || 'сервер қабылдамады'}`
  if (status === 'conflict') return 'Монтаж нұсқасында қайшылық бар. Сервердегі күйді жаңартып, қайта орындаңыз.'
  return 'Әрекет телефондағы кезекте сақталды'
}
