/** Capacitor's shared measurement UI in a browser with a mocked D5 keyboard reading. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:4173'
const port = Number(process.env['NATIVE_E2E_CDP_PORT'] ?? 9452)
const profile = mkdtempSync(join(tmpdir(), 'aismebel-native-e2e-'))
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
      return { ws, send }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP unavailable')
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await h.goto('/', 5000)
  assert(await h.until("document.body.innerText.includes('Новый замер')", 5000), 'native measurement list missing')
  assert(await h.clickText('Новый замер', 200), 'new survey did not open')
  assert(await h.until("document.body.innerText.includes('Leica DISTO D5')", 5000), 'D5 capture missing')
  const setReading = (value) => h.evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((item) => item.textContent.includes('Строка с D5'))
    const input = label?.querySelector('input[type=text]')
    if (!input) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  assert(await setReading('1.234m'), 'D5 input missing')
  assert(await h.clickText('Применить измерение', 300), 'D5 apply button missing')
  assert(await h.until("[...document.querySelectorAll('label')].some((item) => item.textContent.includes('Высота помещения') && item.querySelector('input[type=number]')?.value === '1234')", 5000), 'D5 integer mm missing')
  assert((await h.text()).includes('Источник: Лазер'), 'laser provenance missing')
  assert(await setReading('1.234'), 'D5 invalid input missing')
  assert(await h.clickText('Применить измерение', 300), 'D5 validation button missing')
  assert((await h.text()).includes('Text Mode'), `invalid D5 packet accepted: ${(await h.text()).slice(0, 900)}`)
  assert(await h.clickText('Назад', 300), 'wizard back missing')
  assert(await h.until("document.body.innerText.includes('Замеры на этом устройстве')", 5000), 'survey list missing')
  await session.send('Page.reload', { ignoreCache: true })
  assert(await h.until("document.body.innerText.includes('Замеры на этом устройстве')", 5000), 'survey list lost on reload')
  assert(await h.evaluate("[...document.querySelectorAll('button')].some((item) => item.textContent.includes('·'))"), 'saved survey missing after reload')
  console.log('native measurement e2e: PASS')
} catch (error) {
  console.error('native measurement e2e: FAIL', error)
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
