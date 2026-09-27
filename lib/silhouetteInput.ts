import { MAX_SILHOUETTE_HEIGHT, MIN_SILHOUETTE_HEIGHT } from '@/src/core/silhouette'
import { parseNumberDraft } from '@/lib/numberDraft'

/** Treat the text as a draft until it is a whole, in-range millimetre value. */
export function parseSilhouetteHeight(raw: string) {
  return parseNumberDraft(raw, {
    min: MIN_SILHOUETTE_HEIGHT,
    max: MAX_SILHOUETTE_HEIGHT,
    integer: true,
  })
}

export function validSilhouetteHeight(value: number): boolean {
  return Number.isSafeInteger(value)
    && value >= MIN_SILHOUETTE_HEIGHT
    && value <= MAX_SILHOUETTE_HEIGHT
}
