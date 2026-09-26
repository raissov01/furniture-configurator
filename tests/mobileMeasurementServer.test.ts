import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMeasurementSyncAction, OBSTACLE_KINDS } from '../src/core/measure'
import type { MeasurementSurvey } from '../src/core/measure'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-mobile-measure-'))

let auth: typeof import('../lib/server/auth')
let service: typeof import('../lib/server/mobileMeasurement')

const n = (value: number) => ({ value, source: 'manual' as const, capturedAt: 1000 })
const obstacles = () => Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, {
  status: 'absent', photoRef: 'photo-1', location: null,
}])) as MeasurementSurvey['walls']['north']['obstacles']
const survey = (): MeasurementSurvey => ({
  id: 'measure-1', height: n(2700),
  walls: {
    north: { length: n(3200), obstacles: obstacles() },
    east: { length: n(2400), obstacles: obstacles() },
    south: { length: n(3200), obstacles: obstacles() },
    west: { length: n(2400), obstacles: obstacles() },
  },
  corners: { northWest: n(90), northEast: n(90), southEast: n(90), southWest: n(90) },
})

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  service = await import('../lib/server/mobileMeasurement')
})

describe('телефон өлшемі мен фотосының сервер синхроны', () => {
  it('сурет пен әрекетті бір ID-мен қайта жібергенде көбейтпейді, ескі revision қайшылығын көрсетеді', () => {
    const owner = auth.register('mobile-measure@example.kz', 'password123', 'Цех замер')
    if (!owner.ok) throw new Error(owner.error)
    const shopId = owner.account.shopId
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    expect(service.saveMeasurementPhoto(shopId, 'photo-1', 'image/jpeg', photo, 1000)).toBe('applied')
    expect(service.saveMeasurementPhoto(shopId, 'photo-1', 'image/jpeg', photo, 1001)).toBe('duplicate')
    expect(() => service.saveMeasurementPhoto(shopId, 'photo-1', 'image/jpeg', new Uint8Array([1, 2, 3]), 1002)).toThrow(/ID|id/i)

    const first = createMeasurementSyncAction(survey(), 'action-1', { version: 0, updatedAt: 0 }, 1000)
    expect(service.applyMeasurementSync(shopId, first, 1100)).toMatchObject({ kind: 'applied', revision: { version: 1 } })
    expect(service.applyMeasurementSync(shopId, first, 1101)).toMatchObject({ kind: 'duplicate', revision: { version: 1 } })
    const changed = survey()
    changed.height = n(2750)
    const stale = createMeasurementSyncAction(changed, 'action-2', { version: 0, updatedAt: 0 }, 1001)
    expect(service.applyMeasurementSync(shopId, stale, 1200)).toMatchObject({
      kind: 'conflict', revision: { version: 1 }, serverValue: { height: { value: 2700 } },
    })
    const current = service.readMeasurement(shopId, 'measure-1')
    expect(current?.survey.height.value).toBe(2700)
    const fresh = createMeasurementSyncAction(changed, 'action-3', current!.revision, 1201)
    expect(service.applyMeasurementSync(shopId, fresh, 1202)).toMatchObject({ kind: 'applied', revision: { version: 2 } })
    expect(service.readMeasurement(shopId, 'measure-1')?.survey.height.value).toBe(2750)
  })

  it('сурет жоқ болса жазбайды және басқа цехтың суреті мен өлшемін ашпайды', () => {
    const owner = auth.register('mobile-missing@example.kz', 'password123', 'Цех A')
    const other = auth.register('mobile-other@example.kz', 'password123', 'Цех B')
    if (!owner.ok || !other.ok) throw new Error('Тіркелу сәтсіз')
    const action = createMeasurementSyncAction(survey(), 'missing-action', { version: 0, updatedAt: 0 }, 1000)
    expect(() => service.applyMeasurementSync(owner.account.shopId, action, 1100)).toThrow(/photoRef|фото/)
    service.saveMeasurementPhoto(other.account.shopId, 'photo-1', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 1101)
    expect(() => service.applyMeasurementSync(owner.account.shopId, action, 1102)).toThrow(/photoRef|фото/)
    expect(service.readMeasurement(other.account.shopId, 'measure-1')).toBeNull()
    expect(service.readMeasurementPhoto(owner.account.shopId, 'photo-1')).toBeNull()
  })
})
