import { describe, expect, it } from 'vitest'
import { OFFLINE_CAPABILITIES, offlineCapability } from '../src/core/sync'

describe('функцияның желі талабы', () => {
  it('есептеу мен өндірістік экспорт телефонда офлайн', () => {
    for (const key of ['measurement', 'photo', 'generator', 'kitchenWizard', 'cutList', 'nesting', 'drilling', 'pricing', 'pdf', 'dxf', 'cnc', 'csv', 'xlsx', 'labels', 'qrScan'] as const) {
      expect(offlineCapability(key)).toEqual({ mode: 'offline', requiresInternet: false })
    }
  })

  it('серверге қажет функциялар queued не online деп бір жерден белгіленеді', () => {
    expect(offlineCapability('publishShare')).toEqual({ mode: 'queued', requiresInternet: true })
    for (const key of ['clientApproval', 'aiGenerate', 'bankPaymentCheck', 'firstLogin'] as const) {
      expect(offlineCapability(key)).toEqual({ mode: 'online', requiresInternet: true })
    }
    for (const key of Object.keys(OFFLINE_CAPABILITIES) as (keyof typeof OFFLINE_CAPABILITIES)[]) {
      const capability = offlineCapability(key)
      expect(capability.requiresInternet).toBe(capability.mode !== 'offline')
    }
  })
})
