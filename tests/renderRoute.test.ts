/**
 * /api/render: пропорция, бөлме фотосы режимі, баға және тарих оқшаулауы.
 * OpenAI жалған: желіге шықпаймыз, тек провайдерге не жіберілгенін тексереміз.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-render-'))
process.env['OPENAI_API_KEY'] = 'test-key'

type Actor = { userId: string; email: string; shopId: string; shopName: string; role: 'owner' | 'designer' | 'shop' | 'client' }
const state = vi.hoisted(() => ({
  actor: null as Actor | null,
  calls: [] as { image: unknown; size: unknown; prompt: string }[],
}))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => state.actor }))
vi.mock('openai', () => ({
  default: class {
    images = {
      edit: async (params: { image: unknown; size: unknown; prompt: string }) => {
        state.calls.push(params)
        return {
          data: [{ b64_json: Buffer.from(`png-${state.calls.length}`).toString('base64') }],
          usage: { input_tokens: 1100, output_tokens: 4000, total_tokens: 5100,
            input_tokens_details: { text_tokens: 100, image_tokens: 1000 } },
        }
      },
    }
  },
}))

let auth: typeof import('../lib/server/auth')
let render: typeof import('../app/api/render/route')
let history: typeof import('../app/api/render/history/route')
let one: typeof import('../app/api/render/history/[id]/route')
let store: typeof import('../lib/server/renderHistory')
beforeAll(async () => {
  auth = await import('../lib/server/auth')
  render = await import('../app/api/render/route')
  history = await import('../app/api/render/history/route')
  one = await import('../app/api/render/history/[id]/route')
  store = await import('../lib/server/renderHistory')
})
beforeEach(() => {
  state.calls.length = 0
  delete process.env['RENDER_COST_TIYN_PER_IMAGE']
})

const image = 'data:image/png;base64,iVBORw0KGgo='
const room = 'data:image/jpeg;base64,/9j/4AAQ'
const post = (body: unknown) => render.POST(new Request('http://localhost/api/render', { method: 'POST', body: JSON.stringify(body) }))
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function account(email: string): Actor {
  const result = auth.register(email, 'password123', 'Цех')
  if (!result.ok) throw new Error(result.error)
  return result.account
}

describe('/api/render', () => {
  let actorNumber = 0
  beforeEach(() => { state.actor = account(`render-case-${++actorNumber}@example.kz`) })

  it('пропорция провайдер өлшеміне, промпт жоба материалынан', async () => {
    const response = await post({ image, aspect: '9:16', staging: ['wardrobe'], materials: [{ materialId: 'o',
      name: 'ЛДСП Дуб Бардолино H1145 16 мм', code: 'H1145', color: '#b98d57', surface: 'texture', finish: null, roles: ['front'] }] })
    expect(response.status).toBe(200)
    const body = await response.json() as { frame: { size: string; crop: { width: number } }; history: unknown; cost: unknown; usage: unknown }
    expect(body.frame).toMatchObject({ size: '1024x1536', crop: { width: 864 } })
    expect(state.calls[0]!.size).toBe('1024x1536')
    expect(state.calls[0]!.prompt).toContain('H1145')
    expect(state.calls[0]!.prompt).toContain('60–70% full')
    expect(state.calls[0]!.image).toBeInstanceOf(File)
    expect(body.usage).toEqual({ inputTextTokens: 100, inputImageTokens: 1000, outputTokens: 4000 })
    expect(body.cost).toBeNull()
    expect(body.history).toBeNull()
  })

  it('бөлме фотосы режимі: провайдерге ЕКІ сурет, промпт камера ережесімен', async () => {
    const response = await post({ image, referenceMode: 'cameraReference', reference: room })
    expect(response.status).toBe(200)
    const sent = state.calls[0]!.image as File[]
    expect(sent).toHaveLength(2)
    expect(sent[1]!.type).toBe('image/jpeg')
    expect(state.calls[0]!.prompt).toContain('Use image 2 ONLY')
  })

  it('жарамсыз дене — 400 және өріс аты, провайдер шақырылмайды', async () => {
    const missing = await post({ image, referenceMode: 'cameraReference' })
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ field: 'reference' })
    expect((await (await post({ image, aspect: '4:3' })).json() as { field: string }).field).toBe('aspect')
    expect((await (await post({ image: 'x' })).json() as { field: string }).field).toBe('image')
    expect(state.calls).toHaveLength(0)
  })

  it('екі суретті body шегінен асса ағынды парсингке дейін тоқтатады', async () => {
    let cancelled = false
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new Uint8Array(23 * 1024 * 1024))
        else controller.close()
      },
      cancel() { cancelled = true },
    }, { highWaterMark: 0 })
    const response = await render.POST(new Request('http://localhost/api/render', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit))
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ field: 'body' })
    expect(cancelled).toBe(true)
    expect(state.calls).toHaveLength(0)
  })

  it('баға баптаудан, тиынмен', async () => {
    process.env['RENDER_COST_TIYN_PER_IMAGE'] = '12000'
    expect((await (await post({ image })).json() as { cost: unknown }).cost).toEqual({ tiyn: 12000, basis: 'flat' })
  })

  it('аноним рендер сұрауын провайдерге жеткізбейді', async () => {
    state.actor = null
    expect((await post({ image })).status).toBe(401)
    expect(state.calls).toHaveLength(0)
  })
})

describe('рендер тарихы — пайдаланушы мен жоба бойынша оқшау', () => {
  it('тек иесі көреді, оқиды, өшіреді', async () => {
    const first = account('render-one@example.kz')
    const second = account('render-two@example.kz')
    state.actor = first
    const created = await (await post({ image, projectId: 'p-1', aspect: '16:9' })).json() as { history: { id: string; aspect: string; imageUrl: string } }
    expect(created.history).toMatchObject({ aspect: '16:9', imageUrl: `/api/render/history/${created.history.id}` })
    await post({ image, projectId: 'p-2' })

    const list = async (projectId: string) =>
      (await (await history.GET(new Request(`http://localhost/api/render/history?projectId=${projectId}`))).json() as { renders: { id: string }[] }).renders
    expect((await list('p-1')).map((r) => r.id)).toEqual([created.history.id])
    const png = await one.GET(new Request('http://localhost'), params(created.history.id))
    expect(png.headers.get('Content-Type')).toBe('image/png')
    expect(Buffer.from(await png.arrayBuffer()).toString()).toBe('png-1')

    state.actor = second
    expect(await list('p-1')).toEqual([])
    expect((await one.GET(new Request('http://localhost'), params(created.history.id))).status).toBe(404)
    expect((await one.DELETE(new Request('http://localhost'), params(created.history.id))).status).toBe(404)

    state.actor = first
    expect((await one.DELETE(new Request('http://localhost'), params(created.history.id))).status).toBe(200)
    expect(await list('p-1')).toEqual([])
    expect(await list('p-2')).toHaveLength(1)
  })

  it('сессиясыз тарих 401, projectId жоқ — 400', async () => {
    state.actor = null
    expect((await history.GET(new Request('http://localhost/api/render/history?projectId=p'))).status).toBe(401)
    state.actor = account('render-three@example.kz')
    const response = await history.GET(new Request('http://localhost/api/render/history'))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ field: 'projectId' })
  })

  it('бір жобада ең көбі MAX_RENDER_HISTORY жазба, ескілері өшеді', () => {
    const owner = account('render-limit@example.kz')
    const meta = { aspect: '1:1' as const, referenceMode: 'scene' as const, style: null, hint: null, model: 'm',
      promptVersion: 1, size: '1024x1024', crop: { x: 0, y: 0, width: 1024, height: 1024 }, usage: null, cost: null }
    const ids: string[] = []
    for (let i = 0; i < store.MAX_RENDER_HISTORY + 3; i += 1) ids.push(store.addRenderRecord(owner, 'p', meta, new Uint8Array([i]), 1000 + i).id)
    const kept = store.listRenderHistory(owner, 'p').map((r) => r.id)
    expect(kept).toHaveLength(store.MAX_RENDER_HISTORY)
    expect(kept[0]).toBe(ids.at(-1))
    expect(kept).not.toContain(ids[0])
  })
})
