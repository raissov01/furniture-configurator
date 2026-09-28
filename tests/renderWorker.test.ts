import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobRow } from '../lib/server/jobs'

const storage = vi.hoisted(() => ({ put: vi.fn(async () => 'render/output-id'),
  get: vi.fn(async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), contentType: 'image/png' })) }))
const quota = vi.hoisted(() => ({ allow: vi.fn(() => true) }))
const render = vi.hoisted(() => ({ scene: vi.fn(async () => 'cG5n') }))
vi.mock('@/lib/server/objectStorage', () => ({ objectStorage: () => storage }))
vi.mock('../lib/server/objectStorage', () => ({ objectStorage: () => storage }))
vi.mock('../lib/server/rateLimit', () => ({ allowAiRequest: quota.allow }))
vi.mock('../lib/server/renderScene', () => ({ MAX_RENDER_BYTES: 8 * 1024 * 1024, renderScene: render.scene }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => null }))

const job: JobRow = { id: 'job-1', shop_id: 'shop-1', kind: 'render',
  payload_json: JSON.stringify({ key: 'photo/source-id', hint: 'Ашық ағаш', style: 'modern' }),
  state: 'running', attempts: 1, lease_token: 'lease', result_json: null, last_error: null }

describe('background image rendering', () => {
  beforeEach(() => {
    quota.allow.mockReset().mockReturnValue(true)
    render.scene.mockClear()
    storage.put.mockClear()
  })

  it('calls the server render service without a browser cookie and charges the shop quota', async () => {
    const { processJob } = await import('../scripts/worker')
    expect(await processJob(job)).toEqual({ key: 'render/output-id' })
    expect(quota.allow).toHaveBeenCalledWith('shop-1', 'render')
    expect(render.scene).toHaveBeenCalledWith(expect.any(Uint8Array), 'Ашық ағаш', 'modern')
    expect(storage.put).toHaveBeenCalledWith('shop-1', 'render', expect.any(Buffer), 'image/png')
  }, 30_000)

  it('does not call OpenAI when the shop quota is exhausted', async () => {
    quota.allow.mockReturnValue(false)
    const { processJob } = await import('../scripts/worker')
    await expect(processJob(job)).rejects.toThrow('лимиті')
    expect(render.scene).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
  }, 30_000)
})
