import type { NetworkState } from '@/src/core/sync/types'

export function connectionState(browserOnline: boolean, network: NetworkState): 'offline' | 'unreachable' | 'online' {
  if (!browserOnline || network === 'offline') return 'offline'
  return network === 'unreachable' ? 'unreachable' : 'online'
}

export function connectionError(error: unknown, browserOnline: boolean): 'Нет сети' | 'Сервер недоступен' | null {
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return browserOnline ? 'Сервер недоступен' : 'Нет сети'
  }
  return null
}

export function mobileErrorMessage(error: unknown, fallback: string, browserOnline: boolean): string {
  return connectionError(error, browserOnline) ?? (error instanceof Error ? error.message : fallback)
}
