import { ConfigValidationError } from '../src/core/index'

/** Core қатесін URL өрісі мен рұқсат мәтінін қайталамай, бір сөйлемге айналдырады. */
export function shareErrorText(error: unknown, translate: (value: string) => string): string {
  if (error instanceof ConfigValidationError) {
    if (error.field === 'link') return translate('Ссылка на проект повреждена или устарела. Попросите новую ссылку.')
    return error.message
  }
  return translate('Не удалось открыть проект по этой ссылке.')
}
