import type { InstallationTask } from '@/src/core/installation'
import { decodePartQr } from '@/src/core/partQr'

export function printableRepairs(task: InstallationTask): InstallationTask['repairs'] {
  return task.repairs.filter((repair) => repair.status === 'complete' &&
    !task.repairs.some((other) => other.panelId === repair.panelId && other.labelVersion > repair.labelVersion))
}

export function printableRepairQr(task: InstallationTask, repairId: string): string {
  const repair = task.repairs.find((item) => item.id === repairId)
  if (!repair || repair.status !== 'complete') throw new Error('Аяқталған жөндеу тапсырмасы табылмады')
  if (!printableRepairs(task).some((item) => item.id === repairId)) throw new Error('Бұл бирка ескірген')
  const code = decodePartQr(repair.labelQr)
  if (code.projectId !== task.projectId || code.panelId !== repair.panelId || code.version !== repair.labelVersion) {
    throw new Error('Жөндеу биркасының QR дерегі сәйкес емес')
  }
  return repair.labelQr
}
