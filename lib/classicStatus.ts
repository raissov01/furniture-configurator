import { panelDisplayLabel } from './panelDisplay'

export function selectedStatusName(selectedId: string | null,
  node: { id: string; name: string } | null | undefined,
  panel: { id: string; label: string } | undefined,
  translate?: (key: string) => string): string | null {
  if (!selectedId) return null
  if (panel?.id === selectedId) return panelDisplayLabel(panel.label, translate)
  return node?.id === selectedId ? node.name : selectedId
}

/** Құралға келгенде күй жолағы сол әрекетті түсіндіреді; кеткенде таңдау қайтады. */
export function classicToolStatus(
  hoveredLabel: string | null,
  selectedId: string | null,
  selectedName: string | null | undefined,
  selectedPrefix: string,
  emptyLabel: string,
): string {
  if (hoveredLabel) return hoveredLabel
  return selectedId ? `${selectedPrefix}: ${selectedName ?? selectedId}` : emptyLabel
}
