import { useConfigurator } from '@/store/configurator'

type ConfiguratorState = ReturnType<typeof useConfigurator.getState>

/** Live Properties edits can be rolled back without creating an undo entry. */
export type PropertiesSession = Pick<ConfiguratorState,
  'root' | 'layers' | 'room' | 'cabinets' | 'placements' | 'activeId' |
  'past' | 'future' | 'lastEditKey' | 'lastEditAt' | 'showDimensions' |
  'projectSettings' | 'projectMaterials' | 'projectEdgeBands' | 'catalog' |
  'projectInfo' | 'priceOverrides'>

export function capturePropertiesSession(): PropertiesSession {
  const state = useConfigurator.getState()
  return {
    root: state.root, layers: state.layers, room: state.room,
    cabinets: state.cabinets, placements: state.placements, activeId: state.activeId,
    past: state.past, future: state.future, lastEditKey: state.lastEditKey, lastEditAt: state.lastEditAt,
    showDimensions: state.showDimensions, projectSettings: state.projectSettings,
    projectMaterials: state.projectMaterials, projectEdgeBands: state.projectEdgeBands,
    catalog: state.catalog, projectInfo: state.projectInfo, priceOverrides: state.priceOverrides,
  }
}

export function restorePropertiesSession(session: PropertiesSession): void {
  useConfigurator.setState(session)
  useConfigurator.getState().saveProjectLocally()
}

/** Name is committed before Apply/OK, including programmatic button activation. */
export function commitPropertiesName(nodeId: string, value: string): string | null {
  if (!value.trim()) return 'Название не может быть пустым'
  try {
    useConfigurator.getState().renameNode(nodeId, value)
    return null
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'Не удалось изменить деталь'
  }
}
