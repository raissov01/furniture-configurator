import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import {
  canonicalJson, createApprovalRevision, approveRevision, reviseApproval,
  projectFingerprint,
} from '../src/core/approval'
import { approvalStampPdf } from '../src/core/export/approvalPdf'

const project = { schemaVersion: 4, name: 'Шкаф', root: { id: 'r', children: [] } }

describe('келісім мөрі', () => {
  it('JSON кілттерінің реті хэшке әсер етпейді, мәннің өзгеруі әсер етеді', async () => {
    expect(canonicalJson({ b: 2, a: { z: 1, c: 3 } }))
      .toBe('{"a":{"c":3,"z":1},"b":2}')
    const a = await projectFingerprint(project)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(await projectFingerprint({ root: { children: [], id: 'r' }, name: 'Шкаф', schemaVersion: 4 })).toBe(a)
    expect(await projectFingerprint({ ...project, name: 'Басқа' })).not.toBe(a)
  })

  it('мақұлданған снимок өзгермейді; жаңа жоба жаңа нұсқа және қайта келісуді талап етеді', async () => {
    const first = await createApprovalRevision(project, 12500000, 1000)
    const sealed = approveRevision(first, '482931', 2000)
    expect(sealed.version).toBe(1)
    expect(sealed.seal).toEqual({ hash: first.hash, priceMinor: 12500000, approvedAt: 2000, confirmationCode: '482931' })
    expect(() => { sealed.project.name = 'Бөтен' }).toThrow()
    const second = await reviseApproval(sealed, { ...project, name: 'Жаңа' }, 12600000, 3000)
    expect(second.version).toBe(2)
    expect(second.seal).toBeNull()
    expect(sealed.project).toEqual(project)
    expect(sealed.seal?.hash).toBe(first.hash)
    await expect(reviseApproval(sealed, project, 12500000, 3000)).rejects.toThrow(/өзгер/)
  })

  it('баға, уақыт, код қатаң тексеріледі', async () => {
    await expect(createApprovalRevision(project, 12.5, 1000)).rejects.toThrow(/priceMinor/)
    await expect(createApprovalRevision(project, -1, 1000)).rejects.toThrow(/priceMinor/)
    const pending = await createApprovalRevision(project, 100, 1000)
    expect(() => approveRevision(pending, '12345', 2000)).toThrow(/confirmationCode/)
    expect(() => approveRevision(pending, '123456', 999)).toThrow(/approvedAt/)
  })

  it('бекітілген хэш, баға, уақыт пен код PDF-ке түседі', async () => {
    const revision = approveRevision(await createApprovalRevision(project, 12500000, 1000), '482931', 2000)
    const font = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))
    const bytes = await approvalStampPdf({ revision, projectName: 'Шкаф',
      fonts: { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') } })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
    const with3d = await approvalStampPdf({ revision, projectName: 'Шкаф',
      fonts: { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') },
      previewPng: new Uint8Array(readFileSync(fileURLToPath(new URL('../public/icon-192.png', import.meta.url)))) })
    expect(with3d.length).toBeGreaterThan(bytes.length)
    await expect(approvalStampPdf({ revision: { ...revision, project: { ...project, name: 'Бөтен' } },
      projectName: 'Шкаф', fonts: { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') } }))
      .rejects.toThrow(/сәйкес емес/)
    await expect(approvalStampPdf({ revision: { ...revision, seal: null }, projectName: 'Шкаф',
      fonts: { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') } }))
      .rejects.toThrow(/мақұл/)
  })
})
