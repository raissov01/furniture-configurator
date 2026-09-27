/** Copy/Paste Properties and Scale in both Workspace modes. One owned Chrome process. */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['PROPERTY_SCALE_E2E_CDP_PORT'] ?? 9460)
const profile = mkdtempSync(join(tmpdir(), 'furniture-property-scale-e2e-'))
const screenshots = process.env['PROPERTY_SCALE_E2E_SCREENSHOTS'] ?? '/tmp/furniture-property-scale-screenshots'
mkdirSync(screenshots, { recursive: true })
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1500,1000', 'about:blank',
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
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
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
      return { ws, send }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP unavailable')
}

const source = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
const transform = { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }
const board = (id, x, length, materialId, banded) => ({
  kind: 'board', id, name: id, transform: { ...transform, pos: { x, y: 300, z: 1000 } },
  board: { materialId, length, width: 450, orientation: { length: 'x', width: 'y', thickness: 'z' },
    edges: { L1: banded ? { bandId: source.edgeBands[0].id } : null, L2: null, W1: null, W2: null },
    grainAlongLength: true, role: 'custom' },
})
const fixture = { schemaVersion: 4, name: 'Property Scale E2E', materials: source.materials,
  edgeBands: source.edgeBands, room: { width: 5000, depth: 3000, height: 2700 },
  root: { kind: 'group', id: 'root', name: 'Property Scale E2E', transform, children: [
    { kind: 'group', id: 'group-main', name: 'Group', transform, children: [
      board('board-a', 100, 600, source.materials[0].id, true),
      board('board-b', 1000, 400, source.materials[1].id, false),
      board('board-c', 1700, 300, source.materials[1].id, false),
    ] },
  ] },
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  const screenshot = async (name) => {
    const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(screenshots, name), Buffer.from(result.data, 'base64'))
  }
  let scope = '[data-testid=tree-dock]'
  const click = (selector) => h.evaluate(`(() => { const b=document.querySelector(${JSON.stringify(selector)}); if (!b || b.disabled) return false; b.click(); return true })()`)
  const clickInDock = (selector) => click(`${scope} ${selector}`)
  const select = (id, ctrl = false) => h.evaluate(`(() => { const row=document.querySelector(${JSON.stringify(`${scope} [data-panel=structure] [data-tree-node="${id}"]`)}); if (!row) return false; row.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:${ctrl}})); return true })()`)
  const saved = () => h.evaluate("JSON.parse(localStorage.getItem('furniture-configurator:project'))")
  const setPercent = (value) => h.evaluate(`(() => { const input=document.querySelector(${JSON.stringify(`${scope} [data-testid=scale-tools] input[type=number]`)}); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))}); input.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)

  for (const mode of ['classic', 'ours']) {
    // Inject on the next document: the outgoing Workspace may save on pagehide.
    const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('furniture-configurator:workspace-style', ${JSON.stringify(mode)}); localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(fixture))})`,
    })
    await h.goto('/configurator', 6000)
    await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
    assert(await h.until(`document.querySelector('[data-workspace-style]')?.dataset.workspaceStyle === '${mode}'`, 15000), `${mode}: style missing`)
    if (await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent.trim()==='Пропустить')", 3000)) {
      assert(await h.clickText('Пропустить', 300), `${mode}: tour skip failed`)
    }
    if (mode === 'classic') await click('[data-testid=classic-tool-structure-side]')
    scope = mode === 'classic' ? '[data-testid=classic-structure-window]' : '[data-testid=tree-dock]'
    assert(await h.until(`Boolean(document.querySelector(${JSON.stringify(`${scope} [data-panel=structure] [data-tree-node=board-a]`)}))`, 15000), `${mode}: tree missing`)
    assert(await select('board-a'), `${mode}: select source failed`)
    assert(await clickInDock('[data-testid=property-tools] label:nth-of-type(2) input[type=checkbox]'), `${mode}: edge group missing`)
    assert(await clickInDock('[data-testid=property-tools] label:nth-of-type(3) input[type=checkbox]'), `${mode}: dimension group missing`)
    assert(await clickInDock('[data-testid=copy-properties]'), `${mode}: copy disabled`)
    assert(await select('board-b'), `${mode}: select first target failed`)
    assert(await select('board-c', true), `${mode}: select second target failed`)
    assert(await h.until(`document.querySelector(${JSON.stringify(`${scope} [data-testid=paste-properties]`)})?.disabled === false`, 5000), `${mode}: paste disabled`)
    assert(await clickInDock('[data-testid=paste-properties]'), `${mode}: paste click failed`)
    assert(await h.until("(() => { const p=JSON.parse(localStorage.getItem('furniture-configurator:project')); const xs=p.root.children[0].children; return xs.slice(1).every(n=>n.board.length===600 && n.board.materialId===xs[0].board.materialId && n.board.edges.L1?.bandId===xs[0].board.edges.L1?.bandId) })()", 15000), `${mode}: multi paste did not persist`)
    await screenshot(`${mode}-properties.png`)

    assert(await select('group-main'), `${mode}: select group failed`)
    assert(await setPercent(125), `${mode}: scale input missing`)
    assert(await clickInDock('[data-testid=scale-node]'), `${mode}: scale disabled`)
    assert(await h.until("(() => { const g=JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children[0]; return g.children.every(n=>n.board.length===750) && g.children[1].transform.pos.x===1250 })()", 15000), `${mode}: group scale did not persist`)
    const project = await saved()
    assert(project.root.children[0].children[2].transform.pos.x === 2125, `${mode}: third board position drifted`)
    await screenshot(`${mode}-scale.png`)
  }
  console.log(`property/scale e2e: PASS; screenshots: ${screenshots}`)
} catch (error) {
  console.error('property/scale e2e: FAIL', error)
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
  await Promise.race([exited, wait(2000)])
  if (chrome.exitCode === null) stop('SIGKILL')
  await rm(profile, { recursive: true, force: true })
}
