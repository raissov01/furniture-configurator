/** Өндіруші активтерінің құқық метадерегі. Файлдар каталогта сақталмайды. */
import { z } from 'zod'
import { decorKey } from './data/catalog/decorKey'

const httpsUrl = z.url().refine((value) => new URL(value).protocol === 'https:', 'HTTPS URL қажет')
const label = z.string().trim().min(1)

/** Суретті SaaS-та көрсетуге жазбаша рұқсат тіркелген жағдайда ғана URL қолжетімді. */
export const TextureGrantSchema = z.strictObject({
  manufacturer: label,
  decorCode: label,
  structureCode: label.nullable(),
  imageUrl: httpsUrl,
  licenseUrl: httpsUrl,
  licenseId: label,
  attribution: label,
  permission: z.literal('saas-display'),
})
export type TextureGrant = z.infer<typeof TextureGrantSchema>

export const TextureSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('manufacturer-page'), pageUrl: httpsUrl,
    licenseStatus: z.literal('unverified') }),
  z.strictObject({ kind: z.literal('licensed-image'), imageUrl: httpsUrl,
    licenseUrl: httpsUrl, licenseId: label, attribution: label,
    permission: z.literal('saas-display') }),
])
export type TextureSource = z.infer<typeof TextureSourceSchema>

/** Фурнитураны solid түйінге байланыстыратын сыртқы дереккөз. */
export const ManufacturerModelSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('manufacturer-page'), manufacturer: label,
    article: label, pageUrl: httpsUrl, licenseStatus: z.literal('unverified') }),
  z.strictObject({ kind: z.literal('licensed-model'), manufacturer: label,
    article: label, modelUrl: httpsUrl, format: z.enum(['glb', 'obj', 'step', 'dxf', 'other']),
    licenseUrl: httpsUrl, licenseId: label, attribution: label,
    permission: z.literal('saas-display') }),
])
export type ManufacturerModelSource = z.infer<typeof ManufacturerModelSourceSchema>

/** Қазір бірде-бір өндірушінің көп клиентті SaaS-қа сурет тарату гранты расталмады. */
export const MANUFACTURER_TEXTURE_GRANTS: readonly TextureGrant[] = []

const officialHosts: Readonly<Record<string, string>> = {
  egger: 'www.egger.com',
  lamarty: 'www.lamarty.ru',
  ultradecor: 'ultradecor.com',
  'swiss krono': 'swisskrono.ru',
  увадрев: 'www.uvadrev.ru',
}

export function validateTextureGrants(grants: readonly unknown[]): string[] {
  const issues: string[] = []
  const keys = new Set<string>()
  grants.forEach((raw, index) => {
    const parsed = TextureGrantSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push(...parsed.error.issues.map((issue) => `grants[${index}].${issue.path.join('.')}: ${issue.message}`))
      return
    }
    const grant = parsed.data
    const key = decorKey(grant.manufacturer, grant.decorCode, grant.structureCode)
    if (keys.has(key)) issues.push(`grants[${index}].decorCode: қайталанған декор ${key}`)
    keys.add(key)
    const host = officialHosts[grant.manufacturer.toLowerCase()]
    if (host === undefined || new URL(grant.imageUrl).hostname !== host) {
      issues.push(`grants[${index}].imageUrl: өндірушінің ресми домені қажет`)
    }
  })
  return issues
}

/** Декор коды мен бет құрылымы дәл сәйкес келуі керек; жуық сәйкестік суретті шатастырады. */
export function resolveTextureSource(
  manufacturer: string, decorCode: string, structureCode: string | null,
  pageUrl: string, grants: readonly TextureGrant[] = MANUFACTURER_TEXTURE_GRANTS,
): TextureSource {
  const issues = validateTextureGrants(grants)
  if (issues.length > 0) throw new Error(`Текстура лицензиясы жарамсыз: ${issues.join('; ')}`)
  const key = decorKey(manufacturer, decorCode, structureCode)
  const grant = grants.find((item) => decorKey(item.manufacturer, item.decorCode, item.structureCode) === key)
  if (grant) return {
    kind: 'licensed-image', imageUrl: grant.imageUrl, licenseUrl: grant.licenseUrl,
    licenseId: grant.licenseId, attribution: grant.attribution, permission: grant.permission,
  }
  try {
    const url = new URL(pageUrl)
    const host = officialHosts[manufacturer.toLowerCase()]
    if (url.protocol === 'https:' && host !== undefined && url.hostname === host) {
      return { kind: 'manufacturer-page', pageUrl, licenseStatus: 'unverified' }
    }
  } catch {
    // Жарамсыз не бөтен URL активке айналмайды.
  }
  return { kind: 'none' }
}
