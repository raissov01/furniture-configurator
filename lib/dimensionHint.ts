/** UI range mirrors the cabinet validator's published 100..4000 mm envelope. */
export const CABINET_DIMENSION_MIN = 100
export const CABINET_DIMENSION_MAX = 4000

type Range = { min: number; max: number }

/** Template and shop intervals are guidance; the cabinet input has its own required range. */
export function dimensionRangeHint(template: Range | null, shopMin: number | null, shopMax: number | null): {
  recommended: string | null; shop: string | null; allowed: string
} {
  return {
    recommended: template ? `${template.min}–${template.max}` : null,
    shop: shopMin !== null || shopMax !== null ? `${shopMin ?? ''}–${shopMax ?? ''}` : null,
    allowed: `${CABINET_DIMENSION_MIN}–${CABINET_DIMENSION_MAX}`,
  }
}
