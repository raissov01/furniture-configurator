/** Public links must not expose parser internals or shop validation text. */
export function viewerHashError(hash: string, _error: unknown): string {
  return hash ? 'Не удалось открыть проект по этой ссылке.' : 'В ссылке нет проекта. Попросите отправить её целиком.'
}

export function viewerPressedState(
  state: { walk: boolean; openness: number; preset: string },
  control: string,
): boolean {
  if (control === 'walk') return state.walk
  if (control === 'fronts') return state.openness > 0
  return state.preset === control
}
