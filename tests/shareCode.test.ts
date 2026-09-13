/**
 * Клиентке КОД (qdesign «3D-көріністе ашу» сияқты).
 *
 * Тексерілетіні: 6 таңбалы код, 24 сағаттан кейін ашылмайды, жобаны тек
 * кілті бар адам жаңартады, кодтың пішімі тексеріледі, кодтар қайталанбайды.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-share-'))

let share: typeof import('../lib/server/share')

beforeAll(async () => {
  share = await import('../lib/server/share')
})

const DAY = 24 * 60 * 60 * 1000

describe('клиентке код', () => {
  it('6 таңбалы код, 24 сағат, жоба өзгеріссіз оқылады', () => {
    const now = 1_800_000_000_000
    const s = share.createShare('{"a":1}', now)
    expect(s.code).toMatch(/^\d{6}$/)
    expect(s.key).toHaveLength(48)
    expect(s.expiresAt).toBe(now + DAY)
    const row = share.readShare(s.code, now + 1000)
    expect(row?.json).toBe('{"a":1}')
    expect(row?.updatedAt).toBe(now)
  })

  it('мерзімі өткен код ашылмайды әрі келесі жасауда тазаланады', () => {
    const now = 1_800_000_000_000
    const s = share.createShare('{"b":1}', now)
    expect(share.readShare(s.code, now + DAY)).toBeNull()
    share.createShare('{}', now + DAY + 1)
    expect(share.readShare(s.code, now + 1)).toBeNull()
  })

  it('жаңарту тек кодты жасағанның кілтімен', () => {
    const now = Date.now()
    const s = share.createShare('{"v":1}', now)
    expect(share.updateShare(s.code, 'бөтен-кілт', '{"v":2}', now + 10)).toBe(false)
    expect(share.readShare(s.code, now + 20)?.json).toBe('{"v":1}')
    expect(share.updateShare(s.code, s.key, '{"v":2}', now + 30)).toBe(true)
    const row = share.readShare(s.code, now + 40)
    expect(row?.json).toBe('{"v":2}')
    expect(row?.updatedAt).toBe(now + 30)
  })

  it('кодтың пішімі тексеріледі: бөтен жол базаға жетпейді', () => {
    expect(share.readShare("12345' OR 1=1")).toBeNull()
    expect(share.readShare('12345')).toBeNull()
    expect(share.updateShare('abcdef', 'x', '{}')).toBe(false)
  })

  it('қатар жасалған кодтар қайталанбайды', () => {
    const codes = new Set(Array.from({ length: 200 }, () => share.createShare('{}').code))
    expect(codes.size).toBe(200)
  })
})
