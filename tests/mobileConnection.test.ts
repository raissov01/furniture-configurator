import { describe, expect, it } from 'vitest'
import { connectionState, connectionError } from '../components/mobile/connectionState'

describe('mobile connection presentation', () => {
  it('shows server unavailable when fetch fails despite navigator.onLine', () => {
    expect(connectionState(true, 'unreachable')).toBe('unreachable')
    expect(connectionError(new TypeError('Failed to fetch'), true)).toBe('Сервер недоступен')
  })

  it('shows offline when browser reports no network', () => {
    expect(connectionState(false, 'unknown')).toBe('offline')
    expect(connectionError(new TypeError('Failed to fetch'), false)).toBe('Нет сети')
  })
})
