import { ConfigValidationError } from '../src/core/index'
import { shareErrorText } from '../lib/shareLinkError'

/** Public links must not expose parser internals or shop validation text. */
export function viewerHashError(hash: string, error: unknown): string {
  if (!hash) return 'В ссылке нет проекта. Попросите отправить её целиком.'
  if (error instanceof ConfigValidationError && error.field === 'link') {
    return shareErrorText(error, (message) => message)
  }
  return 'Не удалось открыть проект по этой ссылке.'
}

export function viewerPressedState(
  state: { walk: boolean; openness: number; preset: string },
  control: string,
): boolean {
  if (control === 'walk') return state.walk
  if (control === 'fronts') return state.openness > 0
  return state.preset === control
}
