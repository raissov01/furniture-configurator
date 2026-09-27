/** Delete тек анық таңдалған, өңдеуге рұқсатты нысанға әсер етеді. */
export function deleteAction(
  kind: string | null,
  editable: boolean,
  cabinetCount: number,
  boardHasJoint: boolean,
): 'board' | 'cabinet' | 'annotation' | null {
  if (!editable) return null
  if (kind === 'board' && !boardHasJoint) return 'board'
  if (kind === 'cabinet' && cabinetCount > 1) return 'cabinet'
  if (kind === 'annotation') return 'annotation'
  return null
}

export function resetDecision(confirmed: boolean): 'reset' | 'keep' {
  return confirmed ? 'reset' : 'keep'
}
