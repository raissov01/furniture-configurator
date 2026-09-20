/**
 * Трапеция болып кесілетін панельдің (ЕН бойынша қиғаш — бұрыштық/переходной
 * корпустың крышкасы, дносы, сөресі, перегородкасы) РЕЗ кеңістігіндегі
 * НАҒЫЗ материал шекарасы.
 *
 * Неге бөлек файл (docs/audit/drilling-fix-plan.md K2,
 * docs/audit/corner-2026-09-20.md §5.2). `tests/drillBounds.test.ts`-тегі
 * жалпы тексеру («әр тесік панельдің шегінде жатуы керек») ЗАГОТОВКАНЫҢ
 * тікбұрыш габаритін тексереді: 0 ≤ x ≤ cutLength, 0 ≤ y ≤ cutWidth. Бірақ
 * `Panel.bevel` болғанда заготовка тікбұрыш болса да, ЕН қысқаратын ұшында
 * материалы жоқ үшбұрыш аймақ бар — гильотин ол жерді бөлек, қиғашпен
 * кеседі. Габарит ішінде, бірақ сол үшбұрышта жатқан тесік ескі тексеруден
 * ӨТІП КЕТЕДІ (нақты мысал: `bottom.edgeW2 x=48` — рез 598 енінің ішінде,
 * бірақ трапеция кесілгенде жоғалатын жерде).
 *
 * Формула `src/core/export/dxf.ts`-тегі `panelToDxf`-тің контур есебімен
 * (widthAtStart/End → shrink → w0/w1 → сызықтық интерполяция) ӘДЕЙІ дәл
 * бірдей. Бұл екеуі АЙЫРЫЛЫП КЕТСЕ, DXF-тегі станокқа кететін пішін мен
 * присадка тексеруінің «дұрыс» түсінігі екі басқа геометрия болып қалады —
 * сонда осы тексеру ДӘЛ СОЛ ақауды (пішін мен присадка алшақтауын) көрмей
 * қалады. `dxf.ts`-ті осы жерден импорттаудың орнына (ол сурет салуға
 * оңтайланған, сан қайтаруға емес — polyline нүктелерін жасайды) есепті
 * осында ҚАЙТАЛАЙМЫЗ, dxf.ts-ті өзгертпей, тек мұқият оқып.
 */
import { isWidthBevel } from './types'
import type { Panel } from './types'

/** РЕЗ ұзындығының `x` нүктесінде трапецияның ЕНІ (РЕЗ кеңістігінде), мм. */
function widthAtCutX(
  bevel: { widthAtStart: number; widthAtEnd: number },
  x: number,
  cutLength: number,
  shrink: number,
): number {
  // Кромка ГОТОВЫЙ енді рез енге дейін қысқартады — қиғаштың екі ұшы да
  // сонша қысқарады (dxf.ts:203-205-тегі `shrink` дәл осы).
  const w0 = Math.max(0, bevel.widthAtStart - shrink)
  const w1 = Math.max(0, bevel.widthAtEnd - shrink)
  if (cutLength <= 0) return w0
  return w0 + (w1 - w0) * (x / cutLength)
}

/**
 * `x` (0..cutLength, панельдің локал ұзындық осі) нүктесінде МАТЕРИАЛ бар
 * `y` аралығы (РЕЗ кеңістігінде), `[yMin, yMax]`.
 *
 * Панельде ЕН бойынша қиғаш жоқ болса (`bevel` жоқ немесе ҰЗЫНДЫҚ бойынша
 * қиғаш — мансарда) — толық ен қайтарылады: бұл жағдайда ескі (тікбұрыш)
 * тексеру дұрыс, өзгеше есептеудің қажеті жоқ.
 */
export function materialWidthRangeAt(panel: Panel, x: number): [number, number] {
  const b = panel.bevel
  if (!b || !isWidthBevel(b)) return [0, panel.cutWidth]
  // §4.3: cutWidth = finishedWidth − t(L1) − t(L2). Осы екеуінің
  // айырмасы — dxf.ts-тегі `shrink`-пен бірдей шама.
  const shrink = panel.finishedWidth - panel.cutWidth
  const w = widthAtCutX(b, x, panel.cutLength, shrink)
  // alignWidth 'end' — материал ЕН осінің СОҢЫНА (cutWidth) тураланады
  // (мыс. бұрыштық корпустың арты қабырғаға тіреледі); 'start' — басына.
  return b.alignWidth === 'end' ? [panel.cutWidth - w, panel.cutWidth] : [0, w]
}
