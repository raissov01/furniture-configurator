/** Classic desktop: real 3D double-click → Properties → size → OK → cut list. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['P100_E2E_CDP_PORT'] ?? 9457)
const profile = mkdtempSync(join(tmpdir(), 'furniture-p100-e2e-'))
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

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await h.goto('/configurator', 7000)
  assert(await h.until("document.querySelector('[data-workspace-style]')?.getAttribute('data-workspace-style') === 'classic'", 15000), 'Classic must be default')
  await h.clickText('Пропустить', 100)
  assert(await h.clickText('+ корпус'), 'Cannot add cabinet')
  assert(await h.until("document.querySelector('#scene-3d canvas') && document.querySelector('[data-testid=p100-status]')", 20000), 'Classic scene missing')
  const { x, y } = await h.sceneCenter()
  for (let clickCount = 1; clickCount <= 2; clickCount += 1) {
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount })
    await wait(100)
  }
  assert(await h.until("Boolean(document.querySelector('[data-testid=properties-dialog]'))", 8000), 'Double-click did not open Properties')
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
