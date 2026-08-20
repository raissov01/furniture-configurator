/**
 * Секция енін бөлу (PHASE-2 A1).
 *
 * Перегородка секциялардан ШЫҒАДЫ: dividerCount = sections.length − 1.
 * Секция ендері W − 2t − dividerCount·t-ға ДӘЛ жиналуы керек.
 */

import { distributeMillimetres } from './distribute.js'
import { ConfigValidationError } from './errors.js'
import type { Section } from './types.js'

/** Бұдан тар секция жарамсыз — ішіне ештеңе сыймайды. */
export const MIN_SECTION_WIDTH = 100

export type SectionLayout = {
  section: Section
  /** Секцияның ТАЗА ішкі ені */
  width: number
  /** Ішкі кеңістіктің сол шеті, кабинет координатасында */
  x: number
}

export type SectionsResult = {
  layouts: SectionLayout[]
  /** Перегородкалардың сол шеті, кабинет координатасында */
  dividerPositions: number[]
}

export function layoutSections(
  sections: Section[],
  innerWidth: number,
  x0: number,
  t: number,
): SectionsResult {
  if (sections.length === 0) {
    throw new ConfigValidationError('sections', 'бос', 'кемінде 1 секция')
  }
  if (sections.length > 12) {
    throw new ConfigValidationError('sections', `${sections.length} секция`, '1..12')
  }

  const dividerCount = sections.length - 1
  /** Перегородкалар алынғаннан кейінгі, секцияларға қалатын таза ен. */
  const sectionSpan = innerWidth - dividerCount * t

  let fixedTotal = 0
  const flexIndexes: number[] = []
  sections.forEach((s, i) => {
    if (s.widthMode === 'fixed') {
      if (s.width === undefined) {
        throw new ConfigValidationError(`sections[${i}].width`, 'fixed секцияда ен көрсетілмеген', 'мм, бүтін сан')
      }
      if (!Number.isInteger(s.width)) {
        throw new ConfigValidationError(`sections[${i}].width`, `${s.width} — бүтін сан емес`, 'мм, бүтін сан')
      }
      fixedTotal += s.width
    } else {
      flexIndexes.push(i)
    }
  })

  if (fixedTotal > sectionSpan) {
    throw new ConfigValidationError(
      'sections',
      `fixed секциялардың қосындысы ${fixedTotal} мм, ал орын ${sectionSpan} мм`,
      `fixed қосындысы ≤ ${sectionSpan} мм`,
    )
  }
  if (flexIndexes.length === 0 && fixedTotal !== sectionSpan) {
    throw new ConfigValidationError(
      'sections',
      `fixed секциялар ${fixedTotal} мм, керегі ${sectionSpan} мм (айырма ${sectionSpan - fixedTotal} мм)`,
      'ең болмағанда бір flex секция, немесе дәл қосынды',
    )
  }

  const widths = sections.map((s) => (s.widthMode === 'fixed' ? (s.width ?? 0) : 0))
  if (flexIndexes.length > 0) {
    // Қалдық миллиметрлер flex секцияларға СОЛДАН ОҢҒА бір-бірлеп таратылады.
    // Фасад ережесінен өзгеше: онда қалдық саңылауға кетеді, себебі фасадтар
    // бірдей болуы шарт. Секцияда саңылау жоқ — қалдықты секцияның өзі жұтады.
    const flexParts = distributeMillimetres(sectionSpan - fixedTotal, flexIndexes.length)
    flexIndexes.forEach((sectionIndex, k) => {
      widths[sectionIndex] = flexParts[k] ?? 0
    })
  }

  const layouts: SectionLayout[] = []
  const dividerPositions: number[] = []
  let x = x0
  sections.forEach((section, i) => {
    const width = widths[i] ?? 0
    if (width < MIN_SECTION_WIDTH) {
      throw new ConfigValidationError(
        `sections[${i}]`,
        `ені ${width} мм`,
        `≥ ${MIN_SECTION_WIDTH} мм`,
      )
    }
    layouts.push({ section, width, x })
    x += width
    if (i < sections.length - 1) {
      dividerPositions.push(x)
      x += t
    }
  })

  return { layouts, dividerPositions }
}

/**
 * Накладной фасадтың «ұясы»: шекара элементінің ортасынан келесі шекараның
 * ортасына дейін. Шеткі ұялар боковинаны ТОЛЫҚ жабады (оны басқа ештеңе
 * жаппайды), ал перегородканы екі көрші фасад тең бөліседі.
 *
 * Бір секциялы кабинетте бұл 0..W береді — M1 мінез-құлқы дәл сақталады.
 */
export function frontSlots(
  dividerPositions: number[],
  cabinetWidth: number,
  t: number,
): { x: number; width: number }[] {
  // Math.floor — қалыңдық тақ болса (сирек) шекара бүтін болып қалады:
  // сол фасад floor(t/2), оң фасад қалғанын алады.
  const edges = [0, ...dividerPositions.map((d) => d + Math.floor(t / 2)), cabinetWidth]
  const slots: { x: number; width: number }[] = []
  for (let i = 0; i < edges.length - 1; i += 1) {
    const start = edges[i] ?? 0
    const end = edges[i + 1] ?? 0
    slots.push({ x: start, width: end - start })
  }
  return slots
}
