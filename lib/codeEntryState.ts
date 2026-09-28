import { z } from 'zod'

export const CODE_ENTRY_ERROR = 'Код: ровно 6 цифр'

/** Preserve the draft exactly; a pasted letter or decimal point is an error. */
export function codeEntryValidation(draft: string): { code: string | null; error: string | null } {
  return /^\d{6}$/.test(draft)
    ? { code: draft, error: null }
    : { code: null, error: CODE_ENTRY_ERROR }
}

const shopIdentity = z.object({
  name: z.string().trim().min(1),
  phone: z.string().optional(),
  logoDataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional(),
})

export type PublicShareIdentity = {
  name: string
  phone: string | null
  logoDataUrl: string | null
  whatsappUrl: string | null
}

/** Only public contact fields leave the shop profile. No prices or settings. */
export function publicShareIdentity(raw: unknown): PublicShareIdentity | null {
  const parsed = shopIdentity.safeParse(raw)
  if (!parsed.success) return null
  const { name, logoDataUrl } = parsed.data
  const phone = parsed.data.phone?.trim() || null
  const digits = phone?.replace(/\D/g, '') ?? ''
  return { name, phone, logoDataUrl: logoDataUrl ?? null,
    whatsappUrl: digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null }
}
