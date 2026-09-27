import type { InstallationTask } from '@/src/core/installation'
import { decodePartQr } from '@/src/core/partQr'

export function printableRepairQr(task: InstallationTask, repairId: string): string {
  const repair = task.repairs.find((item) => item.id === repairId)
  if (!repair || repair.status !== 'complete') throw new Error('Аяқталған жөндеу тапсырмасы табылмады')
  const code = decodePartQr(repair.labelQr)
  if (code.projectId !== task.projectId || code.panelId !== repair.panelId || code.version !== repair.labelVersion) {
    throw new Error('Жөндеу биркасының QR дерегі сәйкес емес')
  }
  return repair.labelQr
}
