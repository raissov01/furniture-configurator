/**
 * Тапсырыс реквизиттері (PRO100 паритеті, docs/pro100/parity.md §4-тің 1-тармағы):
 * Заказ · Дата · Клиент · Дизайнер · Примечание.
 *
 * `ProjectInfo` — ЕРІКТІ өріс (CLAUDE.md §7): ескі жоба реквизитсіз сол
 * күйінде ашылуы керек, `schemaVersion` көтерілмейді.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import {
  assemblyDrawingPdf, defaultShopProfile, findTemplate, generateCabinet, nestPanels,
  parseProject, parseProjectV4, priceProject, projectInfoRows, quotePdf, templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'
import { referenceProject } from './fixtures'

const font = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))

const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

describe('parseProject — реквизиттер ЕРІКТІ', () => {
  it('ескі жоба (реквизитсіз) бұрынғыдай ашылады', () => {
    const raw = JSON.parse(JSON.stringify(referenceProject))
    expect(raw.info).toBeUndefined()
    const parsed = parseProject(raw)
    expect(parsed.schemaVersion).toBe(3)
    expect(parsed.info).toBeUndefined()
  })

  it('реквизит берілсе — round-trip арқылы сақталады', () => {
    const withInfo = {
      ...referenceProject,
      info: {
        orderNo: 'ЗАКАЗ-42', date: '2026-09-20', client: 'Айгүл Сәтбаева',
        designer: 'Бекназар', note: 'Терезенің қасына қоймау',
      },
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(withInfo)))
    expect(parsed.info).toEqual(withInfo.info)
  })

  it('жарым-жартылай реквизит те дұрыс өтеді', () => {
    const project = { ...referenceProject, info: { client: 'Тек клиент аты' } }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.info).toEqual({ client: 'Тек клиент аты' })
  })

  it('schemaVersion өзгермейді', () => {
    const project = { ...referenceProject, info: { orderNo: '1' } }
    expect(parseProject(JSON.parse(JSON.stringify(project))).schemaVersion).toBe(3)
  })

  it('күнтізбеде жоқ күнді қабылдамайды, кібісе 29 ақпанды қабылдайды', () => {
    for (const date of ['2026-02-31', '2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01']) {
      expect(() => parseProject({ ...referenceProject, info: { date } }), date).toThrow(/info|date/)
    }
    expect(parseProject({ ...referenceProject, info: { date: '2000-02-29' } }).info?.date)
      .toBe('2000-02-29')
  })

  it('v3 → v4 және v4 JSON round-trip бес өрісті де сақтайды', () => {
    const info = {
      orderNo: 'ЗАКАЗ-42', date: '2026-09-24', client: 'Айгүл Сәтбаева',
      designer: 'Бекназар', note: 'Мәреге дейін жеткізу',
    }
    const migrated = parseProjectV4({ ...referenceProject, info })
    expect(migrated.info).toEqual(info)
    expect(parseProjectV4(JSON.parse(JSON.stringify(migrated))).info).toEqual(info)
    expect(() => parseProjectV4({ ...migrated, info: { ...info, date: '2026-02-31' } })).toThrow(/date/)
  })
})

describe('projectInfoRows — экспортта не басылатыны осыдан анықталады', () => {
  it('бос объект — бос тізім, ештеңе басылмайды', () => {
    expect(projectInfoRows({})).toEqual([])
  })

  it('әр өріс өз жолын шығарады, реті — Заказ · Дата · Заказчик · Дизайнер · Примечание', () => {
    const rows = projectInfoRows({
      orderNo: 'ЗАКАЗ-7', date: '2026-09-24', client: 'Дана', designer: 'Айым', note: 'жедел',
    })
    expect(rows).toEqual([
      { label: 'Заказ', value: 'ЗАКАЗ-7' },
      { label: 'Дата', value: '24.09.2026' },
      { label: 'Заказчик', value: 'Дана' },
      { label: 'Дизайнер', value: 'Айым' },
      { label: 'Примечание', value: 'жедел' },
    ])
  })

  it('толтырылмаған өріс тізімге кірмейді — бос жол баспайды', () => {
    expect(projectInfoRows({ orderNo: 'ЗАКАЗ-7' })).toEqual([{ label: 'Заказ', value: 'ЗАКАЗ-7' }])
    expect(projectInfoRows({ orderNo: undefined, client: 'Дана' }))
      .toEqual([{ label: 'Заказчик', value: 'Дана' }])
  })

  it('бос жол мен тек бос орыннан тұратын жол да басылмайды', () => {
    expect(projectInfoRows({ orderNo: '', client: '   ', designer: undefined })).toEqual([])
    expect(projectInfoRows({ date: '' })).toEqual([])
    expect(projectInfoRows({ date: '   ' })).toEqual([])
  })

  it('шеттегі бос орын қиылады', () => {
    expect(projectInfoRows({ client: '  Дана  ' })).toEqual([{ label: 'Заказчик', value: 'Дана' }])
  })
})

describe('quotePdf — КП-да реквизиттер', () => {
  const base = defaultShopProfile()
  const catalog = { materials: base.materials, edgeBands: base.edgeBands }
  const panels = generateCabinet(templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog), catalog)
  const nesting = nestPanels(panels, catalog)
  const pricedShop: ShopProfile = {
    ...base,
    materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
    edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
    hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
    labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
    markupPercent: 20,
  }
  const price = priceProject(panels, nesting, pricedShop)

  it('реквизитсіз де құжат бұрынғыдай шығады', async () => {
    const bytes = await quotePdf({
      price, shop: pricedShop, projectName: 'Шкаф', date: '20.09.2026', fonts,
    })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('реквизит берілсе — құжат ұзарады (қосымша жолдар салынды)', async () => {
    const without = await quotePdf({
      price, shop: pricedShop, projectName: 'Шкаф', date: '20.09.2026', fonts,
    })
    const withInfo = await quotePdf({
      price, shop: pricedShop, projectName: 'Шкаф', date: '20.09.2026', fonts,
      orderNo: 'ЗАКАЗ-42', customer: 'Айгүл', designer: 'Бекназар', note: 'ерекше тапсырыс',
    })
    expect(withInfo.length).toBeGreaterThan(without.length)
    const doc = await PDFDocument.load(withInfo)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('КП PDF-і жоба күні мен қалған төрт реквизитті нақты басады', async () => {
    const spy = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      await quotePdf({
        price, shop: pricedShop, projectName: 'Шкаф', date: '24.09.2026', fonts,
        orderNo: 'ЗАКАЗ-42', customer: 'Айгүл', designer: 'Бекназар', note: 'ерекше тапсырыс',
      })
      const text = spy.mock.calls.map(([value]) => value).join('\n')
      for (const fragment of [
        '24.09.2026', 'Заказ: ЗАКАЗ-42', 'Заказчик: Айгүл',
        'Дизайнер: Бекназар', 'Примечание: ерекше тапсырыс',
      ]) expect(text).toContain(fragment)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('assemblyDrawingPdf — цех құжатында реквизиттер', () => {
  const base = defaultShopProfile()
  const catalog = { materials: base.materials, edgeBands: base.edgeBands }
  const cabinet = templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog)
  const panels = generateCabinet(cabinet, catalog)

  it('info жоқта да сызба бұрынғыдай шығады', async () => {
    const bytes = await assemblyDrawingPdf({ cabinet, panels, catalog, projectName: 'Шкаф', fonts })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('info берілсе — сызба ұзарады', async () => {
    const without = await assemblyDrawingPdf({ cabinet, panels, catalog, projectName: 'Шкаф', fonts })
    const withInfo = await assemblyDrawingPdf({
      cabinet, panels, catalog, projectName: 'Шкаф', fonts,
      info: { orderNo: 'ЗАКАЗ-42', client: 'Айгүл', designer: 'Бекназар', note: 'ерекше тапсырыс' },
    })
    expect(withInfo.length).toBeGreaterThan(without.length)
  })

  it('сызба PDF-і бес реквизиттің нақты мәтінін drawText арқылы басады', async () => {
    const spy = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      await assemblyDrawingPdf({
        cabinet, panels, catalog, projectName: 'Шкаф', fonts,
        info: {
          orderNo: 'ЗАКАЗ-42', date: '2026-09-24', client: 'Айгүл',
          designer: 'Бекназар', note: 'ерекше тапсырыс',
        },
      })
      const text = spy.mock.calls.map(([value]) => value).join('\n')
      for (const fragment of [
        'Заказ: ЗАКАЗ-42', 'Дата: 24.09.2026', 'Заказчик: Айгүл',
        'Дизайнер: Бекназар', 'Примечание: ерекше тапсырыс',
      ]) expect(text).toContain(fragment)
    } finally {
      spy.mockRestore()
    }
  })
})
