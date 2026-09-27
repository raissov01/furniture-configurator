import type { PartQr } from '@/src/core/partQr'
import type { InstallationTask } from '@/src/core/installation'

/** The latest replacement label wins for this project and physical panel. */
export function scanVersionStatus(part: PartQr, tasks: InstallationTask[]): 'current' | 'stale' | 'unknown' {
  const matching = tasks.filter((task) => task.projectId === part.projectId && task.panelIds.includes(part.panelId))
  if (matching.length === 0) return 'unknown'
  const latest = Math.max(1, ...matching.flatMap((task) => task.repairs
    .filter((repair) => repair.panelId === part.panelId).map((repair) => repair.labelVersion)))
  if (part.version < latest) return 'stale'
  return part.version === latest ? 'current' : 'unknown'
}
