import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError,
  SEED_CATALOG,
  findTemplate,
  generateCabinet,
  generateHardware,
  templateToCabinet,
} from '../src/core/index'

const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

describe('F07 үстелтақта құрылғылары', () => {
  it('бір модульдегі мойка мен плитаны бір нүктеге қоймайды', () => {
    const both = {
      ...cabinet,
      fixtures: [{ kind: 'sink' as const }, { kind: 'hob' as const, fuel: 'gas' as const }],
    }
    for (const generate of [generateCabinet, generateHardware]) {
      expect(() => generate(both, SEED_CATALOG)).toThrow(ConfigValidationError)
      expect(() => generate(both, SEED_CATALOG)).toThrow(/fixtures/)
    }
  })
})
