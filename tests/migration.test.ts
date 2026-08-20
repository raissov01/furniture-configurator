/**
 * §7 — сақталған жоба сынбауы керек. v1 (секцияларға дейінгі) файл v2-ге
 * көтерілгенде нәтиже МИЛЛИМЕТРГЕ дейін бұрынғымен бірдей болуы тиіс.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatCutList, generateCabinet, parseProject } from '../src/core/index.js'
import { catalog, referenceWardrobe } from './fixtures.js'

const v1 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../examples/wardrobe-v1.json', import.meta.url)), 'utf8'),
)

describe('schemaVersion 1 → 2', () => {
  const migrated = parseProject(v1)

  it('shelves/fronts бір flex секцияға оралады', () => {
    const cabinet = migrated.cabinets[0]!
    expect(migrated.schemaVersion).toBe(2)
    expect(cabinet.sections).toHaveLength(1)
    expect(cabinet.sections[0]!.widthMode).toBe('flex')
    expect(cabinet.sections[0]!.contents).toEqual([
      { kind: 'shelves', count: 4, shelfKind: 'adjustable' },
    ])
    expect(cabinet.sections[0]!.fronts).toEqual({ count: 2, mount: 'overlay' })
  })

  it('көшірілген жоба v2 эталонымен бірдей деталировка береді', () => {
    const fromV1 = formatCutList(generateCabinet(migrated.cabinets[0]!, catalog), catalog)
    const fromV2 = formatCutList(generateCabinet(referenceWardrobe, catalog), catalog)
    expect(fromV1).toEqual(fromV2)
  })

  it('сөресі жоқ v1 кабинет empty секцияға айналады', () => {
    const noShelves = {
      ...v1,
      cabinets: [{ ...v1.cabinets[0], shelves: { count: 0, kind: 'adjustable' } }],
    }
    expect(parseProject(noShelves).cabinets[0]!.sections[0]!.contents).toEqual([{ kind: 'empty' }])
  })

  it('белгісіз нұсқа үнсіз өтпейді', () => {
    expect(() => parseProject({ ...v1, schemaVersion: 99 })).toThrow(/Белгісіз schemaVersion/)
  })
})
