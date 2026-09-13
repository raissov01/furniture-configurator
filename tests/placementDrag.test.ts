/**
 * 3D-де модульді сүйреп жылжыту: қабырға бойындағы жаңа орын.
 *
 * Талаптар: нәтиже бүтін мм, әрқашан қабырғаның ішінде, көршіге саңылаусыз
 * жабысады (ас үй қатары), магнит жоқта 10 мм торға түседі.
 */
import { describe, expect, it } from 'vitest'
import { DRAG_MAGNET, DRAG_STEP, snapOffset } from '../src/core/index'

const WALL = 4000
const W = 600

describe('сүйреген модульдің орны', () => {
  it('магнит жоқта 10 мм торға түседі', () => {
    expect(snapOffset(1234, W, WALL, [])).toBe(1230)
    expect(snapOffset(1236, W, WALL, [])).toBe(1240)
  })

  it('қабырғадан шықпайды', () => {
    expect(snapOffset(-300, W, WALL, [])).toBe(0)
    expect(snapOffset(5000, W, WALL, [])).toBe(WALL - W)
  })

  it('қабырғаның шетіне жабысады, тор сол шетті өткізіп жібермейді', () => {
    // Торға дөңгелектесе 20 шығар еді — модуль бұрыштан 20 мм алшақ қалады.
    expect(snapOffset(22, W, WALL, [])).toBe(0)
    // 3405 емес: оң шеті дәл қабырғаның шетінде.
    expect(snapOffset(3371, 595, WALL, [])).toBe(3405)
  })

  it('көршінің оң жағына саңылаусыз тіркеледі', () => {
    expect(snapOffset(625, W, WALL, [{ start: 0, end: 600 }])).toBe(600)
  })

  it('көршінің сол жағына саңылаусыз тіркеледі', () => {
    expect(snapOffset(872, W, WALL, [{ start: 1500, end: 2100 }])).toBe(900)
  })

  it('екі магниттің ең жақыны ұтады', () => {
    const neighbours = [{ start: 0, end: 600 }, { start: 1220, end: 1820 }]
    expect(snapOffset(612, W, WALL, neighbours)).toBe(620)
    expect(snapOffset(606, W, WALL, neighbours)).toBe(600)
  })

  it('қабырғадан тыс магнит есепке алынбайды', () => {
    // Көршінің сол жағы (−100) қабырғадан тыс — модуль 0-ге жабысады.
    expect(snapOffset(10, W, WALL, [{ start: 500, end: 1100 }])).toBe(0)
  })

  it('магниттің шегінен алыста тек тор', () => {
    const raw = 600 + DRAG_MAGNET + 7
    expect(snapOffset(raw, W, WALL, [{ start: 0, end: 600 }])).toBe(Math.round(raw / DRAG_STEP) * DRAG_STEP)
  })

  it('модуль қабырғадан кең болса — 0', () => {
    expect(snapOffset(300, 4200, WALL, [])).toBe(0)
  })

  it('нәтиже әрқашан бүтін мм', () => {
    for (let raw = -50; raw < WALL; raw += 37.3) {
      expect(Number.isInteger(snapOffset(raw, 595, WALL, [{ start: 1003, end: 1598 }]))).toBe(true)
    }
  })
})
