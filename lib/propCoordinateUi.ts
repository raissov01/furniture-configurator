/** Координаталар жоба схемасындағы integer mm түрінде сақталады. */
export function parsePropCoordinate(raw: string, axis: string):
  { ok: true; value: number } | { ok: false; error: string } {
  const allowed = `${axis}: допустимо целое число в диапазоне ${Number.MIN_SAFE_INTEGER}…${Number.MAX_SAFE_INTEGER} мм`
  if (!/^-?\d+$/.test(raw.trim())) return { ok: false, error: allowed }
  const value = Number(raw.trim())
  return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, error: allowed }
}
