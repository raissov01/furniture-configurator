/**
 * §7 — сақталған жоба сынбауы керек. Ескі файл ЕҢ ЖАҢА пішінге көтерілгенде
 * нәтиже МИЛЛИМЕТРГЕ дейін бұрынғымен бірдей болуы тиіс.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatCutList, generateCabinet, parseProject } from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

const v1 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../examples/wardrobe-v1.json', import.meta.url)), 'utf8'),
)

describe('schemaVersion 1 → 3', () => {
  const migrated = parseProject(v1)

  it('shelves/fronts бір flex секцияға оралады', () => {
    const cabinet = migrated.cabinets[0]!
    expect(migrated.schemaVersion).toBe(3)
    expect(cabinet.sections).toHaveLength(1)
    expect(cabinet.sections[0]!.widthMode).toBe('flex')
    expect(cabinet.sections[0]!.contents).toEqual([
      { kind: 'shelves', count: 4, shelfKind: 'adjustable' },
    ])
    expect(cabinet.sections[0]!.fronts).toEqual({ count: 2, mount: 'overlay' })
  })

  it('ескі файлға бөлме мен орналастыру қосылады', () => {
    // v1-де бөлме ұғымы болмаған: шкаф жоғалып қалмауы үшін әдепкі бөлмеге қойылады.
    expect(migrated.room).toEqual({ width: 4000, depth: 3000, height: 2700 })
    expect(migrated.placements).toHaveLength(migrated.cabinets.length)
    expect(migrated.placements[0]).toMatchObject({ cabinetId: migrated.cabinets[0]!.id, wall: 'south', offset: 0 })
  })

  it('көшірілген жоба эталонымен бірдей деталировка береді', () => {
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

describe('schemaVersion 2 → 3', () => {
  const v2 = JSON.parse(
    readFileSync(fileURLToPath(new URL('../examples/wardrobe-3section.json', import.meta.url)), 'utf8'),
  )

  it('шкафтар бір қабырғаға қатарынан тізіледі, бірінің үстіне бірі шықпайды', () => {
    const many = { ...v2, cabinets: [v2.cabinets[0], { ...v2.cabinets[0], id: 'c2' }] }
    const migrated = parseProject(many)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.placements.map((p) => p.offset)).toEqual([0, many.cabinets[0].width])
  })

  it('кабинеттер өзгермейді — тек бөлме қосылады', () => {
    const migrated = parseProject(v2)
    expect(migrated.cabinets).toEqual(v2.cabinets)
  })

  it('белгісіз нұсқа үнсіз өтпейді', () => {
    expect(() => parseProject({ ...v2, schemaVersion: 9 })).toThrow(/schemaVersion/)
  })
})
