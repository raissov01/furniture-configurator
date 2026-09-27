/** Үш көрініс: токарлық, иілген және өзіміз жасаған 3DS. Бір Chrome, бір dev сервер. */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['SPECIAL_E2E_CDP_PORT'] ?? 9477)
const profile = mkdtempSync(join(tmpdir(), 'furniture-special-e2e-'))
const screenshots = process.env['SPECIAL_E2E_SCREENSHOTS'] ?? join(tmpdir(), 'furniture-special-screenshots')
mkdirSync(screenshots, { recursive: true })
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1440,900', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (value, message) => { if (!value) throw new Error(message) }

async function connect() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((tab) => tab.type === 'page')
      if (!page) throw new Error('page missing')
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
      let id = 0
      const pending = new Map()
      const errors = []
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((item) => item.value ?? item.description ?? '').join(' '))
        const callback = pending.get(message.id)
        if (callback) { pending.delete(message.id); callback(message) }
      }
      const send = (method, params = {}) => new Promise((resolve, reject) => {
        const key = ++id
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
        pending.set(key, (message) => {
          clearTimeout(timer)
          if (message.error) reject(new Error(`CDP ${method}: ${message.error.message}`))
          else resolve(message.result)
        })
        ws.send(JSON.stringify({ id: key, method, params }))
      })
      await send('Runtime.enable')
      await send('Page.enable')
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
      return { ws, send, errors }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP unavailable')
}

const example = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
const material = { ...example.materials[0], minBendRadiusMm: 50 }
const transform = { pos: { x: 700, y: 0, z: 700 }, rot: { x: 0, y: 0, z: 0 } }
const model = readFileSync(new URL('../tests/fixtures/3ds/own-tetra.3ds', import.meta.url)).toString('base64')
const parts = [
  { id: 'lathe', name: 'Токарная деталь', size: { x: 200, y: 1200, z: 200 }, fabrication: {
    kind: 'lathe', profile: [{ radius: 80, y: 0 }, { radius: 100, y: 80 }, { radius: 65, y: 300 },
      { radius: 95, y: 600 }, { radius: 60, y: 900 }, { radius: 85, y: 1200 }],
    materialId: material.id, quantity: 1, unitPrice: 10000,
  } },
  { id: 'bent', name: 'Гнутая деталь', size: { x: 1016, y: 1000, z: 150 }, fabrication: {
    kind: 'bent', chord: 1000, radius: 1000, height: 1000, thickness: 16, referenceFace: 'inner',
    materialId: material.id, quantity: 1, unitPrice: 10000,
  } },
  { id: '3ds', name: '3DS tetra', size: { x: 400, y: 800, z: 1200 }, importedModel: {
    format: '3ds', dataBase64: model, mmPerUnit: 400,
  } },
]

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  for (const part of parts) {
    const node = { kind: 'solid', id: part.id, name: part.name, transform,
      solid: { size: part.size, color: '#8b6b4d', ...(part.fabrication ? { fabrication: part.fabrication } : {}),
        ...(part.importedModel ? { importedModel: part.importedModel } : {}) } }
    const project = { schemaVersion: 4, name: `Special ${part.id}`,
      materials: [material, ...example.materials.slice(1)], edgeBands: example.edgeBands,
      room: { width: 2500, depth: 2500, height: 2500 },
      root: { kind: 'group', id: 'root', name: 'Special', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [node] },
    }
    const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(project))}); localStorage.setItem('furniture-configurator:workspace-style', 'ours')`,
    })
    await h.goto('/configurator', 7000)
    await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
    await h.evaluate("[...document.querySelectorAll('[data-testid=template-gallery-dialog] button')].find((button) => button.textContent?.trim() === 'Закрыть')?.click()")
    if (await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent.trim()==='Пропустить')", 1000)) {
      await h.clickText('Пропустить', 300)
    }
    assert(await h.until("Boolean(document.querySelector('#scene-3d canvas'))", 20000), `${part.id}: canvas missing`)
    await h.evaluate("(() => { const button=document.querySelector('[data-tour=cutlist] button'); if (button?.getAttribute('aria-expanded')==='false') button.click() })()")
    if (part.id !== '3ds') assert(await h.until(`Boolean(document.querySelector('[data-testid=${part.id}-cut-list]'))`, 5000), `${part.id}: cut section missing`)
    await wait(1600)
    const state = await h.evaluate("(() => { const c=document.querySelector('#scene-3d canvas'); return { pngLength:c?.toDataURL().length, alert:document.querySelector('[role=alert]')?.textContent } })()")
    assert(state.pngLength > 100000, `${part.id}: blank 3D ${JSON.stringify(state)}`)
    assert(!session.errors.length, `${part.id}: browser errors ${session.errors.join(' | ')}`)
    const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(screenshots, `${part.id}-3d.png`), Buffer.from(shot.data, 'base64'))
    console.log(`${part.id}: PASS (${state.pngLength} canvas chars)`)
  }
  const press = async (label) => h.evaluate(`(() => { const button=[...document.querySelectorAll('aside button')]
    .find((item) => item.textContent.trim() === ${JSON.stringify(label)}); if (!button) return false; button.click(); return true })()`)
  assert(await press('Токарная деталь'), 'lathe UI button missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.solid?.fabrication?.kind==='lathe')", 8000), 'lathe UI action failed')
  assert(await press('Гнутая деталь'), 'bent UI button missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.solid?.fabrication?.kind==='bent')", 8000), 'bent UI action failed')
  assert(await h.evaluate("(() => { const select=[...document.querySelectorAll('aside select')].find(item => item.value==='1' && [...item.options].some(o => o.value==='1000')); if (!select) return false; select.value='1000'; select.dispatchEvent(new Event('change',{bubbles:true})); return true })()"), '3D unit selector missing')
  await session.send('DOM.enable')
  const documentNode = await session.send('DOM.getDocument')
  const fileInput = await session.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[accept*=".3ds"]' })
  assert(fileInput.nodeId, '3DS/OBJ file input missing')
  await session.send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId,
    files: [join(process.cwd(), 'tests/fixtures/3ds/own-tetra.3ds')] })
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.solid?.importedModel?.format==='3ds' && n.solid.importedModel.mmPerUnit===1000)", 10000), '3DS UI import failed')
  const importedShot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(screenshots, '3ds-import-ui.png'), Buffer.from(importedShot.data, 'base64'))
  console.log('UI add/import: PASS')
  console.log(`special parts e2e: PASS; screenshots: ${screenshots}`)
} catch (error) {
  console.error('special parts e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  const exited = chrome.exitCode === null ? new Promise((resolve) => chrome.once('exit', resolve)) : Promise.resolve()
  if (chrome.pid && chrome.exitCode === null) {
    try { process.kill(-chrome.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  await Promise.race([exited, wait(3000)])
  if (chrome.exitCode === null && chrome.pid) process.kill(-chrome.pid, 'SIGKILL')
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
