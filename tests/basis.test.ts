/**
 * Базиске экспорт.
 *
 * Мұндағы басты тест — ӨЛШЕМ туралы. Базис кромканы ӨЗІ шегереді, сондықтан
 * оған ГОТОВЫЙ өлшем беріледі. Рез өлшемін берсек, шегеру ЕКІ РЕТ жүреді де,
 * цех детальді 2–4 мм кіші кесіп қояды — ол сызбадан да, экраннан да
 * көрінбейді, тек құрастыру кезінде білінеді.
 */
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  basisDrillingCsv,
  basisFiles,
  basisPartsCsv,
  findTemplate,
  formatCutList,
  generateCabinet,
  templateToCabinet,
  toCp1251,
  unsupportedInCp1251,
} from '../src/core/index'

const panels = generateCabinet(
  templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG),
  SEED_CATALOG,
)
const options = { projectName: 'Шкаф-пенал', orderId: 'ЗАКАЗ-17' }
const csv = basisPartsCsv(panels, SEED_CATALOG, options)
const rows = csv.split('\r\n')
const cells = (row: string) => row.split(';')

describe('детальдер тізімі', () => {
  it('тақырып + деталировкадағы әр позицияға бір жол', () => {
    expect(rows).toHaveLength(formatCutList(panels, SEED_CATALOG).length + 1)
    expect(cells(rows[0]!)).toContain('Длина готовая')
    expect(cells(rows[0]!)).toContain('Кромка L1')
  })

  it('⚠ өлшем ГОТОВЫЙ — рез өлшемі ЕМЕС', () => {
    const list = formatCutList(panels, SEED_CATALOG)
    // Фасадта кромка бар, сондықтан готовый мен рез ӘРТҮРЛІ — тест сол жерде
    // ғана мағыналы болады.
    const front = list.find((r) => r.name === 'Фасад')!
    expect(front.cutLength).toBeLessThan(front.finishedLength)

    const row = rows.slice(1).map(cells).find((c) => c[2] === 'Фасад')!
    expect(Number(row[5])).toBe(front.finishedLength)
    expect(Number(row[6])).toBe(front.finishedWidth)
    expect(Number(row[5])).not.toBe(front.cutLength)
  })

  it('кромка миллиметрмен, жоғы 0', () => {
    const front = rows.slice(1).map(cells).find((c) => c[2] === 'Фасад')!
    // Фасадтың төрт жиегі де 2 мм (§4.7).
    expect(front.slice(8, 12)).toEqual(['2.0', '2.0', '2.0', '2.0'])

    const back = rows.slice(1).map(cells).find((c) => c[2] === 'Задняя стенка')!
    expect(back.slice(8, 12)).toEqual(['0', '0', '0', '0'])
  })

  it('тапсырыс нөмірі әр жолда тұрады', () => {
    for (const row of rows.slice(1)) expect(cells(row)[1]).toBe('ЗАКАЗ-17')
  })

  it('жол соңы CRLF — Windows бағдарламасы солай күтеді', () => {
    expect(csv).toContain('\r\n')
    expect(csv.split('\n').every((l) => l === '' || l.endsWith('\r') || !l.includes('\r'))).toBe(true)
  })

  it('текстура бағыты жазылады', () => {
    const side = rows.slice(1).map(cells).find((c) => c[2] === 'Боковина')!
    expect(['вдоль', 'поперёк', 'нет']).toContain(side[12])
  })
})

describe('присадка тізімі', () => {
  const drilling = basisDrillingCsv(panels, options).split('\r\n')

  it('әр тесікке бір жол', () => {
    const holes = panels.reduce((sum, p) => sum + p.drilling.length, 0)
    expect(drilling).toHaveLength(holes + 1)
  })

  it('беттің аты орысша әрі бірмәнді', () => {
    const faces = new Set(drilling.slice(1).map((r) => r.split(';')[2]))
    for (const face of faces) {
      expect(face).toMatch(/^(пласть (внутренняя|наружная)|торец (L1|L2|W1|W2))$/)
    }
  })

  it('координата РЕЗ детальінде — панельдегі санмен бірдей', () => {
    const first = panels.find((p) => p.drilling.length > 0)!
    const hole = first.drilling[0]!
    const row = drilling.slice(1).map((r) => r.split(';'))
      .find((c) => c[1] === first.label && Number(c[3]) === hole.x && Number(c[4]) === hole.y)
    expect(row).toBeDefined()
  })
})

describe('Windows-1251 кодтауы', () => {
  it('ASCII өзгермейді', () => {
    expect([...toCp1251('AZ az 09;')]).toEqual([...Buffer.from('AZ az 09;', 'ascii')])
  })

  it('кириллица дұрыс байтқа түседі', () => {
    // А = 0xC0, Я = 0xDF, а = 0xE0, я = 0xFF (CP1251-дің үзіліссіз блогы).
    expect([...toCp1251('АЯая')]).toEqual([0xc0, 0xdf, 0xe0, 0xff])
    expect([...toCp1251('Ё')]).toEqual([0xa8])
    expect([...toCp1251('ё')]).toEqual([0xb8])
    expect([...toCp1251('№')]).toEqual([0xb9])
  })

  it('кестеде жоқ таңба ҮНСІЗ ЖОҒАЛМАЙДЫ — «?» болады', () => {
    // Қазақ әріптері CP1251-де жоқ.
    expect([...toCp1251('ә')]).toEqual(['?'.charCodeAt(0)])
    expect(unsupportedInCp1251('Сөре ұзын')).toEqual(expect.arrayContaining(['ө', 'ұ']))
    expect(unsupportedInCp1251('Полка длинная')).toEqual([])
  })

  it('ұзындығы мәтіннің таңба санымен бірдей (бір таңба — бір байт)', () => {
    expect(toCp1251('Боковина 2000×450').length).toBe('Боковина 2000×450'.length)
  })
})

describe('бума', () => {
  const files = basisFiles(panels, SEED_CATALOG, options)

  it('детальдер (CSV + XLSX) мен түсіндірме; prisadka.csv ЖОҚ — Базис присадканы CSV-ден оқымайды', () => {
    expect([...files.keys()].sort()).toEqual(['README.txt', 'detali.csv', 'detali.xlsx'])
  })

  it('CSV мен README — CP1251 байттарында', () => {
    for (const name of ['detali.csv', 'README.txt']) {
      const bytes = files.get(name)!
      expect(bytes.length, name).toBeGreaterThan(0)
      // UTF-8 болса кириллица екі байтқа шығар еді; CP1251-де әр таңба бір байт.
      expect(bytes.every((b) => b <= 0xff), name).toBe(true)
    }
  })

  it('түсіндірмеде екі рет шегеру туралы ЕСКЕРТУ мен присадканың жолы бар', () => {
    const readme = Buffer.from(files.get('README.txt')!).toString('latin1')
    // CP1251-ді latin1 деп оқысақ да, ASCII сөздер орнында қалады.
    expect(readme).toContain('detali.csv')
    expect(readme).toContain('bazis-import.js')
    expect(readme).not.toContain('prisadka.csv')
  })

  it('README 0,4 мм рез ережесін және бірінші рез алдындағы тексеруді түсіндіреді', () => {
    const readme = new TextDecoder('windows-1251').decode(files.get('README.txt')!)
    expect(readme).toContain('0,4 мм')
    expect(readme).toContain('600')
    expect(readme).toContain('596')
    expect(readme).toContain('сравните')
    expect(readme).toContain('пробную деталь')
    expect(readme).toContain('не проверен в реальном Базисе')
  })

  it('detali.xlsx: сол жолдар, ГОТОВЫЙ өлшем САН болып', () => {
    const zip = unzipSync(files.get('detali.xlsx')!)
    const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('Длина готовая')
    const front = formatCutList(panels, SEED_CATALOG).find((r) => r.name === 'Фасад')!
    expect(sheet).toContain(`<v>${front.finishedLength}</v>`)
    expect(sheet).not.toContain(`<v>${front.cutLength}</v>`)
    expect((sheet.match(/<row /g) ?? []).length).toBe(rows.length)
  })

  it('сахна берілсе — Базис скрипті де бумада (UTF-8 + BOM)', () => {
    const scene = { nodes: [{ nodeId: 'c', name: 'Шкаф', panels, pose: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 } }] }
    const withScript = basisFiles(panels, SEED_CATALOG, { ...options, script: { scene } })
    const js = withScript.get('bazis-import.js')!
    expect([...js.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(strFromU8(js.slice(3))).toContain('var DATA = ')
  })
})
