import { describe, expect, it } from 'vitest'
import { createKaspiManualPlan } from '../src/core/kaspiManual'

describe('Kaspi Pay қолмен төлеу жоспары', () => {
  it('аванс пен соңғы төлемді тиынмен дәл бөледі', () => {
    const plan = createKaspiManualPlan({ totalMinor: 125_050_25, advanceMinor: 30_000_25, reference: 'КП-17' })
    expect(plan.totalMinor).toBe(125_050_25)
    expect(plan.advance.amountMinor).toBe(30_000_25)
    expect(plan.final.amountMinor).toBe(95_050_00)
    expect(plan.advance.method).toBe('manualKaspiInvoice')
    expect(plan.advance.status).toBe('awaitingMerchantInvoice')
    expect(plan.advance.instructions).toContain('30000,25 ₸')
    expect(plan.final.instructions).toContain('95050,00 ₸')
  })

  it('цех өзі көшірген Kaspi сілтемесін ғана сақтайды және соманы өзі енгізу керегін көрсетеді', () => {
    const plan = createKaspiManualPlan({ totalMinor: 100_000, advanceMinor: 25_000, reference: 'КП-18', merchantPaymentUrl: 'https://pay.kaspi.kz/example' })
    expect(plan.advance.merchantPaymentUrl).toBe('https://pay.kaspi.kz/example')
    expect(plan.final.merchantPaymentUrl).toBe('https://pay.kaspi.kz/example')
    expect(plan.advance.instructions).toMatch(/соманы.*өзі енгізеді/)
    expect(plan.advance.status).toBe('awaitingMerchantInvoice')
  })

  it.each([
    { totalMinor: 0, advanceMinor: 0, reference: 'КП-1' },
    { totalMinor: 100, advanceMinor: 0, reference: 'КП-1' },
    { totalMinor: 100, advanceMinor: 100, reference: 'КП-1' },
    { totalMinor: 100, advanceMinor: 101, reference: 'КП-1' },
    { totalMinor: 100.5, advanceMinor: 50, reference: 'КП-1' },
    { totalMinor: Number.MAX_SAFE_INTEGER + 1, advanceMinor: 50, reference: 'КП-1' },
    { totalMinor: 100, advanceMinor: 50, reference: '' },
    { totalMinor: 100, advanceMinor: 50, reference: 'КП-1\nтөленді' },
  ])('қате ақша/нөмір мәнін қабылдамайды: %j', (input) => {
    expect(() => createKaspiManualPlan(input)).toThrow()
  })

  it.each(['http://kaspi.kz/pay', 'https://kaspi.kz.evil.test/pay', 'https://kaspi.kz:444/pay', 'javascript:alert(1)'])('бөгде немесе қорғалмаған сілтемені қабылдамайды: %s', (merchantPaymentUrl) => {
    expect(() => createKaspiManualPlan({ totalMinor: 1000, advanceMinor: 500, reference: 'КП-1', merchantPaymentUrl })).toThrow()
  })
})
