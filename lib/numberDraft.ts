export type NumberDraftError = 'required' | 'integer' | 'number' | 'range'

/** Validate the typed text before it reaches the project model. Dimensions are whole mm. */
export function parseNumberDraft(raw: string, bounds: { min?: number | undefined; max?: number | undefined; integer?: boolean | undefined }):
  { value: number; error?: never } | { error: NumberDraftError; value?: never } {
  const text = raw.trim()
  if (!text) return { error: 'required' }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return { error: 'number' }
  const value = Number(text)
  if (bounds.integer !== false && !Number.isSafeInteger(value)) return { error: 'integer' }
  if (!Number.isFinite(value)) return { error: 'number' }
  if ((bounds.min !== undefined && value < bounds.min) || (bounds.max !== undefined && value > bounds.max)) return { error: 'range' }
  return { value }
}

export function steppedValue(value: number, direction: -1 | 1, step: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + direction * step))
}

export function stepAvailable(value: number, direction: -1 | 1, step: number, min?: number, max?: number): boolean {
  return steppedValue(value, direction, step, min, max) !== value
}

/** Keep errors per field so fixing one dimension cannot clear another. */
export function updateDraftErrors(errors: Readonly<Record<string, boolean>>, field: string, invalid: boolean): Record<string, boolean> {
  return errors[field] === invalid ? errors : { ...errors, [field]: invalid }
}

export function hasDraftErrors(errors: Readonly<Record<string, boolean>>): boolean {
  return Object.values(errors).some(Boolean)
}
