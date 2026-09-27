/**
 * Биркалар. Цех детальді биркамен ғана таниды, сондықтан ондағы сан
 * деталировкамен де, раскроймен де САЙ КЕЛУІ керек: позиция нөмірі бірдей,
 * парақ нөмірі детальдің шын тұрған парағы, өлшемі — РЕЗ өлшемі.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  findTemplate,
  formatCutList,
  generateCabinet,
  labelsPdf,
  labelFooter,
  labelsToCsv,
  encodePartQr,
  decodePartQr,
  nestPanels,
  partLabels,
  partNumbers,
  templateToCabinet,
} from '../src/core/index'

const font = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))

const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

const panels = generateCabinet(
  templateToCabinet(findTemplate('wardrobe-3sec-1800')!, SEED_CATALOG),
  SEED_CATALOG,
)
const nesting = nestPanels(panels, SEED_CATALOG)
const labels = partLabels(panels, SEED_CATALOG, nesting)

describe('бирка деректері', () => {
  it('басылатын төменгі жол бренд пен жоба атауын сақтайды', () => {
    expect(labelFooter({ cabinetId: 'Шкаф-1', grain: 'along' }, 'Жоба-7'))
      .toBe('AisMebel · Жоба-7 · Шкаф-1 · текстура вдоль')
    expect(labelFooter({ cabinetId: null, grain: null }, 'Жоба-7'))
      .toBe('AisMebel · Жоба-7')
  })
  it('әр ФИЗИКАЛЫҚ детальға бір бирка', () => {
    expect(labels).toHaveLength(panels.length)
    expect(new Set(labels.map((l) => l.panelId)).size).toBe(panels.length)
  })

  it('позиция нөмірі деталировкамен БІР', () => {
    const positions = partNumbers(panels, SEED_CATALOG)
    for (const label of labels) {
      expect(label.position).toBe(positions.get(label.panelId))
    }
    // Позиция саны деталировкадағы жол санымен тең.
    const rows = formatCutList(panels, SEED_CATALOG)
    expect(new Set(labels.map((l) => l.position)).size).toBe(rows.length)
  })

  it('«2 из 4» саны сол позициядағы дана санымен келіседі', () => {
    const rows = formatCutList(panels, SEED_CATALOG)
    for (const label of labels) {
      expect(label.of).toBe(rows[label.position - 1]!.qty)
      expect(label.piece).toBeGreaterThanOrEqual(1)
      expect(label.piece).toBeLessThanOrEqual(label.of)
    }
    // Бір позицияның даналары қайталанбайды.
    const byPosition = new Map<number, number[]>()
    for (const l of labels) byPosition.set(l.position, [...(byPosition.get(l.position) ?? []), l.piece])
    for (const [, pieces] of byPosition) {
      expect(new Set(pieces).size).toBe(pieces.length)
    }
  })

  it('парақ нөмірі детальдің ШЫН тұрған парағы', () => {
    for (const label of labels) {
      const sheet = nesting.byMaterial
        .flatMap((m) => m.sheets)
        .find((s) => s.parts.some((p) => p.panelId === label.panelId))
      expect(label.sheet).toBe(sheet?.index ?? null)
    }
  })

  it('раскрой берілмесе, парақ нөмірі БОС — ойдан жазылмайды', () => {
    for (const label of partLabels(panels, SEED_CATALOG)) {
      expect(label.sheet).toBeNull()
    }
  })

  it('өлшемі РЕЗ бойынша, дайын өлшемі бөлек тұрады', () => {
    for (const label of labels) {
      const panel = panels.find((p) => p.id === label.panelId)!
      expect(label.cutLength).toBe(panel.cutLength)
      expect(label.cutWidth).toBe(panel.cutWidth)
      expect(label.finishedLength).toBe(panel.finishedLength)
      expect(label.finishedWidth).toBe(panel.finishedWidth)
      // Кромка қалыңдығы шегерілген жағында рез кіші (§4.3).
      expect(label.cutLength).toBeLessThanOrEqual(label.finishedLength)
      expect(label.cutWidth).toBeLessThanOrEqual(label.finishedWidth)
    }
  })

  it('кромка қалыңдығы қырларға дұрыс таралады', () => {
    const front = labels.find((l) => l.name.includes('Фасад'))!
    // Фасадтың төрт қыры да 2 мм (§4.7).
    expect(front.edges).toEqual({ L1: 2, L2: 2, W1: 2, W2: 2 })

    const shelf = labels.find((l) => l.name.includes('Полка'))!
    // Сөренің алдыңғы қыры — қол тиетін жері, ол ешқашан бос болмайды.
    expect(shelf.edges.L1).not.toBeNull()
  })

  it('бірнеше корпустан құралған жобада корпус аты биркада тұрады', () => {
    const merged = panels.map((p) => ({ ...p, id: `Шкаф А--${p.id}` }))
    const [first] = partLabels(merged, SEED_CATALOG)
    expect(first!.cabinetId).toBe('Шкаф А')
    // Бір корпус болса, префикс те жоқ.
    expect(labels[0]!.cabinetId).toBeNull()
  })
})

describe('биркалар PDF', () => {
  it('QR жоба, деталь, нұсқаны офлайн қалпына келтіреді', () => {
    const value = encodePartQr({ projectId: 'жоба/25', panelId: labels[0]!.panelId, version: 2 })
    expect(value).toMatch(/^F1\./)
    expect(decodePartQr(value)).toEqual({ projectId: 'жоба/25', panelId: labels[0]!.panelId, version: 2 })
    expect(() => decodePartQr(value.replace(/.$/, '!'))).toThrow()
    expect(() => encodePartQr({ projectId: '', panelId: 'x', version: 1 })).toThrow()
  })

  it('encodePartQr қабылдаған әр мәнді decodePartQr қайта оқиды, әйтпесе басу кезінде қате береді', () => {
    const part = { projectId: 'жоба'.repeat(20), panelId: 'шкаф--бүйір'.repeat(10) + 'аа', version: 3 }
    let value: string | undefined
    try { value = encodePartQr(part) } catch { value = undefined }
    if (value !== undefined) expect(decodePartQr(value)).toEqual(part)
    const ascii = { projectId: 'p'.repeat(80), panelId: 'x'.repeat(120), version: 3 }
    expect(decodePartQr(encodePartQr(ascii))).toEqual(ascii)
  })

  it('QR бар PDF ішіне QR модульдері салынады', async () => {
    const plain = await labelsPdf({ labels: labels.slice(0, 1), projectName: 'Шкаф', fonts })
    const qr = await labelsPdf({ labels: labels.slice(0, 1), projectName: 'Шкаф', projectId: 'project-1', version: 1, fonts })
    expect((await PDFDocument.load(qr)).getPageCount()).toBe(1)
    expect(qr.length).toBeGreaterThan(plain.length)
  })
  it('24 биркаға бір бет', async () => {
    const bytes = await labelsPdf({ labels, projectName: 'Шкаф', fonts })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(Math.max(1, Math.ceil(labels.length / 24)))
    const [page] = doc.getPages()
    expect(Math.round(page!.getWidth())).toBe(595)
    expect(Math.round(page!.getHeight())).toBe(842)
  })

  it('58 × 40 mm print labels keep their physical size and paginate every part', async () => {
    const many = Array.from({ length: 19 }, (_, i) => ({ ...labels[i % labels.length]!, panelId: `part-${i}` }))
    const bytes = await labelsPdf({ labels: many, projectName: 'Шкаф', fonts, size: { page: 'a4', widthMm: 58, heightMm: 40 } })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getWidth()).toBeCloseTo(210 * 72 / 25.4)
    expect(doc.getPage(0).getHeight()).toBeCloseTo(297 * 72 / 25.4)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('58 × 40 mm print labels also accept QR, text and edge marks', async () => {
    const bytes = await labelsPdf({ labels: labels.slice(0, 1), projectName: 'Шкаф', fonts,
      projectId: 'root', version: 4, size: { page: 'a4', widthMm: 58, heightMm: 40 } })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('деталь болмаса да бір бет шығады', async () => {
    const bytes = await labelsPdf({ labels: [], projectName: 'Пусто', fonts })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('биркадағы ӘР таңбаны қаріп сала алады', async () => {
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const strings = [
      'рез, мм', 'готовый', 'лист', 'текстура вдоль', 'текстура поперёк',
      ...labels.map((l) => l.name),
      ...labels.map((l) => l.materialName),
      ...labels.map((l) => `Поз. ${l.position} ${l.piece}/${l.of}`),
    ]
    for (const [name, bytes] of [['regular', fonts.regular], ['bold', fonts.bold]] as const) {
      const f = fontkit.create(Buffer.from(bytes))
      for (const value of strings) {
        for (const ch of value) {
          if (ch === ' ') continue
          expect(
            f.glyphsForString(ch)[0]?.id,
            `${name}: «${ch}» (U+${ch.codePointAt(0)!.toString(16)}) в «${value}»`,
          ).not.toBe(0)
        }
      }
    }
  })
})

describe('биркалар PDF — қаріптің шектеуі', () => {
  /**
   * ₸ сияқты «№» да қаріп жиынтығында ЖОҚ. Ол PDF-те үнсіз ЖОҒАЛАДЫ, ал
   * биркада ол позиция нөмірінің алдында тұрар еді — цех «Поз.» дегеннің
   * орнына бос жер көрер еді. Сондықтан бирка «Поз.» деп жазады.
   */
  it('«№» таңбасы қаріпте ЖОҚ, сондықтан «Поз.» жазылады', async () => {
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const f = fontkit.create(Buffer.from(fonts.regular))
    expect(f.glyphsForString('№')[0]?.id).toBe(0)
    for (const ch of 'Поз.') expect(f.glyphsForString(ch)[0]?.id).not.toBe(0)
  })
})

describe('биркалар CSV', () => {
  const csv = labelsToCsv(labels)

  it('тақырып + әр биркаға бір жол', () => {
    expect(csv.split('\n')).toHaveLength(labels.length + 1)
    expect(csv.split('\n')[0]).toMatch(/^Позиция;Дана;Наименование/)
  })

  it('бөлгіш — нүктелі үтір, ішіндегі тырнақша қорғалады', () => {
    const tricky = [{ ...labels[0]!, name: 'Полка «А»; тест' }]
    const line = labelsToCsv(tricky).split('\n')[1]!
    expect(line).toContain('"Полка «А»; тест"')
  })
})
