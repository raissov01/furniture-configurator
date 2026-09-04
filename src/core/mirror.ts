/**
 * Модульдің АЙНА КӨШІРМЕСІ.
 *
 * НЕГЕ КЕРЕК. Ас үй де, шкаф та жиі жұппен жасалады: сол жақтағы модульдің
 * дәл сондайы оң жаққа қойылады, тек есігі екінші жаққа ашылады. Қолмен
 * қайта тергенде адам бір нәрсені ұмытады — көбіне ілгектің жағын, ал ол
 * цехта ғана байқалады.
 *
 * НЕ АЙНАЛАДЫ. Модель СОЛ-ОҢ өсі бойынша шағылысады, сондықтан:
 *   секциялардың реті · крышка/дноның асимметриялы бекітілуі · фасадтың
 *   ашылу жағы мен зазорлары · тұтқаның орны · планкалардың жағы ·
 *   фронтальдық панельдің жағы · сөренің бүйір шегіністері · ящиктің
 *   жанама планкалары · стойканың орны.
 *
 * НЕ АЙНАЛМАЙДЫ (әрі әдейі көшірілмейді) — `mirrorNotes` қара.
 */

import type { CabinetConfig, PanelMount, Section, SectionContent, SectionFronts } from './types'
import type { HandlePosition } from './fittings'

const MIRRORED_MOUNT: Record<PanelMount, PanelMount> = {
  inset: 'inset',
  overlay: 'overlay',
  overlayLeft: 'overlayRight',
  overlayRight: 'overlayLeft',
}

const MIRRORED_HANDLE: Record<HandlePosition, HandlePosition> = {
  top: 'top',
  bottom: 'bottom',
  left: 'right',
  right: 'left',
  topLeft: 'topRight',
  topRight: 'topLeft',
  bottomLeft: 'bottomRight',
  bottomRight: 'bottomLeft',
}

/** `left`/`right` өрістері бар нысанды айналдыру. */
function swapSides<T extends { left?: number | undefined; right?: number | undefined }>(o: T): T {
  return { ...o, left: o.right, right: o.left }
}

function mirrorFronts(fronts: SectionFronts): SectionFronts {
  const out: SectionFronts = { ...fronts }
  if (fronts.opening === 'left') out.opening = 'right'
  else if (fronts.opening === 'right') out.opening = 'left'
  if (fronts.gaps) out.gaps = swapSides(fronts.gaps)
  if (fronts.handle) {
    out.handle = { ...fronts.handle, position: MIRRORED_HANDLE[fronts.handle.position] }
  }
  return out
}

function mirrorContent(content: SectionContent, sectionWidth: number | undefined): SectionContent {
  switch (content.kind) {
    case 'shelves':
      return content.insets ? { ...content, insets: swapSides(content.insets) } : content
    case 'drawers':
      return content.fillers ? { ...content, fillers: swapSides(content.fillers) } : content
    case 'stand':
      /*
       * Стойканың орны ұяның СОЛ шетінен есептеледі, сондықтан айнада ол
       * `ені − орны` болады. Ені белгісіз болса (flex секция), нақты орынды
       * айналдыру мүмкін емес — ол кезде саны бойынша тең таралуы қалады,
       * ал ол симметриялы, яғни айнаға тимейді.
       */
      if (!content.at || sectionWidth === undefined) return content
      return { ...content, at: content.at.map((x) => sectionWidth - x).sort((a, b) => a - b) }
    default:
      return content
  }
}

function mirrorSection(section: Section): Section {
  return {
    ...section,
    contents: section.contents.map((c) => mirrorContent(c, section.width)),
    ...(section.fronts ? { fronts: mirrorFronts(section.fronts) } : {}),
  }
}

export type MirrorCheck = { ok: true } | { ok: false; reason: string }

/**
 * Айналдыруға бола ма.
 *
 * Бұрыштық (трапеция) корпус айналмайды: модельде тек `corner.depthAtRight`
 * бар, яғни тереңдік әрқашан СОЛДАН ОҢҒА қарай өзгереді. Айнасы «оңнан
 * солға» болар еді, ал ондай өріс жоқ. Жалған айна беруден гөрі, ашық
 * айтқан дұрыс: цех ондай модульді екінші рет қолмен тереді.
 */
export function canMirror(config: CabinetConfig): MirrorCheck {
  if (config.corner) {
    return {
      ok: false,
      reason: 'Угловой (переходной) корпус не зеркалится: глубина в модели всегда меняется слева направо.',
    }
  }
  return { ok: true }
}

/**
 * Айна көшірмесінде НЕ ЖОҒАЛАДЫ. Пайдаланушыға ЖАСАМАС БҰРЫН айтылады.
 *
 * Қолмен қойылған ойма мен присадка панельдің id-іне байланған
 * (`side-left`, `s1-front-2`), ал айнада сол панельдер орын ауыстырады да,
 * олардың ішкі координаталары да шағылысады. Оны «шамамен» көшірсек,
 * раковинаның ойығы басқа жаққа шығып кетер еді — ондай қате цехта ғана
 * байқалады. Сондықтан олар КӨШІРІЛМЕЙДІ.
 */
export function mirrorNotes(config: CabinetConfig): string[] {
  const notes: string[] = []
  const cutouts = Object.values(config.panelCutouts ?? {}).flat().length
  if (cutouts > 0) notes.push(`вырезы, поставленные вручную (${cutouts})`)
  const edits = Object.keys(config.drillEdits ?? {}).length
  if (edits > 0) notes.push(`ручные правки присадки (${edits} дет.)`)
  const grains = Object.keys(config.panelGrain ?? {}).length
  if (grains > 0) notes.push(`направление текстуры по деталям (${grains})`)
  return notes
}

/** Айна көшірмесі. `id` — жаңа модульдің идентификаторы. */
export function mirrorCabinet(config: CabinetConfig, id: string): CabinetConfig {
  const check = canMirror(config)
  if (!check.ok) throw new Error(check.reason)

  const out: CabinetConfig = {
    ...config,
    id,
    name: `${config.name} (зеркало)`,
    // Секциялар СОЛДАН ОҢҒА тізілген, сондықтан айна — тізімнің кері реті.
    sections: [...config.sections].reverse().map(mirrorSection),
  }

  if (config.mounts) {
    out.mounts = {
      ...(config.mounts.top ? { top: MIRRORED_MOUNT[config.mounts.top] } : {}),
      ...(config.mounts.bottom ? { bottom: MIRRORED_MOUNT[config.mounts.bottom] } : {}),
    }
  }
  if (config.frontPanel) {
    out.frontPanel = { ...config.frontPanel, side: config.frontPanel.side === 'left' ? 'right' : 'left' }
  }
  if (config.rails) {
    out.rails = config.rails.map((r) => (
      r.position === 'left' ? { ...r, position: 'right' as const }
        : r.position === 'right' ? { ...r, position: 'left' as const }
          : r
    ))
  }
  if (config.customParts) {
    /*
     * Ерікті детальдің орны корпустың СОЛ-төмен-алдыңғы бұрышынан
     * есептеледі. Айнада оның сол жиегі `W − x − ұзындығы` болады, ал
     * қалыңдығы бойынша тұрған детальде (тік панель) ұзындығы — Y өсінде,
     * сондықтан X бойынша алатын орны оның ҚАЛЫҢДЫҒЫ емес, `length`/`width`
     * жазықтығынан шығады: horizontal → length, front → width, vertical →
     * қалыңдық (материалдікі, мұнда белгісіз) — соңғысы үшін жиегі сол
     * қалпында қалдырылады да, деталь бір қалыңдыққа жылжуы мүмкін.
     */
    out.customParts = config.customParts.map((p) => {
      const spanX = p.plane === 'horizontal' ? p.length : p.plane === 'front' ? p.width : 0
      return { ...p, position: { ...p.position, x: config.width - p.position.x - spanX } }
    })
  }

  // Қолмен қойылған нәрселер КӨШІРІЛМЕЙДІ (`mirrorNotes` себебін айтады).
  delete out.panelCutouts
  delete out.drillEdits
  delete out.panelGrain
  return out
}
