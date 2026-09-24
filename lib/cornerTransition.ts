import type { CabinetConfig } from '@/src/core/index'

/** When a divider is removed, its former fixed opening cannot describe the whole cabinet. */
export function enableCornerCabinet(cabinet: CabinetConfig): Pick<CabinetConfig, 'corner' | 'back' | 'sections'> {
  const first = cabinet.sections[0]!
  return {
    corner: { depthAtRight: Math.round(cabinet.depth / 2) },
    back: { mode: 'none' },
    sections: [{ ...first, widthMode: 'flex', width: undefined, fronts: null }],
  }
}
