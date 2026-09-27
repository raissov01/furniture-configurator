import { describe, expect, it } from 'vitest'
import { simpleTableXlsx } from '../src/core/export/xlsx'
import { parseBasisExcel, previewBasisTable } from '../src/core/ownCatalogImport'
import { parsePro100Textures } from '../src/core/pro100Textures'

describe('цех каталогының таза импорты', () => {
  it('Базис Excel бағандарын сәйкестендіріп, жарамды жолдар мен қателерді бөледі', () => {
    const xlsx = simpleTableXlsx('Sheet1',
      ['Артикул материала', 'Наименование материала', 'Наименование группы', 'Толщина', 'Длина', 'Ширина', 'Шаг по Х', 'Шаг по Y', 'Стоимость'], [
      ['A1', 'ЛДСП Egger H1145, Дуб', '01/ЛДСП/Egger', 16, 2800, 2070, 0, 0, 123],
      ['A2', 'ХДФ Белый', '01/ХДФ/Стандарт', 3, 0, 0, 2800, 2070, 25],
      ['A3', 'ЛДСП, Дефект', '01/ЛДСП/Egger', 16, 0, 0, 1000, 1000, 1],
    ])
    const result = parseBasisExcel(xlsx)
    expect(result.materials).toHaveLength(2)
    expect(result.materials[0]).toMatchObject({ thickness: 16, sheetWidth: 2800, sheetHeight: 2070, hasGrain: true, pricePerSheet: 0 })
    expect(result.errors).toEqual([{ rowNumber: 4, reason: expect.stringMatching(/өлшем/) }])
    expect(result.materials[1]?.hasGrain).toBe(false)
  })

  it('баған сәйкестігін ауыстыруға болады және қайталанған артикул тіркелмейді', () => {
    const table = { headers: ['Code', 'Name', 'Group', 'T', 'L', 'W', 'X', 'Y'], rows: [
      ['a', 'ЛДСП, Дуб', '01/ЛДСП/Egger', '16', '2800', '2070', '0', '0'],
      ['a', 'ЛДСП, Дуб', '01/ЛДСП/Egger', '16', '2800', '2070', '0', '0'],
    ] }
    const result = previewBasisTable(table, { articul: 'Code', name: 'Name', group: 'Group', thickness: 'T', length: 'L', width: 'W', stepX: 'X', stepY: 'Y' })
    expect(result.materials).toHaveLength(1)
    expect(result.errors[0]?.reason).toMatch(/қайталан/)
    expect(() => previewBasisTable(table, { articul: 'Code', name: 'Name', group: 'Missing', thickness: 'T', length: 'L', width: 'W', stepX: 'X', stepY: 'Y' })).toThrow(/Missing/)
    expect(() => previewBasisTable(table, { articul: 'Code' } as never)).toThrow(/columns.name/)
  })

  it('PRO100 секцияларын физикалық масштабымен және жарық өрістерімен оқиды', () => {
    const result = parsePro100Textures('[Oak]\r\nxmm=1200\r\nymm=600\r\ndiffuse=0.7\r\nspecular=0.2\r\nfile=wood.jpg\r\n[Bad]\r\nxmm=0\r\nymm=30\r\n')
    expect(result.textures).toEqual([{ name: 'Oak', mapSizeMm: { x: 1200, y: 600 }, diffuse: 0.7, specular: 0.2, imageFile: 'wood.jpg' }])
    expect(result.errors).toEqual([{ lineNumber: 7, reason: expect.stringMatching(/xmm/) }])
  })

  it('PRO100 нақты секция атауын сурет деп таниды және default оптикасын қолданады', () => {
    const result = parsePro100Textures('[default]\nxmm=600\nymm=300\ndiffusered=0.6\ndiffusegreen=0.7\ndiffuseblue=0.8\nspecularred=0.2\nspeculargreen=0.3\nspecularblue=0.4\nspecExponent=0.59\n[Дуб.jpg]\n')
    expect(result.errors).toEqual([])
    expect(result.textures).toEqual([{ name: 'Дуб.jpg', imageFile: 'Дуб.jpg', mapSizeMm: { x: 600, y: 300 },
      diffuseRgb: { r: 0.6, g: 0.7, b: 0.8 }, specularRgb: { r: 0.2, g: 0.3, b: 0.4 }, specExponent: 0.59 }])
  })

  it('PRO100 қайталанған секция атауын екінші жолымен қате етеді', () => {
    const result = parsePro100Textures('[X]\nxmm=10\nymm=10\n[x]\nxmm=20\nymm=20')
    expect(result.textures).toEqual([{ name: 'X', mapSizeMm: { x: 10, y: 10 } }])
    expect(result.errors).toEqual([{ lineNumber: 4, reason: expect.stringMatching(/қайталан/) }])
  })
})
