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
  const autoJoints = useConfigurator((s) => s.autoJoints)
  const loadError = useConfigurator((s) => s.projectLoadError)
  return useMemo(() => {
    let scene: FlatScene = { nodes: [], solids: [] }
    const broken = autoJoints.find((joint) => joint.status === 'broken')
    let error: string | null = loadError ?? (broken
      ? `${broken.error?.field ?? 'joint.boardIds'}: ${broken.error?.message ?? 'автоматты буын бұзылды'}`
      : null)
    if (!error) {
      try {
        scene = flattenTree(root, catalog, settings, layers, autoJoints)
      } catch (cause) {
        if (!(cause instanceof ConfigValidationError)) throw cause
        error = cause.message
      }
    }
    return { root, catalog, scene, error, ...projectProduction(root, scene, catalog.materials) }
  }, [root, layers, catalog, settings, autoJoints, loadError])
}
