/** Каталог іздеуі, ішкі санат және телефон еніндегі көрініс. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['TEMPLATE_E2E_CDP_PORT'] ?? 9447)
const profile = mkdtempSync(join(tmpdir(), 'furniture-template-e2e-'))
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
  await h.goto('/configurator', 6500)
  assert(await h.menu('Создать', 'Готовые шаблоны'), 'template gallery could not open')
  assert(await h.until("Boolean(document.querySelector('[aria-label=\"Поиск модуля\"]'))", 12000), 'search field missing')
  assert(await h.evaluate("document.querySelector('[data-testid=template-results]')?.getBoundingClientRect().width <= innerWidth"), 'gallery overflows phone viewport')
  assert(await h.clickText('Кухня'), 'kitchen filter missing')
  assert(await h.clickText('Верхние'), 'kitchen subcategory missing')
  assert(await h.evaluate("(() => { const cards=[...document.querySelectorAll('[data-template-id]')]; return cards.length>0 && cards.every(c=>c.getAttribute('data-template-id').includes('wall')) })()"), 'subcategory did not narrow kitchen modules')
  assert(await h.clickText('Прихожая'), 'entry category missing')
  assert(await h.evaluate("Boolean(document.querySelector('[data-template-id=shoe-rack-800]'))"), 'shoe rack not in entry category')
  assert(await h.evaluate("(() => { const input=document.querySelector('[aria-label=\"Поиск модуля\"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'Обувница'); input.dispatchEvent(new Event('input',{bubbles:true})); return true })()"), 'search input missing')
  assert(await h.until("document.querySelectorAll('[data-template-id]').length === 1", 5000), 'search did not narrow results')
  assert(await h.evaluate("document.querySelector('[data-template-id]')?.getAttribute('data-template-id') === 'shoe-rack-800'"), 'search returned wrong module')
  console.log('template gallery e2e: PASS')
} catch (error) {
  console.error('template gallery e2e: FAIL', error)
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
