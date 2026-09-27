import { describe, expect, it } from 'vitest'
import { findResultSizes } from '../lib/f11FindResult'

describe('F11 іздеу нәтижесінің өлшемдері', () => {
  it('дайын және кесу өлшемдерін жеке береді', () => {
    expect(findResultSizes({ finishedLength: 2000, finishedWidth: 447, cutLength: 2000, cutWidth: 445 }))
      .toEqual({ finished: '2000 × 447 мм', cut: '2000 × 445 мм' })
  })
})
