/**
 * Тұтқаның 3D ПІШІНІ мен ящиктің тұтқасы.
 *
 * Басты талап: экрандағы тұтқа тесіктің ДӘЛ ҮСТІНДЕ тұрады. Пішін де,
 * тесік те `handleBorePoints`-тен шығады — екі бөлек есеп болса, бір күні
 * клиентке тесіктен басқа жерде тұрған тұтқа көрсетіледі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, defaultHandles, generateCabinet, generateKitchen, handleBorePoints, handleShape,
} from '../src/core/index'
import type { CabinetConfig, HandleSpec } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const handles = defaultHandles()
const model = (id: string) => handles.find((h) => h.id === id)!
const spec = (id: string, boreSpacing = 128): HandleSpec =>
  ({ handleId: id, boreSpacing, position: 'top', edgeOffset: 35, endOffset: 50 })

describe('тұтқаның 3D пішіні', () => {
  it('скобаның ортасы екі тесіктің ортасында, аралығы — межцентровое', () => {
    const s = spec('handle-bar', 128)
    const shape = handleShape(model('handle-bar'), s, 700, 400)!
    const [a, b] = handleBorePoints(model('handle-bar'), s, 700, 400)
    expect(shape.along).toBe((a!.along + b!.along) / 2)
    expect(shape.across).toBe((a!.across + b!.across) / 2)
    expect(shape.spacing).toBe(128)
    expect(shape.direction).toBe('across')
  })

  it('сол/оң жақта тұтқа ТІК тұрады', () => {
    const shape = handleShape(model('handle-rail'), { ...spec('handle-rail'), position: 'left' }, 700, 400)!
    expect(shape.direction).toBe('along')
    expect(shape.across).toBe(35)
    expect(shape.along).toBe(350)
  })

  it('кнопкада аралық нөл, ортасы — жалғыз тесік', () => {
    const shape = handleShape(model('handle-knob'), spec('handle-knob'), 700, 400)!
    expect(shape).toMatchObject({ kind: 'knob', spacing: 0, along: 665, across: 200 })
  })

  it('профильде тесік жоқ, бірақ пішіні жиекті толық бойлайды', () => {
    expect(handleShape(model('handle-profile'), spec('handle-profile'), 700, 400))
      .toMatchObject({ kind: 'profile', edge: 'top', length: 400, along: 700, across: 200 })
    expect(handleShape(model('handle-profile-gola'), { ...spec('handle-profile-gola'), position: 'right' }, 700, 400))
      .toMatchObject({ edge: 'right', length: 700, direction: 'along', across: 400 })
    // Бұрыштық орын профильде жақын жиекке түседі.
    expect(handleShape(model('handle-profile-c'), { ...spec('handle-profile-c'), position: 'bottomLeft' }, 700, 400))
      .toMatchObject({ edge: 'bottom', along: 0 })
  })

  it('тұтқасызда пішін де жоқ', () => {
    expect(handleShape(model('handle-none'), spec('handle-none'), 700, 400)).toBeNull()
  })

  it('фасадтың 3D тұтқасы оның ТЕСІКТЕРІНІҢ үстінде', () => {
    const cabinet = withCabinet({
      sections: [{
        id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }],
        fronts: { count: 1, mount: 'overlay', handle: spec('handle-bar', 128) },
      }],
    })
    const front = generateCabinet(cabinet, { ...catalog, handles }).find((p) => p.role === 'front')!
    expect(front.handle).toMatchObject({
      kind: 'bar', spacing: 128, along: front.finishedLength - 35, across: front.finishedWidth / 2,
    })
    expect(front.drilling.filter((d) => d.purpose === 'handle')).toHaveLength(2)
  })

  it('каталогсыз тұтқа да, пішін де жоқ (бұрынғы мінез)', () => {
    const front = generateCabinet(withCabinet({}), catalog).find((p) => p.role === 'front')!
    expect(front.handle).toBeUndefined()
  })
})

describe('ящиктің тұтқасы', () => {
  const drawerCabinet = (handle?: HandleSpec | null): CabinetConfig => withCabinet({
    height: 720,
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'drawers', count: 3, ...(handle !== undefined ? { handle } : {}) }],
      fronts: null,
    }],
  })
  const drawerFronts = (cabinet: CabinetConfig) =>
    generateCabinet(cabinet, { ...catalog, handles }).filter((p) => p.role === 'front')

  it('әдепкіде ӘР ящиктің фасадында цехтың тұтқасы: тесігі де, пішіні де', () => {
    const fronts = drawerFronts(drawerCabinet())
    expect(fronts).toHaveLength(3)
    for (const front of fronts) {
      expect(front.drilling.filter((d) => d.purpose === 'handle')).toHaveLength(2)
      expect(front.handle?.kind).toBe('bar')
    }
  })

  it('null — әдейі тұтқасыз: тесік те, пішін де жоқ', () => {
    for (const front of drawerFronts(drawerCabinet(null))) {
      expect(front.drilling.some((d) => d.purpose === 'handle')).toBe(false)
      expect(front.handle).toBeUndefined()
    }
  })

  it('ящикке өз тұтқасы — ракушка', () => {
    for (const front of drawerFronts(drawerCabinet(spec('handle-shell', 96)))) {
      expect(front.handle).toMatchObject({ kind: 'shell', spacing: 96 })
    }
  })

  it('каталогта жоқ тұтқа — ящиктің өрісін атайтын қате', () => {
    expect(() => drawerFronts(drawerCabinet(spec('nope')))).toThrow(/тұтқа табылмады/)
  })
})

describe('ас үй генераторы', () => {
  it('үстіңгі шкафтың тұтқасы АСТЫҢҒЫ жиекте, төменгінікі — үстіңгі', () => {
    const cat = { ...SEED_CATALOG, handles }
    const { cabinets } = generateKitchen({ layout: 'straight', lengthA: 3000 }, cat)
    // Сорғыш шкафының есігі әдейі тұтқасыз; алғашқы upper енді сол болуы мүмкін.
    const upperFront = cabinets.filter((c) => c.id.includes('-up-'))
      .flatMap((c) => generateCabinet(c, cat)).find((p) => p.role === 'front' && p.handle)!
    const lowerFront = cabinets.filter((c) => !c.id.includes('-up-') && c.height < 1000)
      .flatMap((c) => generateCabinet(c, cat)).find((p) => p.role === 'front' && p.handle)!
    expect(upperFront).toBeDefined()
    expect(lowerFront).toBeDefined()
    expect(upperFront.handle!.along).toBe(35)
    expect(lowerFront.handle!.along).toBe(lowerFront.finishedLength - 35)
  })
})
