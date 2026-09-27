import { db } from './db'

/** Бір цех сақтай алатын импорт суреттерінің жиынтық көлемі. */
export const SHOP_CATALOG_IMAGE_QUOTA_BYTES = 30_000_000

export function recordCatalogImage(shopId: string, importId: string, id: string,
  extension: 'png' | 'jpg' | 'webp', byteSize: number,
  quota = SHOP_CATALOG_IMAGE_QUOTA_BYTES): void {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const row = database.prepare('SELECT COALESCE(SUM(byte_size), 0) AS used FROM shop_catalog_images WHERE shop_id = ?')
      .get(shopId) as { used: number | string }
    if (Number(row.used) + byteSize > quota) throw new Error('Цех суреттерінің квотасы асып кетті')
    database.prepare(`INSERT INTO shop_catalog_images
      (id, shop_id, import_id, extension, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, shopId, importId, extension, byteSize, Date.now())
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

export function catalogImageForShop(shopId: string, id: string): { extension: 'png' | 'jpg' | 'webp' } | null {
  return (db().prepare('SELECT extension FROM shop_catalog_images WHERE shop_id = ? AND id = ?')
    .get(shopId, id) as { extension: 'png' | 'jpg' | 'webp' } | undefined) ?? null
}
