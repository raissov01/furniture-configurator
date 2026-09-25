/** Келісім мөрінің жеке PDF-і. Қаріп пен 3D кадр сырттан беріледі. */
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import { projectFingerprint } from '../approval'
import type { ApprovalRevision } from '../approval'
import type { PdfFonts } from './pdf'

export type ApprovalPdfInput = {
  revision: ApprovalRevision<unknown>
  projectName: string
  fonts: PdfFonts
  /** Клиент көрген 3D кадрының PNG байттары; UI экспорт кезінде береді. */
  previewPng?: Uint8Array
}

export async function approvalStampPdf(input: ApprovalPdfInput): Promise<Uint8Array> {
  const { seal, hash, priceMinor, version } = input.revision
  if (!seal) throw new Error('Келісім мөрі: нұсқа мақұлданбаған')
  if (seal.hash !== hash || seal.priceMinor !== priceMinor) throw new Error('Келісім мөрі: нұсқа дерегі сәйкес емес')
  if (await projectFingerprint(input.revision.project) !== hash) throw new Error('Келісім мөрі: жоба хэші сәйкес емес')
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(input.fonts.regular, { subset: true })
  const bold = await doc.embedFont(input.fonts.bold, { subset: true })
  const page = doc.addPage([595, 842])
  const ink = rgb(0.12, 0.12, 0.14)
  const muted = rgb(0.4, 0.4, 0.45)
  const write = (value: string, y: number, size = 10, strong = false) =>
    page.drawText(value, { x: 42, y, size, font: strong ? bold : regular, color: strong ? ink : muted })
  write('Подтверждение проекта', 790, 18, true)
  write(`Проект: ${input.projectName}`, 755, 11, true)
  write(`Версия: ${version}`, 732)
  write(`SHA-256: ${seal.hash}`, 707, 7)
  write(`Цена: ${Math.floor(seal.priceMinor / 100)}.${String(seal.priceMinor % 100).padStart(2, '0')} тг`, 684, 11, true)
  write(`Время: ${new Date(seal.approvedAt).toISOString()}`, 660)
  write(`Код подтверждения: ${seal.confirmationCode}`, 636, 10, true)
  if (input.previewPng) {
    const png = await doc.embedPng(input.previewPng)
    const ratio = Math.min(510 / png.width, 470 / png.height)
    page.drawImage(png, { x: 42, y: 120, width: png.width * ratio, height: png.height * ratio })
  }
  return doc.save()
}
