export type PartQr = { projectId: string; panelId: string; version: number }
const QR_PATTERN = /^F1\.[A-Za-z0-9_-]{4,400}$/

/** Compact QR payload that can be read without a server connection. */
export function encodePartQr(part: PartQr): string {
  if (!part.projectId || part.projectId.length > 80 || !part.panelId || part.panelId.length > 120 ||
    !Number.isSafeInteger(part.version) || part.version < 1) {
    throw new Error('QR: projectId, panelId және оң бүтін version қажет')
  }
  const bytes = new TextEncoder().encode(JSON.stringify([part.projectId, part.panelId, part.version]))
  const value = `F1.${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
  if (!QR_PATTERN.test(value)) throw new Error('QR: projectId пен panelId тым ұзын')
  return value
}

export function decodePartQr(value: string): PartQr {
  if (!QR_PATTERN.test(value)) throw new Error('QR: белгісіз пішім')
  let parsed: unknown
  try {
    const bytes = Uint8Array.from(atob(value.slice(3).replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0))
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch {
    throw new Error('QR: бүлінген дерек')
  }
  if (!Array.isArray(parsed) || parsed.length !== 3 || typeof parsed[0] !== 'string' ||
    typeof parsed[1] !== 'string' || typeof parsed[2] !== 'number') throw new Error('QR: бүлінген дерек')
  const part = { projectId: parsed[0], panelId: parsed[1], version: parsed[2] }
  if (encodePartQr(part) !== value) throw new Error('QR: бүлінген дерек')
  return part
}
