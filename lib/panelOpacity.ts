/** Рентген қабаттарының көріну ережелері; өндіріс дерегіне әсер етпейді. */
export function panelOpacity(input: {
  xray: boolean; viewMode: 'solid' | 'ghost' | 'wire'; hovered: boolean; selected: boolean
  lookOpacity: number; explodedFront?: boolean
}): number {
  if (input.xray) return 0.28 * input.lookOpacity
  if (input.explodedFront) return 0.3 * input.lookOpacity
  return (input.viewMode === 'solid' || input.hovered || input.selected ? 1
    : input.viewMode === 'ghost' ? 0.28 : 0.06) * input.lookOpacity
}

