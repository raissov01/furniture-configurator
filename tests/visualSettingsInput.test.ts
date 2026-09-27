import { describe, expect, it } from 'vitest'
import { parseVisualNumber, parseNormalUrl } from '../lib/visualSettingsInput'

describe('көрініс өрістерінің енгізуі', () => {
  it('бос, мәтін және шектен тыс мәнді санға айналдырмайды', () => {
    for (const raw of ['', 'abc', '0x10', '1e2', '101', '-1']) {
      const result = parseVisualNumber(raw, 'Интенсивность', 0, 100)
      expect(result.value).toBeNull()
      expect(result.error).toContain('Интенсивность')
      expect(result.error).toContain('0–100')
    }
  })
  it('координатаның бөлшек мәнін қабылдамайды', () => {
    expect(parseVisualNumber('1.5', 'Позиция X, мм', -100000, 100000, true).error).toContain('Позиция X, мм')
    expect(parseVisualNumber('12', 'Позиция X, мм', -100000, 100000, true).value).toBe(12)
  })
  it('PBR optional бос өріс қана анықталмаған болады', () => {
    expect(parseVisualNumber('', 'Шероховатость', 0, 1, false, true)).toEqual({ value: undefined, error: null })
    expect(parseVisualNumber('0.35', 'Шероховатость', 0, 1).value).toBe(0.35)
  })
  it('normal картаға http(s) URL талап етеді', () => {
    expect(parseNormalUrl('қазақ').error).toContain('URL')
    expect(parseNormalUrl('https://example.test/normal.png').value).toBe('https://example.test/normal.png')
  })
})
