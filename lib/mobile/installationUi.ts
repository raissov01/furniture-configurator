import { INSTALLATION_CHECKLIST, type InstallationTask } from '@/src/core/installation'
import type { SyncStatus } from '@/src/core/sync/types'

export function canEditInstallation(task: InstallationTask): boolean {
  return task.status !== 'closed'
}

export function closeBlockReason(task: InstallationTask, translate: (key: string) => string = (key) => key): string | null {
  if (!canEditInstallation(task)) return translate('Монтаж закрыт')
  if (INSTALLATION_CHECKLIST.some((key) => !task.checklist[key].checked || !task.checklist[key].photo)) {
    return translate('Все пункты чек-листа и фото обязательны')
  }
  if (!task.signature) return translate('Нужна подпись клиента на экране')
  if (task.repairs.some((repair) => repair.status === 'open')) return translate('Есть открытое ремонтное задание')
  return null
}

/** A pointer must travel and paint at least one segment; pointerup alone is blank. */
export function signatureHasStroke(strokes: number): boolean {
  return Number.isSafeInteger(strokes) && strokes > 0
}

export function installationQueueNotice(status: SyncStatus, reason: string, translate: (key: string) => string = (key) => key): string {
  if (status === 'sent') return translate('Действие отправлено')
  if (status === 'rejected') return translate('Действие отклонено: {reason}').replace('{reason}', reason || translate('сервер отклонил'))
  if (status === 'conflict') return translate('Конфликт версии монтажа. Обновите состояние с сервера и повторите.')
  return translate('Действие сохранено в очереди телефона')
}
