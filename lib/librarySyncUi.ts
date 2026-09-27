/** Жеке кітапханаға жүктеу нәтижесінің UI мәтіні; HTTP нәтижесі ғана кіреді. */
export function libraryUploadOutcome(status: number, error: string | null): {
  savedToAccount: boolean
  message: string
  error: string | null
} {
  if (status >= 200 && status < 300) return { savedToAccount: true, message: 'Сохранено в аккаунте', error: null }
  if (status === 401 || status === 503) return { savedToAccount: false, message: 'Сохранено только на этом устройстве', error: null }
  return { savedToAccount: false, message: 'Сохранено только на этом устройстве',
    error: error || (status === 409 ? 'Кітапхана шегі: 200 элемент' : 'Не удалось сохранить в аккаунте') }
}

export function importUploadSummary(saved: number, total: number): string {
  return saved === total ? 'Библиотека импортирована в аккаунт'
    : 'Библиотека импортирована на устройство; в аккаунт загружено {saved} из {total}'
}

export const LIBRARY_AUTH_CHANGED_EVENT = 'aismebel:library-auth-changed'
