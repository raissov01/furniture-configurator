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
