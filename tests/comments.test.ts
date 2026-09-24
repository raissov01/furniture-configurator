import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-comments-'))
let auth: typeof import('../lib/server/auth')
let share: typeof import('../lib/server/share')
let comments: typeof import('../lib/server/comments')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  share = await import('../lib/server/share')
  comments = await import('../lib/server/comments')
})

describe('клиент пікірі', () => {
  it('жалпы және нысан пікірін цех бойынша сақтайды, дизайнер жауап береді', () => {
    const owner = auth.register('comments-owner@example.kz', 'password123', 'Цех')
    const other = auth.register('comments-other@example.kz', 'password123', 'Басқа цех')
    if (!owner.ok || !other.ok) throw new Error('registration failed')
    const code = share.createShare('{"name":"Үлгі"}', Date.now(), owner.account.shopId).code
    const general = comments.addClientComment(code, null, 'Жалпы пікір', 'Айша')
    const object = comments.addClientComment(code, 'cabinet-1', 'Есік түсі?', 'Айша')
    expect(general?.targetId).toBeNull()
    expect(general?.authorRole).toBe('client')
    expect(comments.listForShare(code).find((c) => c.id === general?.id)?.authorRole).toBe('client')
    expect(object?.targetId).toBe('cabinet-1')
    expect(comments.listForShop(other.account.shopId)).toEqual([])
    const reply = comments.addDesignerReply(code, object!.id, 'Ақ', owner.account.shopId, owner.account.userId)
    expect(reply?.replyTo).toBe(object?.id)
    expect(reply?.authorRole).toBe('designer')
    expect(comments.listForShare(code).find((c) => c.id === reply?.id)?.authorRole).toBe('designer')
    expect(comments.addDesignerReply(code, object!.id, 'Жоқ', other.account.shopId, other.account.userId)).toBeNull()
    expect(comments.listForShare(code)).toHaveLength(3)
    expect(comments.listForShop(owner.account.shopId)).toHaveLength(3)
  })

  it('мерзімі өткен кодқа пікір қабылдамайды', () => {
    const code = share.createShare('{}', Date.now() - share.SHARE_TTL_MS - 1).code
    expect(comments.addClientComment(code, null, 'Кеш', 'Айша')).toBeNull()
  })

  it('аноним share авторы құпия key арқылы жауап береді', () => {
    const created = share.createShare('{}')
    const client = comments.addClientComment(created.code, null, 'Сұрақ', 'Клиент')!
    expect(share.ownsShareKey(created.code, 'bad')).toBe(false)
    expect(share.ownsShareKey(created.code, created.key)).toBe(true)
    expect(comments.addCreatorReply(created.code, client.id, 'Жауап')?.authorRole).toBe('creator')
  })

  it('клиент өзін designer атаса да server role client, ескі пікір архивте', () => {
    const owner = auth.register('comments-archive@example.kz', 'password123', 'Архив')
    if (!owner.ok) throw new Error(owner.error)
    const code = share.createShare('{}', Date.now() - share.SHARE_TTL_MS + 1000, owner.account.shopId).code
    const comment = comments.addClientComment(code, null, 'Сақтаңыз', 'designer')
    expect(comment?.authorRole).toBe('client')
    share.createShare('{}', Date.now() + 2000)
    expect(comments.listForShop(owner.account.shopId).some((c) => c.id === comment?.id)).toBe(true)
  })
})
