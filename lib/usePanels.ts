'use client'

/**
 * Конфиг → Panel[]. Бұл жалғыз шақыру орны: 3D те, деталировка да осы
 * нәтижені оқиды, сондықтан олар ешқашан келіспей қала алмайды.
 */

import { useMemo, useRef } from 'react'
import { ConfigValidationError, generateCabinet } from '@/src/core/index'
import type { CabinetConfig, Catalog, Panel } from '@/src/core/index'

export type PanelsResult = {
  panels: Panel[]
  /** Валидация қатесі — параметр аты мен рұқсат етілген аралығымен */
  error: { field: string; message: string; allowed?: string | undefined } | null
  /** Генерация уақыты, мс — C1 бюджеті: 40 панельге < 100 мс */
  ms: number
  /** Конфиг жарамсыз болса, соңғы ЖАРАМДЫ панельдер көрсетіледі: экран қарайып қалмайды */
  stale: boolean
}

export function usePanels(cabinet: CabinetConfig, catalog: Catalog): PanelsResult {
  const lastValid = useRef<Panel[]>([])

  return useMemo(() => {
    const started = performance.now()
    try {
      const panels = generateCabinet(cabinet, catalog)
      lastValid.current = panels
      return { panels, error: null, ms: performance.now() - started, stale: false }
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        return {
          panels: lastValid.current,
          error: { field: err.field, message: err.message, allowed: err.allowed },
          ms: performance.now() - started,
          stale: true,
        }
      }
      throw err
    }
  }, [cabinet, catalog])
}
