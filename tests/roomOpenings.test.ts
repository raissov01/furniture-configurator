/**
 * Бөлменің терезесі мен есігі.
 *
 * Тексерілетіні: (1) ойық қабырғадан да, төбеден де шықпайды, бір-біріне
 * тимейді; (2) ойықтар тек иммерсивті көріністе салынады: шкафтың артында
 * қалғаны салынбайды, ал конструктор ол үшін ескертпейді; (3) 3D қабырғасы
 * ойықты дәл қалдырады; (4) жобада сақталады.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOM, SEED_CATALOG, clampInsideRoom, defaultOpenings, findTemplate, fitOpenings, parseProject,
  skirtingSpans, templateToCabinet, validateOpenings, validatePlacements, visibleOpenings, wallPieces,
} from '../src/core/index'
import type { Room, RoomOpening } from '../src/core/index'
import { referenceProject } from './fixtures'

const win = (p: Partial<RoomOpening> = {}): RoomOpening => ({
  id: 'w', kind: 'window', wall: 'north', offset: 1000, width: 1200, height: 1400, elevation: 850, ...p,
})
const door = (p: Partial<RoomOpening> = {}): RoomOpening => ({
  id: 'd', kind: 'door', wall: 'north', offset: 200, width: 800, height: 2050, elevation: 0, ...p,
})

describe('терезе мен есік', () => {
  it('әдепкі есік пен терезе әр бөлмеде жарамды әрі оңтүстік қабырғада', () => {
    for (const width of [3000, 4000, 6000]) {
      const room = { ...DEFAULT_ROOM, width }
      const openings = defaultOpenings(room)
      expect(openings.every((o) => o.wall === 'south')).toBe(true)
      expect(openings.some((o) => o.kind === 'door')).toBe(true)
      expect(validateOpenings({ ...room, openings })).toEqual([])
    }
  })

  it('қабырғадан шыққан терезе — қате', () => {
    const [issue] = validateOpenings({ ...DEFAULT_ROOM, openings: [win({ offset: 3500 })] })
    expect(issue?.message).toMatch(/не влезает/)
  })

  it('төбеден биік терезе — қате', () => {
    const [issue] = validateOpenings({ ...DEFAULT_ROOM, openings: [win({ elevation: 1500 })] })
    expect(issue?.message).toMatch(/выше потолка/)
  })

  it('бір қабырғада қиылысқан ойықтар — қате', () => {
    const issues = validateOpenings({ ...DEFAULT_ROOM, openings: [win(), door({ offset: 1500 })] })
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toMatch(/пересекается/)
  })

  it('бөлме кішірейгенде ойық қабырғаға қысылады, өлшемі өзгермейді', () => {
    const room: Room = { ...DEFAULT_ROOM, width: 3000, openings: [door({ wall: 'south', offset: 2900 })] }
    expect(fitOpenings(room)[0]).toMatchObject({ offset: 2200, width: 800 })
  })
})

describe('шкаф пен ойық', () => {
  // Тумба: цоколь 100 + корпус 720 = 820 мм — табалдырықтан (850) төмен.
  const lower = templateToCabinet(findTemplate('kitchen-base-full-600')!, SEED_CATALOG)
  const tall = templateToCabinet(findTemplate('kitchen-tall-600')!, SEED_CATALOG)
  const room: Room = { ...DEFAULT_ROOM, openings: [win(), door({ offset: 2500 })] }
  const at = (cabinet: typeof lower, wall: RoomOpening['wall'], offset: number) =>
    [{ cabinet, placement: { cabinetId: cabinet.id, wall, offset } }]

  const ids = (entries: ReturnType<typeof at>) => visibleOpenings(room, entries).map((o) => o.id)

  it('терезенің астындағы тумба — терезе көрінеді', () => {
    expect(ids(at(lower, 'north', 1200))).toEqual(['w', 'd'])
  })

  it('биік пеналдың артындағы терезе салынбайды', () => {
    expect(ids(at(tall, 'north', 1200))).toEqual(['d'])
  })

  it('шкафтың артындағы есік салынбайды', () => {
    expect(ids(at(lower, 'north', 2600))).toEqual(['w'])
  })

  it('басқа қабырғадағы шкаф әсер етпейді', () => {
    expect(ids(at(tall, 'east', 1200))).toEqual(['w', 'd'])
  })

  it('конструктор ойық үшін ЕСКЕРТПЕЙДІ (ол жерде ойық жоқ)', () => {
    expect(validatePlacements(room, at(tall, 'north', 1200))).toEqual([])
  })

  it('жарамсыз ойық (қабырғадан шыққан) салынбайды', () => {
    expect(visibleOpenings({ ...room, openings: [win({ offset: 3500 })] }, [])).toEqual([])
  })
})

describe('3D қабырғасы', () => {
  it('ойықсыз қабырға — бір бөлік', () => {
    expect(wallPieces(4000, 2700, [])).toEqual([{ x0: 0, x1: 4000, y0: 0, y1: 2700 }])
  })

  it('қабырғаның ауданы дәл ойықтың ауданына кемиді', () => {
    const area = wallPieces(4000, 2700, [win(), door()])
      .reduce((s, p) => s + (p.x1 - p.x0) * (p.y1 - p.y0), 0)
    expect(area).toBe(4000 * 2700 - 1200 * 1400 - 800 * 2050)
  })

  it('есіктің орнында тек үстіңгі бөлік қалады', () => {
    const inDoor = wallPieces(4000, 2700, [door()]).filter((p) => p.x0 >= 200 && p.x1 <= 1000)
    expect(inDoor).toEqual([{ x0: 200, x1: 1000, y0: 2050, y1: 2700 }])
  })

  it('плинтус есіктің алдында үзіледі, терезенің астында үзілмейді', () => {
    expect(skirtingSpans(4000, [door(), win()], 90)).toEqual([[0, 200], [1000, 4000]])
  })
})

describe('прогулка мен VR', () => {
  it('адам қабырғаға 300 мм-ден жақындамайды', () => {
    expect(clampInsideRoom(DEFAULT_ROOM, { x: -500, z: 9000 })).toEqual({ x: 300, z: 2700 })
    expect(clampInsideRoom(DEFAULT_ROOM, { x: 2000, z: 1500 })).toEqual({ x: 2000, z: 1500 })
  })
})

describe('сақтау', () => {
  it('терезе, есік, әрлеу жобамен бірге сақталады', () => {
    const room: Room = {
      ...referenceProject.room, openings: [win(), door()], finish: { wallColor: '#cfd8c8', floor: 'tile' },
    }
    expect(parseProject({ ...referenceProject, room }).room).toEqual(room)
  })

  it('жарамсыз түс қабылданбайды', () => {
    expect(() => parseProject({
      ...referenceProject, room: { ...referenceProject.room, finish: { wallColor: 'red' } },
    })).toThrow()
  })
})
