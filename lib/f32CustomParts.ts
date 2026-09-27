import type { CabinetConfig } from '@/src/core/types'

/** Жаңа деталь ешбір сақталған override кілтін де мұраламауы керек. */
export function nextCustomPartId(
  parts: readonly { id: string }[], historicalIds: readonly string[], nonce: string,
): string {
  const used = new Set([...parts.map((part) => part.id), ...historicalIds])
  let id = `custom-${nonce}`
  let suffix = 2
  while (used.has(id)) { id = `custom-${nonce}-${suffix}`; suffix += 1 }
  return id
}

function withoutId<T>(record: Record<string, T> | undefined, id: string): Record<string, T> | undefined {
  if (!record) return undefined
  const result = { ...record }
  delete result[id]
  return result
}

/** Бір edit/undo жазбасында деталь мен оған байланған барлық жазбаны өшіреді. */
export function removeCustomPart(cabinet: CabinetConfig, id: string): Partial<CabinetConfig> {
  return {
    customParts: cabinet.customParts?.filter((part) => part.id !== id) ?? [],
    panelCutouts: withoutId(cabinet.panelCutouts, id),
    drillEdits: withoutId(cabinet.drillEdits, id),
    panelCorners: withoutId(cabinet.panelCorners, id),
    panelGrain: withoutId(cabinet.panelGrain, id),
  }
}
