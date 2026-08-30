/** PHASE-2 A5 — экспорт форматтары. */
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  cutListToCsv, cutListToXlsx, drillingToCsv, drillLayerName,
  fitTransform, generateCabinet, panelToDxf, projectElevation, projectIsometric,
  transliterate,
} from '../src/core/index'
import { catalog, referenceWardrobe, threeSectionWardrobe, withCabinet } from './fixtures'

const panels = generateCabinet(referenceWardrobe, catalog)
const thicknessOf = (p: (typeof panels)[number]) =>
  catalog.materials.find((m) => m.id === p.materialId)!.thickness

describe('DXF', () => {
  const side = panels.find((p) => p.id === 'side-left')!
  const dxf = panelToDxf(side)

  it('миллиметрде: $INSUNITS = 4', () => {
    // Мұны қоймасаң, CAM пакеті дюйм деп оқып, детальді 25.4 есе үлкейтеді.
    expect(dxf).toMatch(/\$INSUNITS\n\s*70\n4/)
    expect(dxf.startsWith('0\nSECTION')).toBe(true)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
  })

  it('контур — жабық LWPOLYLINE, координата басы сол-төменгі бұрышта', () => {
    const outline = dxf.split('LWPOLYLINE')[1]!.split('CIRCLE')[0]!
    expect(outline).toContain('OUTLINE')
    expect(outline).toMatch(/\n70\n1/) // closed
    expect(outline).toContain(`\n10\n${side.cutLength}.0`)
    expect(outline).toContain(`\n20\n${side.cutWidth}.0`)
  })

  it('әр диаметрге жеке қабат — станок қабатты аспапқа байлайды', () => {
    expect(drillLayerName(5)).toBe('DRILL_5')
    expect(drillLayerName(12.5)).toBe('DRILL_12_5')
    expect(dxf).toContain('DRILL_5')
    // Ø7 тесіктер торцте — контур бетінде салынбайды
    expect(dxf).not.toContain('DRILL_7')
  })

  it('шеңберлер саны сол беттегі тесіктерге тең', () => {
    const inner = side.drilling.filter((d) => d.face === 'inner')
    const circles = dxf.split('\nCIRCLE\n').length - 1
    expect(circles).toBe(inner.length)
  })

  it('паз режимінде GROOVE қабаты пайда болады', () => {
    const grooved = generateCabinet(withCabinet({ back: { mode: 'groove' } }), catalog)
    const dxfG = panelToDxf(grooved.find((p) => p.id === 'side-left')!)
    expect(dxfG).toContain('GROOVE')
    expect(dxfG).toContain('PAZ 3x4') // ені × тереңдігі
  })

  it('мәтін латынға аударылады — ескі оқығыш кириллицаны бұзады', () => {
    expect(transliterate('Боковина')).toBe('Bokovina')
    expect(transliterate('Қақпақ')).toBe('Qaqpaq')
    expect(dxf).toContain('Bokovina')
  })
})

describe('CSV', () => {
  it('тек РЕЗ өлшемі — оптимизаторға готовый керек емес', () => {
    const csv = cutListToCsv(panels, catalog)
    const [header, first] = csv.trim().split('\n')
    expect(header).toBe('name,length,width,qty,material,edgeL1,edgeL2,edgeW1,edgeW2,grain')
    expect(first).toMatch(/^Боковина,2000,445,2,/)
    expect(csv).not.toContain('447') // готовый ені шықпауы керек
  })

  it('үтірі бар материал аты тырнақшаға алынады', () => {
    const csv = cutListToCsv(panels, {
      ...catalog,
      materials: catalog.materials.map((m) => ({ ...m, name: `${m.name}, партия 2` })),
    })
    expect(csv).toContain('"ЛДСП Egger H1145 Дуб Бардолино 16, партия 2"')
  })

  it('присадка CSV-інде әр тесік жеке жол', () => {
    const csv = drillingToCsv(panels)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('panel,label,face,x,y,diameter,depth,purpose')
    expect(lines).toHaveLength(1 + panels.reduce((s, p) => s + p.drilling.length, 0))
  })
})

describe('XLSX', () => {
  const bytes = cutListToXlsx(panels, catalog, 'Тест')
  const files = unzipSync(bytes)

  it('жарамды zip, ішінде керекті OOXML бөліктері бар', () => {
    for (const name of [
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
    ]) {
      expect(Object.keys(files), name).toContain(name)
    }
  })

  it('материалға бір парақ + присадка парағы', () => {
    const workbook = strFromU8(files['xl/workbook.xml']!)
    const names = [...workbook.matchAll(/name="([^"]+)"/g)].map((m) => m[1]!)
    expect(names).toHaveLength(3)
    // Excel парақ атын 31 таңбамен шектейді, ұзын материал аты қысқарады
    expect(names[0]).toBe('ЛДСП Egger H1145 Дуб Бардолино 16'.slice(0, 31))
    expect(names.every((n) => n.length <= 31)).toBe(true)
    expect(names).toContain('ХДФ 3 мм белый')
    expect(names).toContain('Присадка')
  })

  it('қорытынды жол бар, саны деталь санына тең', () => {
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('ИТОГО')
    expect(sheet).toContain('м² по резу')
    expect(sheet).toContain('>10<') // ЛДСП: 2+1+1+4+2 = 10 деталь
  })

  it('бірдей конфиг бірдей байт береді', () => {
    const again = cutListToXlsx(generateCabinet(referenceWardrobe, catalog), catalog, 'Тест')
    expect(Buffer.from(again).equals(Buffer.from(bytes))).toBe(true)
  })
})

describe('проекциялар', () => {
  it('фас: ені мен биіктігі кабинет габаритіне тең', () => {
    const { bounds } = projectElevation(panels.filter((p) => p.role !== 'front'), thicknessOf, 'front')
    expect(bounds.maxX - bounds.minX).toBe(600)
    expect(bounds.maxY - bounds.minY).toBe(2000)
  })

  it('жоспар: тереңдігі D', () => {
    const { bounds } = projectElevation(panels.filter((p) => p.role !== 'front'), thicknessOf, 'plan')
    expect(bounds.maxY - bounds.minY).toBe(450)
  })

  it('изометрияда әр панельдің 3 көрінетін беті бар', () => {
    const { polygons } = projectIsometric(
      panels, thicknessOf,
      { width: 600, height: 2000, depth: 450 },
    )
    expect(polygons).toHaveLength(panels.length * 3)
    expect(polygons.every((p) => p.points.length === 4)).toBe(true)
  })

  it('ажырату панельдерді бір-бірінен алшақтатады', () => {
    const geo = { width: 600, height: 2000, depth: 450 }
    const a = projectIsometric(panels, thicknessOf, geo, 0).bounds
    const b = projectIsometric(panels, thicknessOf, geo, 200).bounds
    expect(b.maxX - b.minX).toBeGreaterThan(a.maxX - a.minX)
  })

  it('fitTransform проекцияны қорапқа сыйдырады', () => {
    const { bounds } = projectElevation(panels, thicknessOf, 'front')
    const box = { x: 10, y: 20, w: 300, h: 400 }
    const { scale, tx, ty } = fitTransform(bounds, box, 10)
    expect(bounds.minX * scale + tx).toBeGreaterThanOrEqual(box.x + 10 - 0.001)
    expect(bounds.maxY * scale + ty).toBeLessThanOrEqual(box.y + box.h - 10 + 0.001)
  })

  it('көп секциялы кабинетте де бәрі жұмыс істейді', () => {
    const p = generateCabinet(threeSectionWardrobe, catalog)
    expect(panelToDxf(p.find((x) => x.role === 'divider')!)).toContain('OUTLINE')
    expect(cutListToCsv(p, catalog).trim().split('\n').length).toBeGreaterThan(6)
  })
})
