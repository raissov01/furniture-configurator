/**
 * §O11 (docs/audit/drilling-2026-09-20.md) — ящик қорабының кромкасы қате
 * жиекке жазылған: тұрақты L1 орнына нағыз үстіңгі жиек panel.orientation-нан
 * шығуы керек (drilling.ts §R2-дегі confirmatJoint/edgeFaceFor тәсілі).
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, ORIENT_FACING, ORIENT_SIDE, calculateCutDimensions, edgeClasses,
} from '../src/core/index'
import type { EdgeBand } from '../src/core/index'
import { PVC2 } from './fixtures'

const bands = new Map<string, EdgeBand>([[PVC2, { id: PVC2, name: 'ПВХ 2 мм', thickness: 2, pricePerMeter: 100 }]])

describe('§O11 — ящик қорабы панелінің үстіңгі жиегі orientation-нан шығуы керек', () => {
  it('drawerSide (ORIENT_SIDE: length=y) — көрінетін жиек W2, L1 ЕМЕС', () => {
    const c = edgeClasses('drawerSide', 'sidesOverlay', ORIENT_SIDE)
    // ORIENT_SIDE: local x (length) → world y. position — төменгі бұрыш
    // (drilling.ts worldRange), сондықтан x=0 (W1) — асты, x=length (W2) — үсті.
    expect(c.W2).toBe('visibleSecondary')
    expect(c.L1).toBe('hidden')
    expect(c.W1).toBe('hidden')
    expect(c.L2).toBe('hidden')
  })

  it('drawerBack (ORIENT_FACING: length=y) — көрінетін жиек те дәл сол себеппен W2', () => {
    const c = edgeClasses('drawerBack', 'sidesOverlay', ORIENT_FACING)
    expect(c.W2).toBe('visibleSecondary')
    expect(c.L1).toBe('hidden')
    expect(c.W1).toBe('hidden')
    expect(c.L2).toBe('hidden')
  })

  it('топБоттомOverlay-де де нәтиже өзгермейді — ящик қорабы construction-ға тәуелсіз', () => {
    const c = edgeClasses('drawerBack', 'topBottomOverlay', ORIENT_FACING)
    expect(c.W2).toBe('visibleSecondary')
  })

  it('CLAUDE.md §4.3 — кромка W2-ге ауысса, cutLength (W осі) азаяды, cutWidth (L осі) ӨЗГЕРМЕЙДІ', () => {
    const classes = edgeClasses('drawerSide', 'sidesOverlay', ORIENT_SIDE)
    const policy = { visibleFront: null, visibleSecondary: PVC2, hidden: null }
    const edges = {
      L1: classes.L1 === 'hidden' ? null : { bandId: policy[classes.L1] ?? '' },
      L2: classes.L2 === 'hidden' ? null : { bandId: policy[classes.L2] ?? '' },
      W1: classes.W1 === 'hidden' ? null : { bandId: policy[classes.W1] ?? '' },
      W2: classes.W2 === 'hidden' ? null : { bandId: policy[classes.W2] ?? '' },
    }
    // Boxheight 300 (finishedLength — биіктік), boxDepth 500 (finishedWidth — тереңдік).
    const r = calculateCutDimensions(300, 500, edges, bands, DEFAULT_SETTINGS)
    // 2 мм кромка W2-де → тек cutLength (биіктік) 2 мм-ге қысқарады.
    expect(r.cutLength).toBe(298)
    expect(r.cutWidth).toBe(500)
  })
})
