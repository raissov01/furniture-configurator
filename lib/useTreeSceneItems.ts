'use client'

import { useMemo, useRef } from 'react'
import { ConfigValidationError, flattenTree } from '../src/core/index'
import { treeSceneItems } from './treeSceneItems'
import type { AutoJointRecord, Catalog, FlatScene, GroupNode, Layer, Room, SettingsOverride } from '../src/core/index'

/** Invalid edits keep the previous preview, while consumers receive the error. */
export function flattenForPreview(
  root: GroupNode, catalog: Catalog, settings: SettingsOverride | undefined,
  layers: Layer[], lastValid: FlatScene, autoJoints?: readonly AutoJointRecord[],
): { scene: FlatScene; error: ConfigValidationError | null } {
  try {
    return { scene: flattenTree(root, catalog, settings, layers, autoJoints), error: null }
  } catch (error) {
    if (!(error instanceof ConfigValidationError)) throw error
    return { scene: lastValid, error }
  }
}

/** Keeps the previous valid scene while a numeric cabinet field is being edited. */
export function useTreeSceneItems(
  root: GroupNode, room: Room, catalog: Catalog, settings: SettingsOverride | undefined, layers: Layer[],
  autoJoints?: readonly AutoJointRecord[],
) {
  const lastValid = useRef({ root, room, layers, scene: { nodes: [], solids: [] } as FlatScene })
  return useMemo(() => {
    const { scene, error } = flattenForPreview(root, catalog, settings, layers, lastValid.current.scene, autoJoints)
    if (!error) lastValid.current = { root, room, layers, scene }
    const preview = error ? lastValid.current : { root, room, layers, scene }
    return { scene, error, stale: error !== null,
      ...treeSceneItems(preview.root, preview.room, preview.scene, preview.layers) }
  }, [root, room, catalog, settings, layers, autoJoints])
}
