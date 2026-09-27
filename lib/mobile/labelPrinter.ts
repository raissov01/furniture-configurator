import { encodePartQr, type PartQr } from '@/src/core/partQr'

export type LabelPrintJob = { part: PartQr; copies: number }
export type LabelPrintReceipt = { status: 'simulated'; copies: number }

/** Transport contract: real BLE framing remains device-specific and is intentionally absent. */
export interface LabelPrinter {
  print(job: LabelPrintJob): Promise<LabelPrintReceipt>
}

/** Device-free adapter for UI/integration tests. It sends no Bluetooth packets. */
export class MockLabelPrinter implements LabelPrinter {
  readonly jobs: { payload: string; copies: number }[] = []

  async print(job: LabelPrintJob): Promise<LabelPrintReceipt> {
    if (!Number.isSafeInteger(job.copies) || job.copies < 1) {
      throw new RangeError('copies: оң бүтін сан болуы керек')
    }
    const payload = encodePartQr(job.part)
    this.jobs.push({ payload, copies: job.copies })
    return { status: 'simulated', copies: job.copies }
  }
}
