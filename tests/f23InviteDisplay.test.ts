import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { inviteShopDisplay } from '../lib/accountPanelState'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-f23-invite-'))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))

let auth: typeof import('../lib/server/auth')
let team: typeof import('../lib/server/team')
let route: typeof import('../app/api/team/invite/route')
beforeAll(async () => {
  auth = await import('../lib/server/auth')
  team = await import('../lib/server/team')
  route = await import('../app/api/team/invite/route')
})

describe('F23 invite registration display', () => {
  it('shows the inviting shop as read-only and hides the new-shop field', () => {
    expect(inviteShopDisplay('token', 'Цех Алаш')).toEqual({ editable: false, name: 'Цех Алаш' })
    expect(inviteShopDisplay(null, null)).toEqual({ editable: true, name: null })
  })

  it('reads only the valid invite shop name', async () => {
    const owner = auth.register('invite-owner@example.kz', 'password123', 'Цех Алаш')
    if (!owner.ok) throw new Error(owner.error)
    const invite = team.createInvite(owner.account.shopId, owner.account.userId)
    const response = await route.GET(new Request(`http://localhost/api/team/invite?token=${invite.token}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ shopName: 'Цех Алаш' })
    expect((await route.GET(new Request('http://localhost/api/team/invite?token=bad'))).status).toBe(400)
  })
})
