import { randomUUID } from 'node:crypto'
import { db } from './db'

export type ShopCatalogFormat = 'basis-xlsx' | 'pro100-ini'
export type ShopCatalogImport = {
  id: string; format: ShopCatalogFormat; data: unknown; byteSize: number
  uploadedBy: string; rightsConfirmedAt: number; createdAt: number
}
/** Цехтың өзі жүктеген бастапқы файлдардың жиынтық өлшемі. */
export const SHOP_CATALOG_QUOTA_BYTES = 30_000_000

export function listShopCatalog(shopId: string): ShopCatalogImport[] {
  const rows = db().prepare(`SELECT id, format, json, byte_size, uploaded_by, rights_confirmed_at, created_at
    FROM shop_catalog_imports WHERE shop_id = ? ORDER BY created_at DESC, id`).all(shopId) as Array<{
    id: string; format: ShopCatalogFormat; json: string; byte_size: number; uploaded_by: string
    rights_confirmed_at: number; created_at: number
  }>
  return rows.map((row) => ({ id: row.id, format: row.format, data: JSON.parse(row.json) as unknown,
    byteSize: row.byte_size, uploadedBy: row.uploaded_by, rightsConfirmedAt: row.rights_confirmed_at,
    createdAt: row.created_at }))
}

export function saveShopCatalog(shopId: string, format: ShopCatalogFormat, data: unknown,
  byteSize: number, userId: string, quota = SHOP_CATALOG_QUOTA_BYTES): string {
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) throw new Error('Файл өлшемі жарамсыз')
  const json = JSON.stringify(data)
  // XLSX қысылғандықтан, нормаланған JSON көлемі түпнұсқадан үлкен болуы мүмкін.
  const chargedBytes = Math.max(byteSize, Buffer.byteLength(json, 'utf8'))
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const used = database.prepare('SELECT COALESCE(SUM(byte_size), 0) AS used FROM shop_catalog_imports WHERE shop_id = ?')
      .get(shopId) as { used: number | string }
    const usedBytes = Number(used.used)
    if (!Number.isSafeInteger(usedBytes) || usedBytes < 0) throw new Error('Цех каталогының көлемі жарамсыз')
    if (usedBytes + chargedBytes > quota) throw new Error('Цех каталогының квотасы асып кетті')
    const id = randomUUID(), now = Date.now()
    database.prepare(`INSERT INTO shop_catalog_imports
      (id, shop_id, uploaded_by, format, json, byte_size, rights_confirmed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, shopId, userId, format, json, chargedBytes, now, now)
    database.exec('COMMIT')
    return id
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function deleteShopCatalog(shopId: string, id: string): boolean {
  return Number(db().prepare('DELETE FROM shop_catalog_imports WHERE shop_id = ? AND id = ?').run(shopId, id).changes) > 0
}
