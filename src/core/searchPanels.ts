/**
 * «Найти» — жоба бойынша іздеу (PRO100 `TFINDERFORM`, `docs/pro100/parity.md`
 * §2.1: бұрын ⚠ ІШІНАРА еді — тек `ShopSettings.tsx`-тегі декор іздеуі,
 * жалпы нысан/деталь іздеуі жоқ болатын).
 *
 * Таза функция: React/three.js импорты ЖОҚ (CLAUDE.md §3). Бөлектеу мен
 * «сол детальге өту» — React қабатында, `store/configurator.ts`-тегі бар
 * `selected`/`setSelected` таңдау механизмімен (тапсырмада: «жаңасын ойлап
 * таппа»).
 *
 * ⚠ ГОЧА №1 (JS `\b`/`\w`). `\w` тек ASCII `[A-Za-z0-9_]`-ды білдіреді,
 * кириллица оған кірмейді (Unicode property escape — `\p{L}` — жазбасаң).
 * Сондықтан «сөз шекарасы» логикасы («полка» деп жазса, «полкодержатель»-ді
 * ЕМЕС, тек бөлек «полка» сөзін табу) кез келген кириллица мәтінінде
 * дұрыс жұмыс істемес еді. ШЕШІМ: сөз шекарасын МҮЛДЕМ қолданбаймыз —
 * қарапайым РЕГИСТРГЕ ТӘУЕЛСІЗ ІШКІ ЖОЛ ІЗДЕУ (`String.includes`), ол
 * Unicode-қа немқұрайлы әрі цехтың нақты сұрағына («дуб» деп жазып «Дуб
 * Бардолино»-ны табу) жеткілікті. Кемшілігі біреу-ақ: «полка» «полкодержатель»
 * ішінен де табылады — бұл цехта ЗИЯНСЫЗ артық сәйкестік, ал сөз шекарасын
 * дұрыс жазбай қалу (кириллицада) МҮЛДЕ таппай қалудан әлдеқайда жаман.
 *
 * ⚠ ГОЧА №2 (латын/кириллица гомоглифі). 2026-09-20 күні Kronospan
 * декорларының бірінде «Kамень» деп ЛАТЫН „K“-мен жазылғаны табылды —
 * деректегі нақты қате (`docs/pro100/...` тексерісінде байқалған). ШЕШІМ:
 * іздеу алдында екі жолды да (сұрау мен деректі) `foldHomoglyphs`-пен бір
 * КАНОНДЫҚ түрге келтіреміз — латынның кириллицамен бірдей көрінетін
 * әріптерін (A/А, E/Е, K/К, M/М, H/Н, O/О, P/Р, C/С, T/Т, X/Х, Y/У және
 * кіші нұсқалары) кириллицаға бүктейміз. Бұл ӘДЕЙІ ЕКІ БАҒЫТТЫ: цех
 * «камень» деп кириллицамен жазса да, «Kамень»-нің латын K-і арқасында
 * таппай қалмайды. ЭКРАНДА көрсетілетін атау (`panel.label`, материал аты)
 * ӨЗГЕРМЕЙДІ — тек салыстыру үшін нормаланады: деректегі қатені ЖАСЫРУ
 * емес, ТАБУ керек, өйтпесе цех «Kамень» деген material-ды ешқашан
 * іздеуден таппай, атауын түзетпейді де.
 */

import { ROLE_NAMES } from './materialUsage'
import type { Material, Panel } from './types'

/** Латын әрпі → көрінісі бірдей кириллица әрпі. Бір бағытты канондау жеткілікті: екі жол да осымен бүктеледі. */
const HOMOGLYPHS: Record<string, string> = {
  A: 'А', a: 'а',
  B: 'В',
  E: 'Е', e: 'е',
  K: 'К', k: 'к',
  M: 'М',
  H: 'Н',
  O: 'О', o: 'о',
  P: 'Р', p: 'р',
  C: 'С', c: 'с',
  T: 'Т',
  X: 'Х', x: 'х',
  Y: 'У', y: 'у',
}

function foldHomoglyphs(text: string): string {
  let out = ''
  for (const ch of text) out += HOMOGLYPHS[ch] ?? ch
  return out
}

/** Іздеу үшін канондық түрге келтіру: гомоглиф бүктеу + кіші әріп. Көрсетілетін мәтінге ҚОЛДАНЫЛМАЙДЫ. */
function normalizeForSearch(text: string): string {
  return foldHomoglyphs(text).toLowerCase()
}

export type PanelSearchHit = {
  cabinetId: string
  panel: Panel
}

/**
 * Жоба бойынша іздеу: деталь атауы (`label`), рөлі («боковина», «полка» —
 * `ROLE_NAMES`), материалы, готовый ӘРІ рез өлшемі бойынша.
 *
 * `items` — корпус бойынша топталған панельдер (`useSceneItems`-тегі
 * `items`-пен бірдей пішін: `{ cabinetId, panels }[]`), сондықтан «сол
 * детальге өту» үшін қай корпусты активтендіру керегі белгілі болады.
 */
export function searchProjectPanels(
  items: { cabinetId: string; panels: Panel[] }[],
  materials: Material[],
  query: string,
): PanelSearchHit[] {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return []

  const materialById = new Map(materials.map((m) => [m.id, m]))
  const hits: PanelSearchHit[] = []

  for (const { cabinetId, panels } of items) {
    for (const panel of panels) {
      const material = materialById.get(panel.materialId)
      const haystack = normalizeForSearch([
        panel.label,
        ROLE_NAMES[panel.role],
        material?.name ?? panel.materialId,
        String(panel.finishedLength),
        String(panel.finishedWidth),
        `${panel.finishedLength}x${panel.finishedWidth}`,
        `${panel.finishedLength}×${panel.finishedWidth}`,
      ].join(' '))
      if (haystack.includes(needle)) hits.push({ cabinetId, panel })
    }
  }
  return hits
}
