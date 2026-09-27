import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ used: 0 as number | string, rows: 0 }))
vi.mock('../lib/server/db', () => ({ db: () => ({
  exec: vi.fn(),
  prepare: (sql: string) => ({
    get: () => ({ used: mock.used }),
    run: () => {
      if (sql.includes('INSERT INTO shop_catalog_imports')) {
        mock.rows += 1
        mock.used = Number(mock.used) + 10_000
      }
      return { changes: 1 }
    },
  }),
}) }))
import { saveShopCatalog } from '../lib/server/ownCatalog'

beforeEach(() => { mock.used = 0; mock.rows = 0 })

describe.each(['sqlite number', 'postgres numeric string'] as const)('%s', (mode) => {
  it('екі 10 000 байт файлды 30 000 000 байт квотаға сыйғызады', () => {
    saveShopCatalog('shop', 'pro100-ini', {}, 10_000, 'user')
    if (mode === 'postgres numeric string') mock.used = String(mock.used)
    expect(() => saveShopCatalog('shop', 'pro100-ini', {}, 10_000, 'user')).not.toThrow()
    expect(mock.rows).toBe(2)
  })
})
