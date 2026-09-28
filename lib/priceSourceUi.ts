import type { PriceLine } from '@/src/core/pricing'

export function priceSourceRows(line: PriceLine): Array<{ id: string; qty: number; cost: number }> {
  return (line.sources ?? []).map((source) => ({
    id: source.panelId ?? source.nodeId ?? `placement-${(source.placementIndex ?? 0) + 1}`,
    qty: source.qty,
    cost: source.cost,
  }))
}
