/**
 * Тұтқалар каталогы.
 *
 * Ең маңыздысы — ТҮРІ мен ПРИСАДКАНЫҢ байланысы: скобаға екі тесік, кнопкаға
 * бір, профильге мүлде жоқ. Каталогты цех толықтырады, ал әр моделі сметада
 * өз жолын алуы керек — әйтпесе тұтқа ақшаға кірмей қалады.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HANDLE_ID, catalogOf, defaultHandles, defaultShopProfile, generateCabinet,
  handleBorePoints,
} from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const handles = defaultHandles()
const spec = (id: string, boreSpacing = 128) =>
  ({ handleId: id, boreSpacing, position: 'top' as const, edgeOffset: 35, endOffset: 50 })

describe('тұтқалардың каталогы', () => {
  it('әдепкі тұтқа тізімде бар', () => {
    expect(handles.some((h) => h.id === DEFAULT_HANDLE_ID)).toBe(true)
  })

  it('түрлері бар: скоба, рейлинг, ракушка, кнопка, профиль, тұтқасыз', () => {
    const kinds = new Set(handles.map((h) => h.kind))
    expect(kinds).toEqual(new Set(['bar', 'rail', 'shell', 'knob', 'profile', 'none']))
  })

  it('ӘР МОДЕЛЬДІҢ сметада өз жолы бар (әйтпесе ақшаға кірмей қалады)', () => {
    const shop = defaultShopProfile()
    for (const h of handles) {
      expect(shop.hardware.some((row) => row.id === h.hardwareId)).toBe(true)
    }
  })

  it('баға БАРЛЫҒЫНДА нөл: артикул да, баға да цехтікі', () => {
    const shop = defaultShopProfile()
    const handleRows = shop.hardware.filter((h) => h.kind === 'handle')
    expect(handleRows.length).toBeGreaterThanOrEqual(handles.length)
    expect(handleRows.every((h) => h.pricePerUnit === 0)).toBe(true)
  })
})

describe('түр → присадка', () => {
  const front = { length: 700, width: 400 }
  const points = (id: string) => {
    const model = handles.find((h) => h.id === id)!
    return handleBorePoints(model, spec(id), front.length, front.width)
  }

  it('скоба мен рейлингте ЕКІ тесік', () => {
    expect(points('handle-bar')).toHaveLength(2)
    expect(points('handle-rail')).toHaveLength(2)
  })

  it('РАКУШКАДА да екі тесік — ол ящиктің фасадына отырады', () => {
    expect(points('handle-shell')).toHaveLength(2)
  })

  it('кнопкада БІР тесік', () => {
    expect(points('handle-knob')).toHaveLength(1)
  })

  it('профильде де, тұтқасызда да тесік ЖОҚ', () => {
    expect(points('handle-profile')).toHaveLength(0)
    expect(points('handle-profile-gola')).toHaveLength(0)
    expect(points('handle-none')).toHaveLength(0)
  })

  it('ракушканың аралықтары КІШІ: ол ұзын скобаның қатарымен жүрмейді', () => {
    const shell = handles.find((h) => h.id === 'handle-shell')!
    expect(Math.max(...shell.boreSpacings)).toBeLessThan(200)
  })
})

describe('жобада', () => {
  it('жаңа тұтқамен фасад жиналады әрі тесіктері шығады', () => {
    const cabinet = withCabinet({
      sections: [{
        id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }],
        fronts: { count: 1, mount: 'overlay', handle: spec('handle-shell', 96) },
      }],
    })
    // ⚠ Тұтқаның ТЕСІГІ каталогтағы модельден шығады: фикстурадағы каталогта
    // тек материалдар бар, сондықтан тұтқалар тізімін қосамыз.
    const panels = generateCabinet(cabinet, { ...catalog, handles })
    const front = panels.find((p) => p.role === 'front')!
    expect(front.drilling.filter((d) => d.purpose === 'handle')).toHaveLength(2)
  })

  it('каталог цехтың профилінен келеді, кодтан емес', () => {
    const shop = defaultShopProfile()
    const own = { ...shop, handles: [...shop.handles, {
      id: 'own-1', name: 'Ручка цеха', kind: 'bar' as const,
      boreSpacings: [128], boreDiameter: 5, hardwareId: 'own-1',
    }] }
    expect((catalogOf(own).handles ?? []).some((h) => h.id === 'own-1')).toBe(true)
  })
})
