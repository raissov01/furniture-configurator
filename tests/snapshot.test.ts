/**
 * CLAUDE.md §8.7 — эталон шкаф: 2000 (H) × 600 (W) × 450 (D), 4 сөре, 2 фасад,
 * ЛДСП 16, арт қабырға внакладку, sidesOverlay.
 *
 * 11 ДЕТАЛЬ / 6 позиция. Бұл снапшот өзгерсе — өзгеріс ӘДЕЙІ болуы керек.
 */
import { describe, expect, it } from 'vitest'
import { formatCutList, generateCabinet } from '../src/core/index.js'
import { catalog, referenceWardrobe } from './fixtures.js'

describe('эталон шкаф-пенал', () => {
  const panels = generateCabinet(referenceWardrobe, catalog)
  const rows = formatCutList(panels, catalog, {
    shelfKind: referenceWardrobe.shelves.kind,
    backMode: referenceWardrobe.back.mode,
    frontMount: referenceWardrobe.fronts?.mount ?? 'overlay',
  })

  it('11 физикалық деталь, 6 позиция', () => {
    expect(panels).toHaveLength(11)
    expect(rows).toHaveLength(6)
    expect(rows.reduce((s, r) => s + r.qty, 0)).toBe(11)
  })

  it('деталировка сандары', () => {
    expect(
      rows.map((r) => ({
        Наименование: r.name,
        Колво: r.qty,
        Готовый: `${r.finishedLength}×${r.finishedWidth}`,
        Рез: `${r.cutLength}×${r.cutWidth}`,
        Толщина: r.thickness,
        Кромка: `${r.edgeL1}/${r.edgeL2}/${r.edgeW1}/${r.edgeW2}`,
      })),
    ).toEqual([
      { Наименование: 'Боковина', Колво: 2, Готовый: '2000×447', Рез: '2000×445', Толщина: 16, Кромка: '2.0/—/0.4/0.4' },
      { Наименование: 'Дно', Колво: 1, Готовый: '568×447', Рез: '568×445', Толщина: 16, Кромка: '2.0/—/—/—' },
      { Наименование: 'Крышка', Колво: 1, Готовый: '568×447', Рез: '568×445', Толщина: 16, Кромка: '2.0/—/—/—' },
      { Наименование: 'Полка', Колво: 4, Готовый: '566×447', Рез: '566×445', Толщина: 16, Кромка: '2.0/—/—/—' },
      { Наименование: 'Задняя стенка', Колво: 1, Готовый: '2000×600', Рез: '2000×600', Толщина: 3, Кромка: '—/—/—/—' },
      { Наименование: 'Фасад', Колво: 2, Готовый: '1994×295', Рез: '1990×291', Толщина: 16, Кромка: '2.0/2.0/2.0/2.0' },
    ])
  })

  it('деталировка РЕЗ өлшемін көрсетеді, 3D — ГОТОВЫЙ өлшемді', () => {
    const front = panels.find((p) => p.role === 'front')!
    expect(front.finishedWidth).toBe(295) // 3D осыны рендерлейді
    expect(front.cutWidth).toBe(291) // станок осыны кеседі
  })
})
