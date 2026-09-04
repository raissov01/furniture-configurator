/**
 * ЧПУ присадкасы — әр детальге бір файл.
 *
 * Бұл экспорттың бүкіл мәні — ОПЕРАТОРДЫҢ жұмысы: ол детальді үстелге қояды
 * да, сол детальдің файлын жүктейді. Сондықтан тесттер де соны күзетеді:
 * файлдың аты, реті, өтпелі тесіктің жалаушасы, фреза туралы ескерту.
 */
import { describe, expect, it } from 'vitest'
import {
  BOM, cncFileName, cncFiles, cncIndexCsv, cncPanelCsv, cncSlug, generateCabinet, isThrough,
} from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

const panels = generateCabinet(referenceWardrobe, catalog)
const options = { projectName: 'Шкаф-пенал' }
const side = panels.find((p) => p.id === 'side-left')!
const thickness = catalog.materials.find((m) => m.id === side.materialId)!.thickness

const rowsOf = (csv: string): string[][] =>
  csv.replace(BOM, '').trimEnd().split('\r\n').map((l) => l.split(';'))

describe('ЧПУ: бір детальдің файлы', () => {
  const csv = cncPanelCsv(side, catalog, options)

  it('UTF-8 BOM-мен басталады: онсыз Windows кириллицаны 1251 деп оқиды', () => {
    expect(csv.startsWith(BOM)).toBe(true)
  })

  it('жол соңы CRLF, ажыратқыш — нүктелі үтір', () => {
    expect(csv).toContain('\r\n')
    expect(csv.includes('\n\n')).toBe(false)
    expect(rowsOf(csv)[0]).toContain('Диаметр')
  })

  it('әр тесік — бір жол, детальдің аты мен рез өлшемі әр жолда', () => {
    const rows = rowsOf(csv)
    expect(rows).toHaveLength(side.drilling.length + 1)
    for (const row of rows.slice(1)) {
      expect(row[1]).toBe(side.id)
      expect(row[2]).toBe(side.label)
      expect(Number(row[5])).toBe(side.cutLength)
    }
  })

  it('тесіктер бет бойынша топталған: деталь бір-ақ рет аударылады', () => {
    const faces = rowsOf(csv).slice(1).map((r) => r[7]!)
    const firstSeen = new Map<string, number>()
    faces.forEach((f, i) => { if (!firstSeen.has(f)) firstSeen.set(f, i) })
    // Бір бет екінші рет басталмайды — яғни жолдар араласып кетпеген.
    for (const [face, start] of firstSeen) {
      const last = faces.lastIndexOf(face)
      expect(last - start + 1).toBe(faces.filter((f) => f === face).length)
    }
  })

  it('сол кіріс — сол файл (детерминирленген шығыс)', () => {
    expect(cncPanelCsv(side, catalog, options)).toBe(csv)
  })

  it('материал табылмаса, ҮНСІЗ өтпейді', () => {
    expect(() => cncPanelCsv({ ...side, materialId: 'yoq' }, catalog, options)).toThrow(/Материал/)
  })
})

describe('ЧПУ: өтпелі тесік', () => {
  it('беттегі тесік материал қалыңдығына жетсе — өтпелі', () => {
    expect(isThrough({ face: 'inner', x: 0, y: 0, diameter: 8, depth: thickness, purpose: 'confirmat' }, thickness))
      .toBe(true)
    expect(isThrough({ face: 'inner', x: 0, y: 0, diameter: 5, depth: 13, purpose: 'minifix' }, thickness))
      .toBe(false)
  })

  it('ТОРЦТАҒЫ тесік ешқашан өтпелі емес: ол детальдің бойымен жүреді', () => {
    expect(isThrough({ face: 'edgeW1', x: 0, y: 8, diameter: 5, depth: 35, purpose: 'confirmat' }, thickness))
      .toBe(false)
  })

  it('файлда «Сквозное» бағаны толтырылады', () => {
    const rows = rowsOf(cncPanelCsv(side, catalog, options)).slice(1)
    expect(rows.some((r) => r[12] === 'да')).toBe(true)
    expect(rows.every((r) => r[12] === 'да' || r[12] === 'нет')).toBe(true)
  })
})

describe('ЧПУ: файлдардың аты мен индексі', () => {
  it('атауы латынша әрі реттік нөмірмен басталады', () => {
    expect(cncSlug('Боковина левая')).toBe('bokovina-levaya')
    expect(cncSlug('Қақпақ')).toBe('qaqpaq')
    expect(cncFileName(side, 0)).toMatch(/^01-[a-z0-9-]+\.csv$/)
  })

  it('файл АТЫМЕН емес, ИДЕНТИФИКАТОРМЕН аталады: екі боковина шатаспауы керек', () => {
    const left = panels.find((p) => p.id === 'side-left')!
    const right = panels.find((p) => p.id === 'side-right')!
    expect(left.label).toBe(right.label) // екеуі де «Боковина»
    expect(cncFileName(left, 0)).toBe('01-side-left.csv')
    expect(cncFileName(right, 1)).toBe('02-side-right.csv')
  })

  it('индексте әр деталь бір жол, тесік саны да бар', () => {
    const rows = rowsOf(cncIndexCsv(panels, catalog, options))
    expect(rows).toHaveLength(panels.length + 1)
    const row = rows.find((r) => r[1] === side.id)!
    expect(Number(row[7])).toBe(side.drilling.length)
  })

  it('екі бетінде де тесігі бар деталь «Переворот: да» деп белгіленеді', () => {
    // Панельді ӨЗІМІЗ құрастырамыз: эталон шкафта екі бетінде де тесігі бар
    // деталь болмауы мүмкін, ал тексерілуі керек нәрсе — дәл сол ереже.
    const twoSided = {
      ...side,
      label: 'Двусторонняя',
      drilling: [
        { face: 'inner' as const, x: 50, y: 8, diameter: 5, depth: 13, purpose: 'minifix' as const },
        { face: 'outer' as const, x: 50, y: 8, diameter: 8, depth: 16, purpose: 'confirmat' as const },
      ],
    }
    const oneSided = { ...twoSided, label: 'Односторонняя', drilling: [twoSided.drilling[0]!] }
    const rows = rowsOf(cncIndexCsv([oneSided, twoSided], catalog, options)).slice(1)
    expect(rows.find((r) => r[2] === 'Двусторонняя')![8]).toBe('да')
    expect(rows.find((r) => r[2] === 'Односторонняя')![8]).toBe('нет')

    // Боковина шын мәнінде ЕКІ жағынан бұрғыланады (сыртында конфирмат,
    // ішінде ілгек пен полкодержатель) — оператор оны шынымен аударады.
    const real = rowsOf(cncIndexCsv([side], catalog, options))[1]!
    expect(real[8]).toBe('да')
  })

  it('ТЕСІГІ ЖОҚ деталь де файл алады: нөмірлер жылжымауы керек', () => {
    const files = cncFiles(panels, catalog, options)
    for (const [i, panel] of panels.entries()) {
      expect(files.has(cncFileName(panel, i))).toBe(true)
    }
    // index.csv + README.txt + әр деталь
    expect(files.size).toBe(panels.length + 2)
  })

  it('ойма мен паз файлда ЕМЕС, бірақ индексте ескертіледі', () => {
    const withCutout = {
      ...side,
      cutouts: [{
        id: 'sink', corner: 'bottomLeft' as const, x: 100, y: 100,
        shape: 'rect' as const, width: 50, height: 50,
      }],
    }
    const rows = rowsOf(cncIndexCsv([withCutout], catalog, options)).slice(1)
    expect(rows[0]![9]).toBe('есть — см. DXF')
    expect(cncPanelCsv(withCutout, catalog, options)).not.toContain('DXF')
  })

  it('бумада README бар: координата мен кодтау сонда түсіндіріледі', () => {
    const readme = cncFiles(panels, catalog, options).get('README.txt')!
    expect(readme).toContain('РЕЗАНОЙ')
    expect(readme).toContain('UTF-8')
  })
})
