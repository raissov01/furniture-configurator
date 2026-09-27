import { DRILL_PRESETS, drillFromPreset, findDrillPreset, isDrillWithinMaterial } from '@/src/core/drillEdits'
import { validateJointDrill } from '@/src/core/autoJoint'
import type { Drill, Panel, SettingsOverride } from '@/src/core/types'

export function drillPresetOptions(settings: SettingsOverride) {
  return DRILL_PRESETS.map((preset) => findDrillPreset(preset.id, settings)!)
}

export function drillClickResult(
  panel: Panel, thickness: number, presetId: string, settings: SettingsOverride,
  spot: { face: Drill['face']; x: number; y: number },
): { drill: Drill; error?: never } | { error: string; drill?: never } {
  const preset = findDrillPreset(presetId, settings)
  if (!preset) return { error: `presetId: белгісіз пресет ${presetId}` }
  const edge = spot.face.startsWith('edge')
  if (edge !== (preset.where === 'edge')) {
    return { error: `face: ${preset.name} үшін ${preset.where === 'edge' ? 'торц' : 'жалпақ бет'} қажет` }
  }
  const drill = drillFromPreset(preset, spot.face, spot.x, spot.y, thickness)
  try {
    validateJointDrill(panel, drill, thickness, 'drill.position')
    if (!edge && !isDrillWithinMaterial(panel, drill.face, drill.x, drill.y)) {
      return { error: 'drill.position: тесік нақты материалдан тыс; рұқсат етілгені — кесілген панель контуры' }
    }
    return { drill }
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'drill.position: жарамсыз тесік' }
  }
}

export function drillDeleteDecision(freeBoard: boolean, manual: boolean): 'delete' | 'auto-board' {
  return freeBoard && !manual ? 'auto-board' : 'delete'
}
