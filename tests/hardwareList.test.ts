/**
 * Список фурнитуры — цехтың сатып алу қағазы.
 *
 * КП-дан екі айырмашылығы бар, екеуі де әдейі:
 *   1. бағасыз да шығады (бұл клиентке кететін ұсыныс емес);
 *   2. техника бөлек бөлімде, санымен, бірақ бағасыз — оны клиент өзі алады.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  countHardware,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  generateHardware,
  hardwareList,
  hardwareListPdf,
  hardwareListToCsv,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, ShopProfile } from '../src/core/index'

const font = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))
const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

const base = defaultShopProfile()
const catalog = catalogOf(base)
const template = findTemplate('wardrobe-penal-600')!

/** Духовка мен брючницасы бар шкаф: техника да, механизм де тізімге түседі. */
const cabinet: CabinetConfig = (() => {
  const c = templateToCabinet(template, catalog)
  return {
    ...c,
    width: 600,
    sections: [{
      ...c.sections[0]!,
      contents: [
        { kind: 'appliance', appliance: 'oven' },
        { kind: 'filling', filling: 'trousers' },
      ],
    }],
  }
})()

const panels = generateCabinet(cabinet, catalog)
const placements = generateHardware(cabinet, catalog)

const priced: ShopProfile = {
  ...base,
  name: 'Цех «Алаш»',
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
}

describe('тізімнің мазмұны', () => {
  const list = hardwareList(panels, placements, priced)

  it('саны присадкадан шығады, қолмен саналмайды', () => {
    const counts = countHardware(panels)
    for (const [id, qty] of counts) {
      if (qty <= 0) continue
      const row = list.rows.find((r) => r.id === id)
      expect(row, id).toBeDefined()
      expect(row!.qty).toBe(Math.round(qty * 100) / 100)
    }
  })

  it('механизм сатып алу тізімінде тұр', () => {
    expect(list.rows.some((r) => r.id === 'filling-trousers')).toBe(true)
  })

  it('ТЕХНИКА сатып алу жолдарында ЖОҚ, бөлек бөлімде', () => {
    expect(list.rows.some((r) => r.id.startsWith('appliance-'))).toBe(false)
    expect(list.appliances.map((a) => a.name)).toContain('Духовка')
  })

  it('топтастыру реті тұрақты: алдымен петля, соңында прочее', () => {
    const kinds = [...new Set(list.rows.map((r) => r.kind))]
    expect(kinds[0]).toBe('hinge')
    expect(kinds.at(-1)).toBe('other')
  })

  it('сомасы жолдардың қосындысына тең', () => {
    expect(list.total).toBe(list.rows.reduce((s, r) => s + r.cost, 0))
  })
})

describe('бағасыз цех', () => {
  const list = hardwareList(panels, placements, base)

  it('тізім БӘРІБІР шығады', () => {
    expect(list.rows.length).toBeGreaterThan(0)
  })

  it('бағасы жоқ позициялар аталып тұрады', () => {
    expect(list.withoutPrice.length).toBeGreaterThan(0)
    // Қайталанбайды: бір атау бір рет.
    expect(new Set(list.withoutPrice).size).toBe(list.withoutPrice.length)
  })

  it('сомасы 0, бірақ саны сол күйі', () => {
    expect(list.total).toBe(0)
    expect(list.rows.every((r) => r.qty > 0)).toBe(true)
  })
})

describe('CSV', () => {
  const csv = hardwareListToCsv(hardwareList(panels, placements, priced))

  it('тақырып жолы бар, бөлгіш — нүктелі үтір', () => {
    expect(csv.split('\n')[0]).toBe('Группа;Наименование;Кол-во;Ед;Цена, ₸;Сумма, ₸')
  })

  it('техника жолы бар, бірақ баға бағандары БОС', () => {
    const line = csv.split('\n').find((l) => l.includes('Духовка'))
    expect(line).toBeDefined()
    expect(line!.endsWith(';;')).toBe(true)
  })

  it('нүктелі үтірі бар атау тырнақшаға алынады', () => {
    const list = hardwareList(panels, placements, {
      ...priced,
      hardware: priced.hardware.map((h) => ({ ...h, name: `${h.name}; 2 шт` })),
    })
    const out = hardwareListToCsv(list)
    expect(out).toMatch(/"[^"]*; 2 шт"/)
  })
})

describe('PDF', () => {
  it('құжат шығады әрі бетінде мазмұны бар', async () => {
    const bytes = await hardwareListPdf({
      list: hardwareList(panels, placements, priced),
      shop: priced,
      projectName: 'Шкаф-пенал',
      date: '31.08.2026',
      fonts,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(0)
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  it('бағасы толтырылмаған цехта да ҚАТЕ ЛАҚТЫРМАЙДЫ', async () => {
    // КП-дан айырмашылығы дәл осында: бұл цехтың өз ішіндегі қағаз.
    const bytes = await hardwareListPdf({
      list: hardwareList(panels, placements, base),
      shop: base,
      projectName: 'Шкаф-пенал',
      date: '31.08.2026',
      fonts,
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  it('күн СЫРТТАН беріледі — бірдей кіріс бірдей файл береді', async () => {
    const make = () => hardwareListPdf({
      list: hardwareList(panels, placements, priced),
      shop: priced, projectName: 'Шкаф-пенал', date: '31.08.2026', fonts,
    })
    const [a, b] = await Promise.all([make(), make()])
    expect(a.byteLength).toBe(b.byteLength)
  })

  it('қаріпте құжаттағы әр таңба бар — үнсіз түсіп қалмайды', async () => {
    const list = hardwareList(panels, placements, priced)
    const text = [
      'Список фурнитуры', 'Итого фурнитуры', 'ТЕХНИКА ЗАКАЗЧИКА', 'Без цены',
      ...list.rows.map((r) => r.name),
      ...list.appliances.map((a) => a.name),
    ].join('')
    const doc = await PDFDocument.create()
    const { default: fontkit } = await import('@pdf-lib/fontkit')
    doc.registerFontkit(fontkit)
    const f = await doc.embedFont(fonts.regular, { subset: true })
    // ₸ ӘДЕЙІ тексерілмейді: қаріпте ол ЖОҚ, сондықтан PDF-те «тг» жазылады.
    for (const ch of new Set(text)) {
      expect(() => f.widthOfTextAtSize(ch, 9), `таңба «${ch}»`).not.toThrow()
    }
  })
})
