/** Available actions for the selected tree row, independent of React state. */
export function contextActions(kind: string, selectedCount: number, cabinetCount: number, locked: boolean) {
  return {
    properties: !locked && kind !== 'root',
    copy: !locked && kind === 'cabinet',
    delete: !locked && (kind === 'board' || kind === 'annotation' || kind === 'cabinet' && cabinetCount > 1),
    group: !locked && selectedCount >= 2,
    ungroup: !locked && kind === 'group' && selectedCount === 1,
    door: kind === 'part',
  }
}
