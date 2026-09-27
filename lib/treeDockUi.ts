import type { TreeDockTab } from '@/lib/f11FindDock'

export type DockRequest = { tab: TreeDockTab; revision: number }

export function nextDockRequest(current: DockRequest, tab: TreeDockTab): DockRequest {
  return { tab, revision: current.revision + 1 }
}
