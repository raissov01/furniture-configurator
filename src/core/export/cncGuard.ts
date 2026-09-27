import { ConfigValidationError } from '../errors'
import type { Panel } from '../types'

/** Артикулдық бекіту схемасы жоқ деталь станокқа жіберілмейді. */
export function requireCncReady(panel: Panel): void {
  if (panel.cncBlockReason) {
    throw new ConfigValidationError(
      `panels.${panel.id}.drilling`,
      panel.cncBlockReason,
      'расталған артикулдық присадка схемасы',
    )
  }
}

export function requireCncReadyPanels(panels: readonly Panel[]): void {
  for (const panel of panels) requireCncReady(panel)
}
