import { describe, expect, it } from 'vitest'
import { MockLabelPrinter } from '../lib/mobile/labelPrinter'
import { encodePartQr } from '../src/core/partQr'

describe('Bluetooth label printer integration seam', () => {
  it('records the same validated QR payload that a future hardware driver receives', async () => {
    const printer = new MockLabelPrinter()
    const job = { part: { projectId: 'project-1', panelId: 'side-1', version: 1 }, copies: 2 }
    const receipt = await printer.print(job)
    expect(receipt).toEqual({ status: 'simulated', copies: 2 })
    expect(printer.jobs).toEqual([{ payload: encodePartQr(job.part), copies: 2 }])
  })

  it('rejects zero copies before a driver could send anything', async () => {
    const printer = new MockLabelPrinter()
    await expect(printer.print({ part: { projectId: 'p', panelId: 'q', version: 1 }, copies: 0 })).rejects.toThrow(/copies/)
    expect(printer.jobs).toEqual([])
  })
})
