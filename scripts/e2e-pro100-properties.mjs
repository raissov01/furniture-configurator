/** Classic desktop: real 3D double-click → Properties → size → OK → cut list. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['P100_E2E_CDP_PORT'] ?? 9457)
const profile = mkdtempSync(join(tmpdir(), 'furniture-p100-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1920,1080', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
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
      await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
      return { ws, send }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP unavailable')
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await h.goto('/configurator', 7000)
  assert(await h.until("document.querySelector('[data-workspace-style]')?.getAttribute('data-workspace-style') === 'classic'", 15000), 'Classic must be default')
  await h.evaluate("[...document.querySelectorAll('[data-testid=template-gallery-dialog] button')].find((button) => button.textContent?.trim() === 'Закрыть')?.click()")
  assert(await h.until("!document.querySelector('[data-testid=template-gallery-dialog]')", 5000), 'Starter gallery stayed open')
  if (await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Пропустить')", 5000)) {
    await h.evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Пропустить')?.click()")
    assert(await h.until("![...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Пропустить')", 5000), 'Tour stayed open')
  }
  assert(await h.evaluate("Boolean(document.querySelector('[data-testid=classic-tool-new]')?.click() ?? document.querySelector('[data-testid=classic-tool-new]'))"), 'Cannot add cabinet by classic icon')
  assert(await h.evaluate("Boolean(document.querySelector('[data-testid=classic-tool-structure]')?.click() ?? document.querySelector('[data-testid=classic-tool-structure]'))"), 'Structure icon missing')
  assert(await h.until("Boolean(document.querySelector('[data-testid=classic-structure-window]'))", 5000), 'Structure window did not open')
  const floatTitle = await h.evaluate("(() => { const rect = document.querySelector('[data-testid=classic-structure-window] .p100-floating-title').getBoundingClientRect(); return { x: rect.x + 80, y: rect.y + 12, left: rect.x } })()")
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: floatTitle.x, y: floatTitle.y, button: 'left', clickCount: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: floatTitle.x + 100, y: floatTitle.y + 30, button: 'left', buttons: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: floatTitle.x + 100, y: floatTitle.y + 30, button: 'left', clickCount: 1 })
  assert(await h.evaluate(`document.querySelector('[data-testid=classic-structure-window]').getBoundingClientRect().left > ${floatTitle.left + 50}`), 'Structure window did not move')
  assert(await h.evaluate("Boolean(document.querySelector('[data-testid=classic-structure-window] .p100-floating-title button')?.click() ?? document.querySelector('[data-testid=classic-structure-window]'))"), 'Structure close missing')
  assert(await h.until("!document.querySelector('[data-testid=classic-structure-window]')", 5000), 'Structure window did not close')
  assert(await h.until("Boolean(document.querySelector('#scene-3d canvas') && document.querySelector('[data-testid=p100-status]'))", 20000), 'Classic scene missing')
  await writeFile('docs/pro100/layout-compare/ours-03d3-workspace.png', Buffer.from((await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'))
  const { x, y } = await h.sceneCenter()
  for (let clickCount = 1; clickCount <= 2; clickCount += 1) {
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount })
    await wait(100)
  }
  assert(await h.until("Boolean(document.querySelector('[data-testid=properties-dialog]'))", 8000), 'Double-click did not open Properties')
  await writeFile('docs/pro100/layout-compare/ours-03d3-properties.png', Buffer.from((await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'))
  const before = Number(await h.numberValue('Ширина (W)'))
  assert(Number.isInteger(before), 'Width input missing')
  const target = before + 100
  assert(await h.setNumberByLabel('Ширина (W)', target), 'Cannot edit width')
  assert(await h.clickText('OK'), 'Cannot confirm Properties')
  assert(await h.until("!document.querySelector('[data-testid=properties-dialog]')", 5000), 'Properties stayed open')
  assert(await h.waitForSavedCabinetWidth(target), 'Changed width was not saved')
  assert(await h.evaluate(`document.querySelector('[data-testid=p100-status]')?.textContent.includes('${target} (W)')`), 'Status did not update')
  const cutOpened = await h.evaluate("(() => { const root=document.querySelector('[data-tour=cutlist]'); const button=root?.querySelector('button'); if (!button) return false; button.click(); return true })()")
  assert(cutOpened, 'Cut list cannot open')
  assert(await h.until(`document.querySelector('[data-tour=cutlist]')?.textContent.includes('${target - 32}')`, 8000), 'Cut list did not reflect the new cabinet width')
  await h.evaluate("(() => { const input = document.querySelector('.p100-toolbar select[aria-label]'); if (!input) return false; input.value = 'ours'; input.dispatchEvent(new Event('change', { bubbles: true })); return true })()")
  assert(await h.until("document.querySelector('[data-workspace-style]')?.getAttribute('data-workspace-style') === 'ours'", 5000), 'Our layout did not restore')
  assert(await h.evaluate("Boolean(document.querySelector('.legacy-tools') && getComputedStyle(document.querySelector('.legacy-tools')).display !== 'none')"), 'Our controls stayed hidden')
  assert(await h.evaluate("!document.querySelector('[data-testid=classic-toolbar]')"), 'Classic controls stayed mounted in our layout')
  console.log('PRO100 Properties e2e: PASS')
} catch (error) {
  console.error('PRO100 Properties e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  const exited = chrome.exitCode === null ? new Promise((resolve) => chrome.once('exit', resolve)) : Promise.resolve()
  if (chrome.pid && chrome.exitCode === null) {
    try { process.kill(-chrome.pid, 'SIGTERM') } catch { chrome.kill('SIGTERM') }
  }
  await Promise.race([exited, wait(2000)])
  await rm(profile, { recursive: true, force: true })
}
