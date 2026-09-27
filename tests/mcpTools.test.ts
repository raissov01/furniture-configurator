import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'aismebel-mcp-'))

let auth: typeof import('../lib/server/auth')
let service: typeof import('../scripts/mcp-tools')
let ownerA: import('../lib/server/auth').Account
let ownerB: import('../lib/server/auth').Account
let tokenA = ''

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  service = await import('../scripts/mcp-tools')
  const a = auth.register('mcp-a@example.kz', 'password123', 'Цех А')
  const b = auth.register('mcp-b@example.kz', 'password123', 'Цех Б')
  if (!a.ok || !b.ok) throw new Error('test accounts')
  ownerA = a.account
  ownerB = b.account
  tokenA = a.token
}, 30_000)

describe('MCP құралдары және цех шекарасы', () => {
  let projectId = ''
  it('мәтіннен ас үй жасайды, H × W × D миллиметрмен сақталады', async () => {
    const result = await service.runMcpTool(ownerA, 'create_project_from_text',
      { text: '4 метр түзу ас үй, мойка сол жақта, духовка кірістірілген' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    projectId = result.data.id as string
    expect(projectId).toBeTruthy()
    const project = await service.runMcpTool(ownerA, 'get_project', { projectId })
    expect(project.ok).toBe(true)
    if (project.ok) {
      const json = JSON.stringify(project.data)
      expect(json).toContain('kitchen')
      expect(json.toLowerCase()).toContain('мойк')
      expect(json).toContain('"appliance":"oven"')
      const loaded = project.data.project as import('../src/core/index').ProjectFileV4
      const first = loaded.root.children.find((node) => node.kind === 'cabinet')
      expect(first?.name.toLowerCase()).toContain('мойк')
    }
  })

  it('өз цехының тізімі және жобасы бар; өзге цехқа бірдей қате', async () => {
    const list = await service.runMcpTool(ownerA, 'list_projects', {})
    expect(list.ok && JSON.stringify(list.data).includes(projectId)).toBe(true)
    for (const name of ['get_project', 'get_quote', 'get_cut_list', 'compute_nesting', 'get_drilling', 'validate_config'] as const) {
      const denied = await service.runMcpTool(ownerB, name, { projectId })
      expect(denied).toEqual({ ok: false, error: 'Жоба табылмады' })
    }
    const otherList = await service.runMcpTool(ownerB, 'list_projects', {})
    expect(JSON.stringify(otherList)).not.toContain(projectId)
  })

  it('смета, деталировка, раскрой, присадка дайын ядродан келеді', async () => {
    const quote = await service.runMcpTool(ownerA, 'get_quote', { projectId })
    expect(quote.ok).toBe(true)
    if (quote.ok) expect(quote.data).toHaveProperty('total')
    const cut = await service.runMcpTool(ownerA, 'get_cut_list', { projectId })
    expect(cut.ok).toBe(true)
    if (cut.ok) expect(JSON.stringify(cut.data)).toContain('cutLength')
    const nesting = await service.runMcpTool(ownerA, 'compute_nesting', { projectId })
    expect(nesting.ok).toBe(true)
    if (nesting.ok) expect(nesting.data).toHaveProperty('sheetCount')
    const drilling = await service.runMcpTool(ownerA, 'get_drilling', { projectId })
    expect(drilling.ok).toBe(true)
    if (drilling.ok) expect(drilling.data).toHaveProperty('panels')
  })

  it('материал іздеуі тек өз профилін және тиыннан форматталған бағаны береді', async () => {
    const result = await service.runMcpTool(ownerA, 'search_materials', { query: 'ЛДСП' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(JSON.stringify(result.data)).toContain('₸')
    const { writeShopProfile } = await import('../lib/server/store')
    const { starterShopProfile } = await import('../src/core/index')
    const profile = starterShopProfile(ownerB.shopId)
    profile.materials[0] = { ...profile.materials[0]!, name: 'B-only material' }
    writeShopProfile(ownerB.shopId, profile)
    expect(JSON.stringify(await service.runMcpTool(ownerA, 'search_materials', { query: 'B-only' }))).not.toContain('B-only material')
    expect(JSON.stringify(await service.runMcpTool(ownerB, 'search_materials', { query: 'B-only' }))).toContain('B-only material')
  })

  it('конфигті тексеру параметр мен рұқсат аралығын қайтарады', async () => {
    const result = await service.runMcpTool(ownerA, 'validate_config', { projectId })
    expect(result).toMatchObject({ ok: true, data: { valid: true } })
    const bad = await service.runMcpTool(ownerA, 'validate_config', { brief: {
      name: 'Шкаф', rationale: 'Сынақ', height: 99, width: 600, depth: 450,
      construction: 'sidesOverlay', back: 'overlay', carcassMaterialId: 'ldsp16-w980',
      frontMaterialId: 'ldsp16-w980', backMaterialId: 'hdf3-white',
      sections: [{ widthMode: 'flex', width: null, shelfCount: 0, shelfKind: 'adjustable',
        drawerCount: 0, frontCount: 0, frontMount: 'overlay' }],
    } })
    expect(bad).toMatchObject({ ok: false, field: 'height', allowed: '100..4000' })
  })

  it('әр құралдың zod схемасы қате мәнді өткізбейді', async () => {
    for (const name of service.MCP_TOOL_NAMES) {
      const result = await service.runMcpTool(ownerA, name, { projectId: 42, query: 42, text: 42 })
      expect(result.ok).toBe(false)
    }
  })

  it('рөлі шектелген сессия ішкі баға мен жобаны оқымайды', async () => {
    const shop = { ...ownerA, role: 'shop' as const }
    expect((await service.runMcpTool(shop, 'get_quote', { projectId })).ok).toBe(false)
    expect((await service.runMcpTool(shop, 'get_project', { projectId })).ok).toBe(false)
  })

  it('bearer токен ғана қабылданады, мерзімі/қайтаруы тексеріледі', async () => {
    const { accountFromMcpAuthorization } = await import('../scripts/mcp-auth')
    expect(accountFromMcpAuthorization(`Bearer ${tokenA}`)?.shopId).toBe(ownerA.shopId)
    expect(accountFromMcpAuthorization(tokenA)).toBeNull()
    expect(accountFromMcpAuthorization(`Basic ${tokenA}`)).toBeNull()
    expect(accountFromMcpAuthorization(`Bearer ${'0'.repeat(64)}`)).toBeNull()
    const fresh = auth.login('mcp-a@example.kz', 'password123')
    if (!fresh.ok) throw new Error('login')
    auth.endSession(fresh.token)
    expect(accountFromMcpAuthorization(`Bearer ${fresh.token}`)).toBeNull()
  })

  it('ресми SDK тоғыз құралды JSON schema-мен жариялап, шақыруды өткізеді', async () => {
    const { createMcpServer } = await import('../scripts/mcp-register')
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = createMcpServer(ownerA)
    const client = new Client({ name: 'mcp-test', version: '1.0.0' })
    await server.connect(serverTransport)
    await client.connect(clientTransport)
    try {
      const listed = await client.listTools()
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...service.MCP_TOOL_NAMES].sort())
      expect(listed.tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true)
      const response = await client.callTool({ name: 'get_project', arguments: { projectId } })
      expect(JSON.stringify(response.content)).toContain(projectId)
      const invalid = await client.callTool({ name: 'get_project', arguments: { projectId: 123 } })
      expect(invalid.isError).toBe(true)
    } finally {
      await client.close()
      await server.close()
    }
  })
})
