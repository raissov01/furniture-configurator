import { panelDisplayLabel } from '@/lib/panelDisplay'

export function selectedStatusName(selectedId: string | null,
  panels: readonly { id: string; label: string }[], activeNodeName: string | null | undefined): string | null {
  if (!selectedId) return null
  const panel = panels.find((item) => item.id === selectedId)
  return panel ? panelDisplayLabel(panel.label) : activeNodeName ?? selectedId
}

/** Start a decorative block beside the active object, or at the room centre. */
export function solidStartPosition(room: { width: number; depth: number }, active: { x: number; y: number; z: number } | null, spanX = 0) {
  if (!active) return { x: Math.round(room.width / 2), y: 0, z: Math.round(room.depth / 2) }
  return { x: Math.min(room.width - 100, active.x + spanX + 100), y: active.y, z: active.z }
}
