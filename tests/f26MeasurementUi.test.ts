import { describe, expect, it } from 'vitest'
import { parseWholeInput, toleranceIssue, locationIssue, nextNetworkMessage } from '@/components/mobile/measurementUiLogic'

describe('F26 measurement UI rules', () => {
  it('keeps blank, fractional and text input invalid instead of coercing it', () => {
    for (const raw of ['', ' ', '1.5', '-1', 'Қазақ', '9007199254740992']) {
      expect(parseWholeInput(raw, 0)).toBeNull()
    }
    expect(parseWholeInput('0', 0)).toBe(0)
    expect(parseWholeInput('12', 1)).toBe(12)
  })

  it('names the first invalid tolerance before kitchen handoff', () => {
    expect(toleranceIssue('-1', '0')).toBe('wallMm')
    expect(toleranceIssue('0', '1.5')).toBe('cornerDeg')
    expect(toleranceIssue('', '0')).toBe('wallMm')
    expect(toleranceIssue('0', '0')).toBeNull()
  })

  it('distinguishes wall overflow from height overflow and gives measured limits', () => {
    const location = { offset: 2990, width: 20, elevation: 0, height: 10 }
    expect(locationIssue(location, 3000, 2400)).toEqual({ axis: 'wall', actual: 3010, limit: 3000 })
    expect(locationIssue({ ...location, offset: 20, elevation: 2395 }, 3000, 2400))
      .toEqual({ axis: 'height', actual: 2405, limit: 2400 })
    expect(locationIssue({ ...location, offset: 20 }, 3000, 2400)).toBeNull()
  })

  it('clears only a stale network failure after connection recovery', () => {
    expect(nextNetworkMessage('Failed to fetch', true)).toBe('')
    expect(nextNetworkMessage('Сервер недоступен', true)).toBe('')
    expect(nextNetworkMessage('Замер уже сохранён', true)).toBe('Замер уже сохранён')
    expect(nextNetworkMessage('Failed to fetch', false)).toBe('Нет сети')
  })
})
