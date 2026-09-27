import type { CabinetConfig } from '@/src/core/types'

/** An unset system keeps the old shop clearance and Tandem hole pattern. */
export function showLegacyDrawerProfileWarning(system: CabinetConfig['drawerSystem'], hasDrawers: boolean): boolean {
  return hasDrawers && system === undefined
}
