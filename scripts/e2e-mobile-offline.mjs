/** Орнатылған «Тапсырыс»: 360 px, желі үзілгенде өлшем мен фото сақталады. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['MOBILE_E2E_CDP_PORT'] ?? 9451)
const profile = mkdtempSync(join(tmpdir(), 'furniture-mobile-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
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
      await send('Network.enable')
      return { ws, send }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP unavailable')
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await session.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true })
  await h.goto('/mobile', 5000)
  assert(await h.until('Boolean(navigator.serviceWorker?.controller)', 15000), 'service worker did not control mobile page')
  await h.goto('/mobile', 5000) // қызметтік жұмысшы HTML/чанктарды кэшке жазады
  await h.goto('/configurator', 6500)
  await h.goto('/configurator', 4500) // өндіріс өзегі мен 3D чанктарын кэшке түсіреді
  await h.goto('/mobile', 4000)
  assert(await h.evaluate("(() => { localStorage.setItem('tapsyrys:role','designer'); return true })()"), 'role seed failed')
  await session.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
  await session.send('Page.reload', { ignoreCache: true })
  assert(await h.until("document.body.innerText.includes('Новый замер')", 15000), 'mobile page did not reopen offline')
  assert(await h.evaluate('document.documentElement.scrollWidth <= innerWidth'), '360 px mobile page overflows')
  assert(await h.clickText('Новый замер'), 'offline measurement wizard missing')
  assert(await h.until("document.body.innerText.includes('Помещение и стены')", 5000), 'room step missing')
  for (const [label, value] of [
    ['Высота помещения', 2500], ['Северная стена', 3000], ['Восточная стена', 4000],
    ['Южная стена', 3000], ['Западная стена', 4000], ['Северо-западный', 90],
    ['Северо-восточный', 90], ['Юго-восточный', 90], ['Юго-западный', 90],
  ]) assert(await h.setNumberByLabel(label, value, 50), `${label} input missing`)
  assert(await h.clickText('К препятствиям'), 'obstacle step missing')
  assert(await h.until("document.body.innerText.includes('Розетка')", 5000), 'obstacle answers missing')
  assert(await h.clickText('Нет'), 'absent obstacle answer missing')
  assert(await h.evaluate(`(() => {
    const input = document.querySelector('fieldset input[type=file]')
    if (!input) return false
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='), x => x.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'wall.png', { type: 'image/png' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`), 'photo input missing')
  assert(await h.until("document.body.innerText.includes('Фото сохранено на этом устройстве')", 5000), 'offline photo was not stored')
  assert(await h.clickText('Назад'), 'wizard back missing')
  assert(await h.until("document.body.innerText.includes('Замеры на этом устройстве')", 5000), 'today screen missing after save')
  await session.send('Page.reload', { ignoreCache: true })
  assert(await h.until("document.body.innerText.includes('Замеры на этом устройстве')", 15000), 'offline survey did not reopen')
  const saved = await h.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open('tapsyrys-mobile')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(['surveys','photos'], 'readonly')
      const surveys = tx.objectStore('surveys').count()
      const photos = tx.objectStore('photos').count()
      tx.oncomplete = () => { resolve({ surveys: surveys.result, photos: photos.result }); db.close() }
      tx.onerror = () => reject(tx.error)
    }
  })`)
  assert(saved.surveys >= 1 && saved.photos >= 1, 'offline survey and photo did not survive reload')
  await h.goto('/configurator', 7000)
  assert((await h.cutListRows()).length >= 6, 'cut list did not regenerate offline')
  console.log('mobile offline e2e: PASS', saved)
} catch (error) {
  console.error('mobile offline e2e: FAIL', error)
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
  if (chrome.exitCode === null) { stop('SIGKILL'); await Promise.race([exited, wait(2000)]) }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
