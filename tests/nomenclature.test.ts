import { describe, expect, it } from 'vitest'
import { importNomenclature, makeNomenclatureTemplates, rowsFromArchivePaths, type NomenclatureRow } from '../src/core/nomenclature'
import { SEED_CATALOG, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import sourceRows from '../docs/pro100/nomenclature.json'
import generatedManifest from '../src/core/data/generated/standardNomenclature.json'
import { filterTemplateCatalog } from '../src/core/templateCatalog'

const row = (raw: string, kind: NomenclatureRow['kind'], width: number | null,
  doors = 0, drawers = 0, special: string | null = null, count = 1): NomenclatureRow =>
  ({ raw, category: 'Кухни', kind, width, doors, drawers, special, count })

describe('PRO100 атауларын шаблонға сәйкестендіру', () => {
  it('архив жолдарының тек атауын оқиды, .meb мазмұнын ашпайды', () => {
    const rows = rowsFromArchivePaths([
      'PRO100/Библиотека/Мебель/01 Кухни Модерн/Верхние/В - 600 2Дв.meb',
      'PRO100/Библиотека/Мебель/01 Кухни Модерн/Нижние/Н В3 500.meb',
      'PRO100/Библиотека/Мебель/01 Кухни Модерн/Нижние/Н 2дв Мойка 800.meb',
      'PRO100/Библиотека/Материалы/Дуб.jpg',
    ])
    expect(rows).toHaveLength(3)
    expect(importNomenclature(rows).matched.map((item) => item.id)).toEqual([
      'standard-base-drawers-3-500', 'standard-sink-2-800', 'standard-wall-2-600',
    ])
  })
  it('бір типтің ені мен қайталануын біріктіреді; есік/ящик санын сақтайды', () => {
    const result = importNomenclature([
      row('В - 600 2Дв', 'wall', 600, 2, 0, null, 8),
      row('В 2дв 600', 'wall', 600, 2, 0, null, 3),
      row('Н В3 500', 'base', 500, 0, 3, null, 4),
      row('Н 2дв Мойка 800', 'base', 800, 2, 0, 'мойка (раковина)', 2),
    ])
    expect(result.matched).toEqual([
      expect.objectContaining({ id: 'standard-base-drawers-3-500', baseId: 'kitchen-base-drawers-600', width: 500, sourceCount: 4 }),
      expect.objectContaining({ id: 'standard-sink-2-800', baseId: 'kitchen-sink-800', width: 800, sourceCount: 2 }),
      expect.objectContaining({ id: 'standard-wall-2-600', baseId: 'kitchen-wall-600', width: 600, sourceCount: 11, sourceNames: ['В - 600 2Дв', 'В 2дв 600'] }),
    ])
    expect(result.unmatched).toEqual([])
  })

  it('қосымша механизмі, белгісіз типі не күмәнді өлшемі бар атауды есепке қалдырады', () => {
    const result = importNomenclature([
      row('В 600 Hxs', 'wall', 600),
      row('Н угловой 1000', 'base', 1000),
      row('Н В3 1000', 'base', 1000, 0, 3),
      row('Н В3 600 варка', 'base', 600, 0, 3),
      row('В 1дв 400', 'wall', null, 1),
      row('В 2дв 600', 'wall', 700, 2),
    ])
    expect(result.matched).toEqual([])
    expect(result.unmatched.map((entry) => entry.reason)).toEqual([
      'unsupported-type', 'unsupported-type', 'width-out-of-range', 'unsupported-type', 'unknown-width', 'inconsistent-width',
    ])
  })

  it('импорт қатары нақты генератор арқылы сол ен мен жабдық санын шығарады', () => {
    const manifest = importNomenclature([
      row('В 1дв 400', 'wall', 400, 1),
      row('Н В4 600', 'base', 600, 0, 4),
    ]).matched
    const templates = makeNomenclatureTemplates(SEED_TEMPLATES, manifest)
    expect(templates).toHaveLength(2)
    const wall = templates.find((item) => item.id === 'standard-wall-1-400')!
    expect(wall.width).toBe(400)
    expect(wall.name).toBe('В 1дв 400')
    expect(wall.sections[0]?.fronts?.count).toBe(1)
    const drawers = templates.find((item) => item.id === 'standard-base-drawers-4-600')!
    expect(drawers.sections[0]?.contents[0]).toMatchObject({ kind: 'drawers', count: 4 })
    for (const template of templates) expect(generateCabinet(templateToCabinet(template, SEED_CATALOG), SEED_CATALOG).length).toBeGreaterThan(4)
  })

  it('реподағы манифест бастапқы 5 094 атаудан қайта бірдей шығады', () => {
    const result = importNomenclature(sourceRows as NomenclatureRow[])
    expect(result.matched).toEqual(generatedManifest)
    expect(result.matched).toHaveLength(35)
    expect(result.matched.reduce((sum, item) => sum + item.sourceCount, 0)).toBe(752)
    expect(result.unmatched.reduce((sum, item) => sum + item.count, 0)).toBe(4342)
    expect(STANDARD_NOMENCLATURE_TEMPLATES).toHaveLength(35)
    expect(findTemplate('standard-wall-2-600')?.width).toBe(600)
    expect(SEED_TEMPLATES).toHaveLength(45)
    expect(filterTemplateCatalog(STANDARD_NOMENCLATURE_TEMPLATES, { search: 'Н В3 500' }).map((item) => item.id))
      .toEqual(['standard-base-drawers-3-500'])
  })
})
