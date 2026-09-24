'use client'

import { useMemo } from 'react'
import { ConfigValidationError, flattenTree } from '../src/core/index'
import type { FlatScene } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { projectProduction } from './projectProduction'

/** Strict production view: invalid current input must never reuse old panels. */
export function useProjectProduction() {
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const catalog = useConfigurator((s) => s.catalog)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const loadError = useConfigurator((s) => s.projectLoadError)
  return useMemo(() => {
    let scene: FlatScene = { nodes: [], solids: [] }
    let error: string | null = loadError
    if (!error) {
      try {
        scene = flattenTree(root, catalog, settings, layers)
      } catch (cause) {
        if (!(cause instanceof ConfigValidationError)) throw cause
        error = cause.message
      }
    }
    return { root, catalog, scene, error, ...projectProduction(root, scene) }
  }, [root, layers, catalog, settings, loadError])
}
