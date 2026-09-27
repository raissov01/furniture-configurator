/** Өндіруші сызбасымен бекітілген үстелтақта ойықтары. Барлық өлшем мм. */
import { ConfigValidationError } from './errors'
import type { Cutout } from './cutouts'

export type WorktopFixtureModel = {
  id: string
  kind: 'hob' | 'sink'
  article: string
  width: number
  depth: number
  radius?: number
  /** Өндіруші көрсеткен корпус өлшемі; жалпы ыдыс ені формуласы емес. */
  minCabinetWidth: number
  /** Ресми монтаж шегі; мойкада жоқ, оны нақты орнату сызбасы анықтайды. */
  minFront?: number
  minBack?: number
  source: string
}

export const WORKTOP_FIXTURE_MODELS: readonly WorktopFixtureModel[] = [
  {
    id: 'hob-60-default', kind: 'hob', article: '60 см үлгі',
    // Bosch PIE631BB5E, б.1,3: ойық 560 × 490–500; AEG HD634170NB,
    // б.23: R5 және алдыңғы ≥55; Bosch б.3: артқы ≥50.
    width: 560, depth: 490, radius: 5, minCabinetWidth: 600,
    minFront: 55, minBack: 50,
    source: 'Bosch PIE631BB5E б.1,3 https://media3.bosch-home.com/Documents/specsheet/en-IE/PIE631BB5E.pdf; AEG HD634170NB б.23 https://www.electrolux-ui.com/DocumentDownLoad.aspx?DocURL=2017\\867\\334519umEN.pdf',
  },
  {
    id: 'bosch-pie631bb5e', kind: 'hob', article: 'PIE631BB5E',
    width: 560, depth: 490, minCabinetWidth: 600, minFront: 55, minBack: 50,
    source: 'Bosch PIE631BB5E б.1,3 https://media3.bosch-home.com/Documents/specsheet/en-IE/PIE631BB5E.pdf; алдыңғы ≥55 AEG HD634170NB б.23',
  },
  {
    id: 'blanco-522201', kind: 'sink', article: 'BLANCO LEGRA 45 S / 522201',
    // BLANCO кесу файлы 1000339112, 11/2015: 760 × 480 R15;
    // өнім беті: ең аз корпус 450, ыдыс ені 335.
    width: 760, depth: 480, radius: 15, minCabinetWidth: 450,
    source: 'BLANCO 1000339112, б.1 https://cdn.blanco.com/assets/hlr-system/Spuelcenter_Becken/BLANCOLEGRA_45_S_SILGRANIT_Sondermodell/Ausschnittdaten/Einbau_von_oben/1000339112_000.zip; https://www.blanco.com/int/sinks/legra/legra_59.801/522201',
  },
  {
    id: 'franke-1140067723', kind: 'sink', article: 'Franke MARIS MRG 611 / 114.0067.723',
    // Franke өнім есебі, б.1–2: ойық 950 × 480, min cabinet 60 см.
    // Бұрыш радиусы берілмеген, сондықтан оны ойдан қоспаймыз.
    width: 950, depth: 480, minCabinetWidth: 600,
    source: 'Franke MARIS MRG 611, б.1–2 https://www.franke.com/product-sheet/fks-gb-b2b/products/114.0067.723/specreport?lang=en_GB&applicationName=website',
  },
]

export function worktopFixtureModel(id: string): WorktopFixtureModel {
  const found = WORKTOP_FIXTURE_MODELS.find((model) => model.id === id)
  if (!found) throw new ConfigValidationError('fixtures.modelId', id,
    WORKTOP_FIXTURE_MODELS.map((model) => model.id).join(' | '))
  return found
}

export type WorktopCutoutPlacement = {
  panelLength: number
  panelWidth: number
  /** Панельдің сол жақ шетінен ойықтың ортасына дейін. */
  centreX: number
  cabinetWidth: number
  /** Үстелтақтаның алдыңғы жиегінен ойыққа дейін; мойка үшін міндетті. */
  frontInset?: number
}

/** Панельдің жергілікті x/y осіндегі ойық: DXF және деталировка осыдан оқиды. */
export function planWorktopCutout(model: WorktopFixtureModel, place: WorktopCutoutPlacement): Cutout {
  if (place.cabinetWidth < model.minCabinetWidth) {
    throw new ConfigValidationError('fixtures.moduleWidth', `${place.cabinetWidth} мм`,
      `≥ ${model.minCabinetWidth} мм (${model.article})`)
  }
  const front = place.frontInset ?? model.minFront
  if (front === undefined) {
    throw new ConfigValidationError('fixtures.frontInset', 'берілмеген',
      `${model.article}: алдыңғы жиектен ойыққа дейінгі орынды енгізіңіз`)
  }
  if (!Number.isInteger(front) || front < (model.minFront ?? 0)) {
    throw new ConfigValidationError('fixtures.frontInset', `${front} мм`,
      `≥ ${model.minFront ?? 0} мм, бүтін сан`)
  }
  const minDepth = front + model.depth + (model.minBack ?? 0)
  if (place.panelWidth < minDepth) {
    throw new ConfigValidationError('worktop.panelWidth', `${place.panelWidth} мм`,
      `≥ ${minDepth} мм (${model.article}: ойық және артқы шегініс)`)
  }
  const x = place.centreX - model.width / 2
  if (!Number.isInteger(x) || x < 0 || x + model.width > place.panelLength) {
    throw new ConfigValidationError('fixtures.centreX', `${place.centreX} мм`,
      `${model.width / 2}..${place.panelLength - model.width / 2} мм`)
  }
  return {
    id: `fixture-${model.id}`, label: `${model.article} (${model.source})`,
    shape: 'rect', corner: 'bottomLeft', x, y: front,
    width: model.width, height: model.depth,
    ...(model.radius === undefined ? {} : { radius: model.radius }),
  }
}
