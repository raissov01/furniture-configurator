/**
 * Платформаның атауы — AisMebel (иесінің шешімі, 2026-09-26).
 *
 * Ескі жұмыс атаулары («РЕЗ», «Тапсырыс», «Конфигуратор корпусной мебели…»)
 * қосымшаның АТАУЫ ретінде қайта шықпауы керек. «Тапсырыс» order мағынасында,
 * «РЕЗ» өлшем бағаны ретінде ҚАЛАДЫ — сондықтан тек атау тұратын жерлер тексеріледі.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { BRAND } from '../src/core/brand'
import { SITE } from '../lib/site'
import {
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  nestPanels,
  priceProject,
  quotePdf,
  templateToCabinet,
} from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const OLD = [/Конфигуратор корпусной мебели/, /Тапсырыс —/, /"Тапсырыс"/]

describe('AisMebel атауы', () => {
  it('манифест: атауы, қысқа атауы, түсі', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, unknown>
    expect(manifest.name).toBe('AisMebel — мебель цехтарына')
    expect(manifest.short_name).toBe('AisMebel')
    expect(manifest.theme_color).toBe('#1F2A37')
    const raw = read('public/manifest.webmanifest')
    for (const old of OLD) expect(raw).not.toMatch(old)
  })

  it('metadata бренд модулінен алынады, ескі атау жоқ', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toMatch(/from '@\/src\/core\/brand'/)
    expect(layout).toMatch(/appleWebApp: \{[^}]*title: BRAND\.name/)
    expect(layout).toMatch(/template: `%s · \$\{BRAND\.name\}`/)
    for (const old of OLD) expect(layout).not.toMatch(old)
    expect(BRAND.name).toBe('AisMebel')
    expect(BRAND.fullName).toBe('AisMebel — мебель цехтарына')
  })

  it('сайт, жоғарғы жолақ пен телефон AisMebel белгісін көрсетеді', () => {
    expect(SITE.name).toBe('AisMebel')
    const workspace = read('components/Workspace.tsx')
    expect(workspace).toContain('/brand/aismebel-mark.svg')
    expect(workspace).not.toMatch(/^\s*РЕЗ\s*$/m)
    expect(read('app/mobile/page.tsx')).toContain('BRAND.name')
    expect(read('components/site/SiteFooter.tsx')).not.toMatch(OLD[0]!)
  })

  it('интерфейс мәтінінде PRO100 бренд ретінде жоқ (Configurator)', () => {
    expect(read('components/Configurator.tsx')).not.toMatch(/tr\('[^']*чего нет в PRO100/)
  })

  it('КП PDF-і AisMebel деп белгіленеді', async () => {
    const font = (name: string) => new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts', name)))
    const base = defaultShopProfile()
    const catalog = { materials: base.materials, edgeBands: base.edgeBands }
    const panels = generateCabinet(templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog), catalog)
    const shop: ShopProfile = {
      ...base,
      materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
      edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
      hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 6000 })),
      labour: { perSquareMetre: 150000, perHole: 3000, perEdgeMetre: 5000 },
    }
    const bytes = await quotePdf({
      price: priceProject(panels, nestPanels(panels, catalog), shop),
      shop, projectName: 'Шкаф', date: '26.09.2026',
      fonts: { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') },
    })
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(doc.getCreator()).toBe('AisMebel')
    expect(doc.getProducer()).toBe('AisMebel')
  })

  it('Базис скриптінің бастамасы AisMebel, ескі атау жоқ', () => {
    const src = read('src/core/export/basisScript.ts')
    expect(src).toContain("'// Базиске импорт скрипті — AisMebel'")
    expect(src).not.toContain('Импорт из конфигуратора')
  })
})
