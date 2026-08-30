/**
 * Шаблон кітапханасы (A6). Басты талап: КІТАПХАНАДАҒЫ ӘР ШАБЛОН нақты
 * жиналатын корпус беруі керек. Шаблон — «дайын» деп ұсынылған нәрсе,
 * сондықтан оның біреуі валидациядан құласа, бұл клиентке кеткен қате.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  SEED_TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplate,
  formatCutList,
  generateCabinet,
  templateToCabinet,
} from '../src/core/index'

describe('шаблон кітапханасы', () => {
  it('id-лер бірегей', () => {
    const ids = SEED_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('әр шаблонның категориясы тізімде бар', () => {
    const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.value))
    for (const t of SEED_TEMPLATES) {
      expect(known.has(t.category), `${t.id}: ${t.category}`).toBe(true)
    }
  })

  it('үнсіз габарит өз аралығының ішінде жатыр', () => {
    for (const t of SEED_TEMPLATES) {
      expect(t.height, `${t.id}.height`).toBeGreaterThanOrEqual(t.range.height.min)
      expect(t.height, `${t.id}.height`).toBeLessThanOrEqual(t.range.height.max)
      expect(t.width, `${t.id}.width`).toBeGreaterThanOrEqual(t.range.width.min)
      expect(t.width, `${t.id}.width`).toBeLessThanOrEqual(t.range.width.max)
      expect(t.depth, `${t.id}.depth`).toBeGreaterThanOrEqual(t.range.depth.min)
      expect(t.depth, `${t.id}.depth`).toBeLessThanOrEqual(t.range.depth.max)
    }
  })

  it('әр шаблон панель береді және деталировкасы бос емес', () => {
    for (const t of SEED_TEMPLATES) {
      const cabinet = templateToCabinet(t, SEED_CATALOG)
      const panels = generateCabinet(cabinet, SEED_CATALOG)
      const rows = formatCutList(panels, SEED_CATALOG)
      expect(panels.length, `${t.id}: панель саны`).toBeGreaterThan(0)
      expect(rows.length, `${t.id}: позиция саны`).toBeGreaterThan(0)
      // Бүйір + крышка + дно + арт қабырға = кез келген корпуста ең азы 4 деталь.
      expect(panels.length, `${t.id}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('аралықтың екі шетінде де жиналады', () => {
    for (const t of SEED_TEMPLATES) {
      for (const size of [
        { height: t.range.height.min, width: t.range.width.min, depth: t.range.depth.min },
        { height: t.range.height.max, width: t.range.width.max, depth: t.range.depth.max },
      ]) {
        const cabinet = templateToCabinet(t, SEED_CATALOG, size)
        expect(() => generateCabinet(cabinet, SEED_CATALOG), `${t.id} @ ${size.height}×${size.width}×${size.depth}`).not.toThrow()
      }
    }
  })

  it('секция саны шаблондағыдай, перегородка саны = секция − 1', () => {
    for (const t of SEED_TEMPLATES) {
      const cabinet = templateToCabinet(t, SEED_CATALOG)
      const panels = generateCabinet(cabinet, SEED_CATALOG)
      const dividers = panels.filter((p) => p.role === 'divider')
      expect(dividers.length, `${t.id}`).toBe(t.sections.length - 1)
    }
  })

  it('шаблон объектісі өзгермейді: конфиг терең көшірме алады', () => {
    const t = findTemplate('wardrobe-3sec-1800')!
    const cabinet = templateToCabinet(t, SEED_CATALOG)
    cabinet.sections[0]!.contents[0] = { kind: 'empty' }
    cabinet.sections[1]!.fronts = { count: 9, mount: 'overlay' }
    expect(t.sections[0]!.contents[0]).toEqual({ kind: 'shelves', count: 5, shelfKind: 'adjustable' })
    expect(t.sections[1]!.fronts).toBeNull()
  })

  it('пенал шаблоны эталон снапшотпен бірдей: 11 деталь / 6 позиция', () => {
    const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
    const panels = generateCabinet(cabinet, SEED_CATALOG)
    expect(panels).toHaveLength(11)
    expect(formatCutList(panels, SEED_CATALOG)).toHaveLength(6)
  })

  it('өлшемді ішінара ғана өзгертуге болады', () => {
    const t = findTemplate('kitchen-base-600')!
    const cabinet = templateToCabinet(t, SEED_CATALOG, { width: 900 })
    expect(cabinet.width).toBe(900)
    expect(cabinet.height).toBe(t.height)
    expect(cabinet.depth).toBe(t.depth)
  })

  it('каталогта жоқ материалға түсінікті қате береді', () => {
    const broken = { ...findTemplate('kitchen-base-600')!, carcassMaterialId: 'нет-такого' }
    expect(() => templateToCabinet(broken, SEED_CATALOG)).toThrow(/carcassMaterialId/)
  })
})
