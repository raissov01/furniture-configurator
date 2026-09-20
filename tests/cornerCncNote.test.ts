/**
 * K9 (audit C9): деталировка мен ЧПУ индексі трапеция екенін АЙТПАЙДЫ.
 *
 * Бұрыштық корпустың дно/крышка/сөресі трапеция (`panel.bevel` бар), бірақ:
 *   1. `cncIndexCsv` «Фрезеровка» бағанын `cutouts`/`grooves`-тен ғана
 *      шығарады — `bevel` ескерілмейді, сондықтан цех индексте «нет» көреді,
 *      ал контур ТЕК DXF-те бар.
 *   2. Деталировканың «Примечание» бағаны бос — оператор тікбұрыш кеседі.
 *
 * Екі сынақ та қазір ҚҰЛАЙДЫ (nет / бос жол).
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  cncIndexCsv,
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** corner.test.ts-тегімен бірдей: ашық переходной модуль. */
const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...template,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
  }],
  ...patch,
})

describe('K9 / C9: ЧПУ индексі трапецияны фрезеровка деп белгілейді', () => {
  it('bevel бар деталь «Фрезеровка: есть — см. DXF» деп шығуы керек', () => {
    const panels = generateCabinet(corner(350), catalog)
    const top = panels.find((p) => p.id === 'top')!
    expect(top.bevel).toBeDefined()
    expect(top.cutouts).toHaveLength(0)
    expect(top.grooves).toHaveLength(0)

    const rows = cncIndexCsv([top], catalog, { projectName: 'Бұрыштық' })
      .replace(/^﻿/, '')
      .trimEnd()
      .split('\r\n')
      .map((l) => l.split(';'))
    const row = rows[1]!
    expect(row[9]).toBe('есть — см. DXF')
  })
})

describe('K9 / C9: деталировкада трапеция ескертілуі керек', () => {
  it('bevel бар деталь «Трапеция: 600→350» деген note алуы керек', () => {
    const panels = generateCabinet(corner(350), catalog)
    const top = panels.find((p) => p.id === 'top')!
    const rows = formatCutList(panels, catalog)
    const row = rows.find((r) => r.name === 'Крышка')!
    expect(top.note).toBe('')
    expect(row.note).toContain('Трапеция')
    expect(row.note).toContain('600')
    expect(row.note).toContain('350')
  })
})
