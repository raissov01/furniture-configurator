import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { simpleTableXlsx } from '../src/core/export/xlsx'
import {
  applyPriceImport, parsePriceFile, previewPriceImport, priceCodesFromOwnCatalog, priceTargetsFromShop,
} from '../src/core/priceImport'
import { defaultShopProfile } from '../src/core/shop'
import type { OwnMaterialMeta } from '../src/core/data/catalog/schema'

const shop = defaultShopProfile()
const material = { ...shop.materials[0]!, id: 'board', name: 'Egger H1145', thickness: 16, sheetWidth: 2800, sheetHeight: 2070 }
const materialOther = { ...material, id: 'board-18', thickness: 18 }
const edge = { ...shop.edgeBands[0]!, id: 'edge', name: 'H1145 PVC', thickness: 2, widthMm: 22 }
const hardware = { ...shop.hardware[0]!, id: 'hinge', name: 'Blum 71B3550' }
const fixture = { ...shop, materials: [material, materialOther], edgeBands: [edge], hardware: [hardware] }
const targets = priceTargetsFromShop(fixture, {
  board: { code: 'H1145', brand: 'Egger' },
  'board-18': { code: 'H1145', brand: 'Egger' },
  edge: { code: 'H1145', brand: 'Egger' },
  hinge: { code: '71B3550', brand: 'Blum' },
})
const map = { kind: 'Санат', code: 'Артикул', brand: 'Бренд', thickness: 'Қалыңдық', price: 'Баға', unit: 'Бірлік' }

describe('цех прайсын импорттау', () => {
  it('CSV: BOM, ;, тырнақша және жол ішіндегі жаңа жол оқылады', () => {
    const table = parsePriceFile('\uFEFFСанат;Артикул;Баға\r\nматериал;"H1145";"1 234,50"\r\nматериал;"жол\nекі";120\r\n', 'csv')
    expect(table.headers).toEqual(['Санат', 'Артикул', 'Баға'])
    expect(table.rows).toEqual([['материал', 'H1145', '1 234,50'], ['материал', 'жол\nекі', '120']])
    expect(() => parsePriceFile('a;b\n"ашық;20', 'csv')).toThrow(/тырнақша/)
    expect(parsePriceFile(new Uint8Array([0xca, 0xee, 0xe4, 0x3b, 0xc1, 0xe0, 0xe3, 0xe0, 0x0a, 0x48, 0x31, 0x3b, 0x31]), 'csv', { csvEncoding: 'windows-1251' }))
      .toEqual({ headers: ['Код', 'Бага'], rows: [['H1', '1']] })
  })

  it('XLSX: бірінші парақтағы мәтін және сан ұяшықтарын оқиды', () => {
    const bytes = simpleTableXlsx('Прайс', ['Код', 'Баға'], [['H1145', 25000], ['71B3550', 1450]])
    expect(parsePriceFile(bytes, 'xlsx')).toEqual({ headers: ['Код', 'Баға'], rows: [['H1145', '25000'], ['71B3550', '1450']] })
    expect(() => parsePriceFile(new Uint8Array([1, 2, 3]), 'xlsx')).toThrow(/XLSX/)
    const zipped = zipSync({
      'xl/workbook.xml': new TextEncoder().encode('<workbook><sheets><sheet name="Price" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': new TextEncoder().encode('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': new TextEncoder().encode('<sst><si><t>Код</t></si><si><t>Баға</t></si><si><t>H&amp;1145</t></si></sst>'),
      'xl/worksheets/sheet1.xml': new TextEncoder().encode('<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row><c r="A2" t="s"><v>2</v></c><c r="B2"><v>100.50</v></c></row></sheetData></worksheet>'),
    })
    expect(parsePriceFile(zipped, 'xlsx')).toEqual({ headers: ['Код', 'Баға'], rows: [['H&1145', '100.50']] })
  })

  it('нақты → нормаланған → ұқсас; қалыңдық айырмасын қауіпсіз ұстайды', () => {
    const table = parsePriceFile(`Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145;Egger;16;25000;парақ\nматериал;H-1145;Egger;18;26000;парақ\nматериал;H114S;Egger;16;25500;парақ\nматериал;H1145;Egger;;25000;парақ\n`, 'csv')
    const matches = table.rows.map((row) => previewPriceImport({ headers: table.headers, rows: [row] }, map, targets).rows[0]!)
    expect(matches.map((r) => [r.status, r.match?.method, r.match?.targetId]))
      .toEqual([['matched', 'exact', 'board'], ['matched', 'normalized', 'board-18'], ['matched', 'similar', 'board'], ['conflict', undefined, undefined]])
    expect(matches[2]!.match!.confidence).toBeLessThan(matches[1]!.match!.confidence)
    expect(matches[3]!.reason).toMatch(/қалыңдық|бірнеше/)
  })

  it('бірліктерді бүтін тиынға түрлендіреді, тек расталған жолдарды жазады', () => {
    const table = parsePriceFile(`Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145;Egger;16;5000;м²\nкромка;H1145;Egger;2;45,25;п.м.\nфурнитура;71B3550;Blum;;1 200,50;дана\n`, 'csv')
    const p = previewPriceImport(table, map, targets)
    expect(p.rows.map((r) => r.priceTiyn)).toEqual([2_898_000, 4525, 120_050])
    const updated = applyPriceImport(fixture, p, fixture.activePriceListId)
    expect(updated.materials[0]!.pricePerSheet).toBe(2_898_000)
    expect(updated.edgeBands[0]!.pricePerMeter).toBe(4525)
    expect(updated.hardware[0]!.pricePerUnit).toBe(120_050)
    expect(updated.priceLists[0]!.materialPrices.board?.pricePerSheet).toBe(2_898_000)
  })

  it('қайшылықты/қате баған, баға, бірлік және екі бірдей нысана жазылмайды', () => {
    const table = parsePriceFile(`Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145;Egger;16;25000;парақ\nматериал;H1145;Egger;16;26000;парақ\nматериал;UNKNOWN;Egger;16;100;парақ\nкромка;H1145;Egger;2;10;парақ\n`, 'csv')
    const p = previewPriceImport(table, map, targets)
    expect(p.rows.map((r) => r.status)).toEqual(['conflict', 'conflict', 'unmatched', 'conflict'])
    expect(() => applyPriceImport(fixture, p, fixture.activePriceListId)).toThrow(/қайшылық/)
    expect(() => previewPriceImport(table, { ...map, price: 'жоқ' }, targets)).toThrow(/price/)
    expect(() => previewPriceImport(table, { ...map, price: 'Артикул' }, targets)).toThrow(/қайталан/)
    expect(() => previewPriceImport(table, { ...map, unit: '' }, targets)).toThrow(/unit/)
  })

  it('ұқсас код қолмен бекітілмесе қолданылмайды; тиын дәл сақталады', () => {
    const table = parsePriceFile(`Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H114S;Egger;16;120050 тиын;парақ\n`, 'csv')
    const p = previewPriceImport(table, map, targets)
    expect(p.rows[0]!.match?.method).toBe('similar')
    expect(p.rows[0]!.priceTiyn).toBe(120_050)
    expect(applyPriceImport(fixture, p, fixture.activePriceListId).materials[0]!.pricePerSheet).toBe(material.pricePerSheet)
    expect(applyPriceImport(fixture, p, fixture.activePriceListId, [2]).materials[0]!.pricePerSheet).toBe(120_050)
  })

  it('өз каталогының құрылым коды сақталады; жалаң декор коды екі нысанаға түссе қайшылық', () => {
    const metadata = {
      board: { decorCode: 'H1145', structureCode: 'ST10', manufacturer: 'Egger' } as OwnMaterialMeta,
      'board-18': { decorCode: 'H1145', structureCode: 'ST12', manufacturer: 'Egger' } as OwnMaterialMeta,
    }
    const coded = priceTargetsFromShop(fixture, priceCodesFromOwnCatalog(metadata, {}))
    const full = parsePriceFile('Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145 ST10;Egger;16;100;парақ', 'csv')
    expect(previewPriceImport(full, map, coded).rows[0]!.match).toMatchObject({ targetId: 'board', method: 'exact' })
    const bare = parsePriceFile('Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145;Egger;;100;парақ', 'csv')
    expect(previewPriceImport(bare, map, coded).rows[0]!.status).toBe('conflict')
  })

  it('м² бағасы соңында ғана тиынға дөңгелектенеді; файл лимиті түсінікті қате', () => {
    const table = parsePriceFile('Санат;Артикул;Бренд;Қалыңдық;Баға;Бірлік\nматериал;H1145;Egger;16;0,01;₸/м²', 'csv')
    expect(previewPriceImport(table, map, targets).rows[0]!.priceTiyn).toBe(6)
    expect(() => parsePriceFile('x'.repeat(5_000_001), 'csv')).toThrow(/5 МБ/)
  })
})
