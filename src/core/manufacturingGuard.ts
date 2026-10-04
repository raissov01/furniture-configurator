import { ConfigValidationError } from './errors'
import type { Panel } from './types'

/** Partial imports remain usable as previews, never as workshop instructions. */
export function requireManufacturingReady(panel: Panel): void {
  if (panel.manufacturingBlockReason) {
    throw new ConfigValidationError(`panels.${panel.id}.manufacturing`, panel.manufacturingBlockReason,
      'полная проверенная геометрия без потерь импорта')
  }
}

export function requireManufacturingReadyPanels(panels: readonly Panel[]): void {
  for (const panel of panels) requireManufacturingReady(panel)
}
