/**
 * Раскрой картасы мен КП экспорты.
 *
 * КП-ның басты ережесі осында да күзетіледі: бағасы толтырылмаған позиция
 * болса, құжат МҮЛДЕ шықпайды. Тексеру UI-да ғана болса, оны айналып өтіп
 * шақыруға болады да, ойдан жазылған баға клиентке кетеді.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import {
  defaultShopProfile,
  cutPlan,
  findTemplate,
  formatTenge,
  generateCabinet,
  nestPanels,
  nestedSheetToDxf,
  nestingPdf,
  nestingToDxfFiles,
  priceProject,
  quotePdf,
  templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

const font = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))

const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

const base = defaultShopProfile()
const catalog = { materials: base.materials, edgeBands: base.edgeBands }
const panels = generateCabinet(templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog), catalog)
const nesting = nestPanels(panels, catalog)

const pricedShop: ShopProfile = {
  ...base,
  name: 'Цех «Алаш»',
  city: 'Астана',
  phone: '+7 700 000 00 00',
  materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
  labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
  markupPercent: 20,
}

describe('раскрой DXF', () => {
  const files = nestingToDxfFiles(nesting)

  it('әр параққа бір файл', () => {
    expect(files.size).toBe(nesting.sheetCount)
    for (const name of files.keys()) expect(name.endsWith('.dxf')).toBe(true)
  })

  it('миллиметрде әрі дұрыс жабылады', () => {
    for (const content of files.values()) {
      expect(content).toMatch(/\$INSUNITS\n\s*70\n4/)
      expect(content.startsWith('0\nSECTION')).toBe(true)
      expect(content.trimEnd().endsWith('EOF')).toBe(true)
    }
  })

  it('парақ, деталь мен отход БӨЛЕК қабатта — станок қабатты аспапқа байлайды', () => {
    const sheet = nesting.byMaterial[0]!.sheets[0]!
    const dxf = nestedSheetToDxf(sheet, 'ЛДСП')
    expect(dxf).toContain('SHEET')
    expect(dxf).toContain('USABLE')
    expect(dxf).toContain('PART')
    expect(dxf).toContain('TEXT')
  })

  it('DXF кесу ретін бөлек анықтамалық қабатта нөмірлеп береді', () => {
    const sheet = nesting.byMaterial[0]!.sheets[0]!
    const file = nestingToDxfFiles(nesting).get(`${sheet.materialId}-list-${sheet.index}.dxf`)!
    expect(file).toContain('CUT_ORDER_REFERENCE')
    expect(file).toMatch(/CUT 1 (TRIM|SPLIT|SIZE)/)
    const cutPaths = file.split('LWPOLYLINE').filter((chunk) => chunk.startsWith('\n8\nCUT_ORDER_REFERENCE'))
    const planned = cutPlan(nesting).byMaterial[0]!.sheets[0]!.cuts
    expect(cutPaths).toHaveLength(planned.length)
    const first = planned[0]!
    const x = first.axis === 'v' ? first.at : first.from
    const y = first.axis === 'v' ? first.from : first.at
    expect(cutPaths[0]).toContain(`10\n${x}.0\n20\n${y}.0`)
  })

  it('әр деталь контур болып шығады', () => {
    const sheet = nesting.byMaterial[0]!.sheets[0]!
    const dxf = nestedSheetToDxf(sheet, 'ЛДСП')
    const partOutlines = dxf.split('LWPOLYLINE').filter((chunk) => chunk.startsWith('\n8\nPART'))
    expect(partOutlines).toHaveLength(sheet.parts.length)
  })

  it('мәтін латынға аударылады — ескі оқығыш кириллицаны бұзады', () => {
    const dxf = nestedSheetToDxf(nesting.byMaterial[0]!.sheets[0]!, 'ЛДСП Дуб')
    expect(dxf).toContain('LDSP')
    expect(dxf).not.toMatch(/[А-Яа-я]/)
  })
})

describe('раскрой PDF', () => {
  it('37-ден көп белгі болса аңыздың жалғасын жоғалтпайды', async () => {
    const smallPanels = Array.from({ length: 38 }, (_, index) => ({ ...panels[0]!, id: `legend-${index + 1}`,
      label: `Деталь ${index + 1}`, cutLength: 100, cutWidth: 100,
      finishedLength: 100, finishedWidth: 100 }))
    const crowded = nestPanels(smallPanels, catalog)
    expect(crowded.sheetCount).toBe(1)
    const bytes = await nestingPdf({ nesting: crowded, projectName: 'Тест', fonts })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(crowded.sheetCount + 1)
  })
  it('картадағы нөмір мен жазу кемінде 7.5 pt', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      await nestingPdf({ nesting, projectName: 'Шкаф 3 секции', fonts })
      const sizes = drawText.mock.calls.map(([, options]) => options?.size ?? 0)
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(7.5)
    } finally { drawText.mockRestore() }
  })
  it('әр резді картаға ретімен сызады', async () => {
    const drawLine = vi.spyOn(PDFPage.prototype, 'drawLine')
    try {
      await nestingPdf({ nesting, projectName: 'Шкаф 3 секции', fonts })
      const cutLines = drawLine.mock.calls.filter(([options]) => options.thickness === 0.6)
      expect(cutLines).toHaveLength(cutPlan(nesting).stats.cutCount)
    } finally {
      drawLine.mockRestore()
    }
  })

  it('бос қорытынды бетсіз әр параққа бір бет', async () => {
    const bytes = await nestingPdf({ nesting, projectName: 'Шкаф 3 секции', fonts })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(nesting.sheetCount)
  })

  it('нағыз PDF файлы шығады', async () => {
    const bytes = await nestingPdf({ nesting, projectName: 'Тест', fonts })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
  })
})

describe('КП PDF', () => {
  it('клиентке тек соңғы баға, реквизиттер және ₸ шығады', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      const shop = { ...pricedShop, bin: '123456789012', address: 'Астана, Абай 1' }
      await quotePdf({ price: priceProject(panels, nesting, shop), shop,
        projectName: 'Шкаф', date: '27.09.2026', fonts })
      const lines = drawText.mock.calls.map(([value]) => value)
      expect(lines).toContain('БИН: 123456789012')
      expect(lines).toContain('Адрес: Астана, Абай 1')
      expect(lines).toContain('К оплате')
      expect(lines.join(' ')).toContain('₸')
      expect(lines.join(' ')).not.toMatch(/Себестоимость|Наценка|СКИДКА|−0 ₸|тг/)
    } finally { drawText.mockRestore() }
  })

  it('цех логотипі болса PDF сурет ретінде қояды', async () => {
    const drawImage = vi.spyOn(PDFPage.prototype, 'drawImage')
    try {
      const logoDataUrl = `data:image/png;base64,${readFileSync('public/brand/favicon-32.png').toString('base64')}`
      const shop = { ...pricedShop, logoDataUrl }
      await quotePdf({ price: priceProject(panels, nesting, shop), shop,
        projectName: 'Шкаф', date: '27.09.2026', fonts })
      expect(drawImage).toHaveBeenCalled()
    } finally { drawImage.mockRestore() }
  })
  it('бағасы толтырылмаса ҚҰЖАТ ШЫҚПАЙДЫ', async () => {
    const price = priceProject(panels, nesting, base)
    await expect(
      quotePdf({ price, shop: base, projectName: 'Тест', date: '30.08.2026', fonts }),
    ).rejects.toThrow(/shop\.prices/)
  })

  it('бағасы бар болса құжат шығады', async () => {
    const price = priceProject(panels, nesting, pricedShop)
    const bytes = await quotePdf({
      price, shop: pricedShop, projectName: 'Шкаф 3 секции', date: '30.08.2026',
      customer: 'Айгүл', fonts,
    })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('күн сырттан беріледі — бірдей жобадан бірдей құжат шығуы керек', async () => {
    const price = priceProject(panels, nesting, pricedShop)
    const make = () =>
      quotePdf({ price, shop: pricedShop, projectName: 'Тест', date: '01.01.2026', fonts })
    const [a, b] = await Promise.all([make(), make()])
    // Метадеректегі уақыт белгісін есептемегенде мазмұны бірдей болуы керек.
    expect(a.length).toBe(b.length)
  })
})

describe('қаріп жиынтығы', () => {
  /**
   * ₸ таңбасы қаріпте жоқ болып шықты: PDF-те ол ҮНСІЗ түсіп қалады да,
   * клиентке валютасы көрсетілмеген КП кетеді. Бұл тест кез келген жаңа
   * таңба үшін дәл сол қатені қайталанбауын күзетеді.
   */
  it('КП-дағы ӘР таңбаны қаріп сала алады', async () => {
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const price = priceProject(panels, nesting, pricedShop)
    const strings = [
      'Коммерческое предложение', 'Позиция', 'Кол-во', 'Цена', 'Сумма',
      'Материалы', 'Кромка', 'Фурнитура', 'Работа', 'Себестоимость', 'Итого',
      'Расход листов по раскрою', `${nesting.sheetCount} л.`,
      'ВСЕГО', 'СКИДКА', 'К ОПЛАТЕ', 'Скидка',
      `Наценка ${price.markupPercent}%`,
      pricedShop.name, pricedShop.city, pricedShop.phone,
      ...price.materials.map((l) => l.name),
      ...price.edges.map((l) => l.name),
      ...price.hardware.map((l) => l.name),
      ...price.services.map((l) => `${l.name} ${l.qty} ${l.unit}`),
      ...[...price.materials, ...price.services].map((l) => formatTenge(l.cost, 'тг')),
      '123,45 тг',
    ]

    for (const [name, bytes] of [['regular', fonts.regular], ['bold', fonts.bold]] as const) {
      const font = fontkit.create(Buffer.from(bytes))
      for (const value of strings) {
        for (const ch of value) {
          if (ch === ' ' || ch === ' ' || ch === ' ') continue
          const glyph = font.glyphsForString(ch)[0]
          expect(glyph?.id, `${name}: «${ch}» (U+${ch.codePointAt(0)!.toString(16)}) в «${value}»`).not.toBe(0)
        }
      }
    }
  })

  it('₸ таңбасы қаріпте бар — PDF пен экранда бір валюта', async () => {
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const font = fontkit.create(Buffer.from(fonts.regular))
    expect(font.glyphsForString('₸')[0]?.id).not.toBe(0)
    expect(formatTenge(100)).toContain('₸')
    expect(formatTenge(100, 'тг')).toContain('тг')
  })
})
