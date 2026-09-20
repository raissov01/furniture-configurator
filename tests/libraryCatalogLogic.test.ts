/**
 * «Библиотека» панелінің таза логикасының тесті (іздеу/санат сүзгісі,
 * беттеу, PRO100 → ішкі шаблон таңдау). React/store жоқ.
 */
import { describe, expect, it } from 'vitest'
import {
  categoryLabel,
  categoryOptions,
  filterItems,
  paginate,
  pickTemplateForCabinetItem,
} from '../components/panels/libraryCatalogLogic'
import { findTemplate } from '../src/core/index'

describe('categoryLabel/categoryOptions', () => {
  it('«Мебель» түбір бумасын алып тастайды', () => {
    expect(categoryLabel(['Мебель', '01 Кухни Модерн', 'Верхние'])).toBe('01 Кухни Модерн \\ Верхние')
  })

  it('categoryOptions бірегей әрі алфавитпен сұрыпталған', () => {
    const items = [
      { name: 'a', path: ['Мебель', 'Б', 'X'] },
      { name: 'b', path: ['Мебель', 'А', 'Y'] },
      { name: 'c', path: ['Мебель', 'Б', 'X'] },
    ]
    expect(categoryOptions(items)).toEqual(['А \\ Y', 'Б \\ X'])
  })
})

describe('filterItems', () => {
  const items = [
    { name: 'Н 2дв Мойка 600', path: ['Мебель', 'Кухни', 'Нижние'] },
    { name: 'В 300 1дв', path: ['Мебель', 'Кухни', 'Верхние'] },
    { name: 'Ручка 128мм', path: ['Мебель', 'Ручки'] },
  ]

  it('іздеу — регистрге тәуелсіз ішкі жол сәйкестігі', () => {
    expect(filterItems(items, { search: 'мойка', categoryPath: null })).toHaveLength(1)
    expect(filterItems(items, { search: 'РУЧКА', categoryPath: null })).toHaveLength(1)
  })

  it('бос іздеу — бәрін қайтарады', () => {
    expect(filterItems(items, { search: '', categoryPath: null })).toHaveLength(3)
  })

  it('санат сүзгісі — дәл сәйкестік немесе ішкі бума', () => {
    expect(filterItems(items, { search: '', categoryPath: 'Кухни' })).toHaveLength(2)
    expect(filterItems(items, { search: '', categoryPath: 'Кухни \\ Нижние' })).toHaveLength(1)
    expect(filterItems(items, { search: '', categoryPath: 'Ручки' })).toHaveLength(1)
  })

  it('іздеу мен санат бірге қолданылады', () => {
    expect(filterItems(items, { search: '300', categoryPath: 'Кухни \\ Верхние' })).toHaveLength(1)
    expect(filterItems(items, { search: '300', categoryPath: 'Кухни \\ Нижние' })).toHaveLength(0)
  })
})

describe('paginate — 5094 жолды бірден рендерлемеу (гоча №4)', () => {
  const items = Array.from({ length: 205 }, (_, i) => i)

  it('бетке бөледі', () => {
    const { pageItems, totalPages } = paginate(items, 0, 60)
    expect(pageItems).toHaveLength(60)
    expect(pageItems[0]).toBe(0)
    expect(totalPages).toBe(4)
  })

  it('соңғы бет толымсыз болуы мүмкін', () => {
    const { pageItems } = paginate(items, 3, 60)
    expect(pageItems).toHaveLength(25)
  })

  it('шектен тыс бет нөмірі соңғы/бірінші бетке қысылады', () => {
    expect(paginate(items, 999, 60).page).toBe(3)
    expect(paginate(items, -5, 60).page).toBe(0)
  })

  it('бос тізім — 1 бет, бос жол', () => {
    const { pageItems, totalPages } = paginate([] as number[], 0, 60)
    expect(pageItems).toEqual([])
    expect(totalPages).toBe(1)
  })
})

describe('pickTemplateForCabinetItem — PRO100 → ең жақын ішкі шаблон', () => {
  it('hasSink — мойка шаблоны', () => {
    const { templateId } = pickTemplateForCabinetItem({ hasSink: true, position: 'lower', widthMm: 800 })
    expect(templateId).toBe('kitchen-sink-800')
  })

  it('position upper — үстіңгі шаблон', () => {
    const { templateId } = pickTemplateForCabinetItem({ position: 'upper', widthMm: 600 })
    expect(templateId).toBe('kitchen-wall-600')
  })

  it('drawerCount бар — ящикті нижний шаблон', () => {
    const { templateId } = pickTemplateForCabinetItem({ position: 'lower', drawerCount: 3 })
    expect(templateId).toBe('kitchen-base-drawers-600')
  })

  it('ештеңе табылмаса — әдепкі нижний', () => {
    const { templateId } = pickTemplateForCabinetItem({})
    expect(templateId).toBe('kitchen-base-600')
  })

  it('ені шаблонның қолдайтын ауқымына сыйдырылады (шектен шықпайды)', () => {
    const { templateId, size } = pickTemplateForCabinetItem({ position: 'lower', widthMm: 50 })
    const template = findTemplate(templateId)!
    expect(size.width).toBe(template.range.width.min)
  })

  it('таңдалған templateId барлық жағдайда SEED_TEMPLATES-те бар нақты id', () => {
    const cases: Parameters<typeof pickTemplateForCabinetItem>[0][] = [
      {}, { position: 'lower' }, { position: 'upper' }, { position: 'combined' },
      { hasSink: true }, { drawerCount: 2 },
    ]
    for (const parsed of cases) {
      const { templateId } = pickTemplateForCabinetItem(parsed)
      expect(findTemplate(templateId), templateId).toBeDefined()
    }
  })
})
