/** Annotation browser check. Run against one integrated dev server; this owns one Chrome process. */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['ANNOTATIONS_E2E_CDP_PORT'] ?? 9451)
const profile = mkdtempSync(join(tmpdir(), 'furniture-annotation-e2e-'))
const screenshots = process.env['ANNOTATIONS_E2E_SCREENSHOTS'] ?? join(tmpdir(), 'furniture-annotation-screenshots')
mkdirSync(screenshots, { recursive: true })
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (value, message) => { if (!value) throw new Error(message) }

async function connect() {
  let lastError
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((tab) => tab.type === 'page')
      if (!page) throw new Error('page missing')
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
      let id = 0
      const pending = new Map()
      const browserErrors = []
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') browserErrors.push(message.params.args.map((item) => item.value ?? item.description ?? '').join(' '))
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
      return { ws, send, browserErrors }
    } catch (error) { lastError = error; await wait(500) }
  }
  throw new Error('Chrome CDP unavailable', { cause: lastError })
}

const source = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
const transform = { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }
const fixture = {
  schemaVersion: 4, name: 'Annotation E2E', materials: source.materials, edgeBands: source.edgeBands,
  room: { width: 4000, depth: 3000, height: 2700 },
  root: { kind: 'group', id: 'root', name: 'Annotation E2E', transform, children: [{
    kind: 'board', id: 'fixture-board', name: 'Өндірістік тақта', transform,
    board: { materialId: source.materials[0].id, length: 600, width: 400,
      orientation: { length: 'x', width: 'y', thickness: 'z' },
      edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: true, role: 'custom' },
  }] },
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(fixture))}); localStorage.setItem('furniture-configurator:workspace-style', 'classic')`,
  })
  await h.goto('/configurator', 7000)
  await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
  if (await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent.trim()==='Пропустить')", 3000)) {
    assert(await h.clickText('Пропустить', 300), 'tour skip failed')
  }
  assert(await h.until("Boolean(document.querySelector('[data-workspace-style=classic]') && document.querySelector('canvas'))", 20000), 'classic 3D missing')
  const before = await h.cutListRows()
  assert(before.length > 0, 'fixture cut list missing')
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-testid=classic-tool-annotation-side]'); if (!b) return false; b.click(); return true })()"), 'classic add text missing')
  assert(await h.until("Boolean(document.querySelector('[data-testid=annotation-properties]'))", 10000), 'annotation editor missing')
  assert(await h.evaluate(`(() => {
    const area=document.querySelector('[data-testid=annotation-properties] textarea')
    if (!area) return false
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'Розетка орны')
    area.dispatchEvent(new Event('input',{bubbles:true}))
    return true
  })()`), 'annotation input missing')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=annotation-properties] button')].find(x=>x.textContent.trim()==='Применить'); if (!b) return false; b.click(); return true })()"), 'save annotation button missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.kind==='annotation' && n.annotation.text==='Розетка орны')", 10000), 'annotation did not persist')
  const after = await h.cutListRows()
  assert(JSON.stringify(after) === JSON.stringify(before), 'annotation entered manufacturing cut list')
  await wait(4000)
  const shot3d = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(screenshots, 'annotation-3d.png'), Buffer.from(shot3d.data, 'base64'))
  const canvasState = await h.evaluate("(() => { const c=document.querySelector('canvas'); return { count:document.querySelectorAll('canvas').length, width:c?.width, height:c?.height, dataLength:c?.toDataURL().length, fallback:document.querySelector('[role=alert]')?.textContent } })()")
  assert(canvasState?.dataLength > 100000,
    `annotation 3D canvas blank: ${JSON.stringify({ canvasState, errors: session.browserErrors.slice(-5) })}`)

  assert(await h.evaluate("(() => { const b=document.querySelector('[data-testid=classic-tool-room]'); if (!b) return false; b.click(); return true })()"), 'room plan action missing')
  assert(await h.until("document.querySelector('[data-testid=room-plan-annotation]')?.textContent==='Розетка орны'", 10000), 'room plan annotation missing')
  const shotPlan = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(screenshots, 'annotation-plan.png'), Buffer.from(shotPlan.data, 'base64'))
  assert(await h.clickText('Закрыть'), 'room plan close missing')
  await h.goto('/configurator', 5000)
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.kind==='annotation' && n.annotation.text==='Розетка орны')", 10000), 'annotation disappeared on reload')
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-testid=classic-tool-structure]'); if (!b) return false; b.click(); return true })()"), 'classic structure action missing')
  assert(await h.until("Boolean(document.querySelector('[data-tree-node]'))", 5000), 'classic structure tree missing')
  assert(await h.evaluate("(() => { const p=JSON.parse(localStorage.getItem('furniture-configurator:project')); const id=p.root.children.find(n=>n.kind==='annotation')?.id; const row=id && document.querySelector(`[data-tree-node='${id}']`); if (!row) return false; row.click(); return true })()"), 'reloaded annotation tree row missing')
  assert(await h.until("Boolean(document.querySelector('[data-testid=annotation-properties]'))", 5000), 'reloaded annotation selection missing')
  assert(await h.evaluate("document.querySelector('[data-testid=annotation-properties]')?.querySelector('textarea')?.value==='Розетка орны'"), 'reloaded annotation editor missing')
  await h.evaluate("document.querySelector('[data-testid=classic-structure-window] button[aria-label=\"Закрыть\"]')?.click()")
  // The classic toolbar adds a second annotation after the saved one is reloaded.
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-testid=classic-tool-annotation]'); if (!b) return false; b.click(); return true })()"), 'classic add text missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.filter(n=>n.kind==='annotation').length===2", 10000), 'classic annotation did not persist')
  assert(JSON.stringify(await h.cutListRows()) === JSON.stringify(before), 'classic text entered manufacturing cut list')
  await wait(1200)
  assert(await h.evaluate("document.querySelector('canvas')?.toDataURL().length > 100000"), 'classic 3D canvas blank')
  const shotOurs = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(screenshots, 'annotation-classic.png'), Buffer.from(shotOurs.data, 'base64'))
  console.log(`annotation e2e: PASS; screenshots: ${screenshots}`)
} catch (error) {
  console.error('annotation e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  const exited = chrome.exitCode === null ? new Promise((resolve) => chrome.once('exit', resolve)) : Promise.resolve()
  const stop = (signal) => {
    if (!chrome.pid) return
    try { process.kill(-chrome.pid, signal) }
    catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  stop('SIGTERM')
  await Promise.race([exited, wait(5000)])
  if (chrome.exitCode === null) {
    stop('SIGKILL')
    await Promise.race([exited, wait(2000)])
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
