/**
 * Shop Settings → Присадка сценарийі.
 * Root интеграциядан кейін: NODE_OPTIONS=--max-old-space-size=2048 node scripts/e2e-shop-drill.mjs http://localhost:3093
 * Өз Chrome процесін ашады және аяқталғанда жабады; ортақ e2e.mjs-ке тимейді.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = (process.argv[2] ?? 'http://localhost:3093').replace(/\/$/, '')
const port = 10000 + Math.floor(Math.random() * 40000)
const profile = await mkdtemp(join(tmpdir(), 'shop-drill-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--no-first-run',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  '--window-size=1500,1000', 'about:blank',
], { stdio: 'ignore', detached: true })

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(fn, label) {
  for (let i = 0; i < 60; i += 1) {
    const value = await fn().catch(() => null)
    if (value) return value
    await pause(500)
  }
  throw new Error(`timeout: ${label}`)
}

let ws
try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok, 'Chrome')
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = pages.find((item) => item.type === 'page')
  if (!page) throw new Error('Chrome page жоқ')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let id = 0
  const pending = new Map()
  let pageLoaded = null
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.loadEventFired' && pageLoaded) {
      pageLoaded()
      pageLoaded = null
    }
    const slot = pending.get(message.id)
    if (slot) { pending.delete(message.id); slot(message) }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const call = ++id
    const timer = setTimeout(() => { pending.delete(call); reject(new Error(`${method} timeout`)) }, 30000)
    pending.set(call, (message) => { clearTimeout(timer); resolve(message) })
    ws.send(JSON.stringify({ id: call, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text)
    return result.result?.result?.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: `${base}/configurator` })
  await waitFor(() => evaluate("document.body?.innerText.includes('Цех')"), 'app')
  const click = async (label) => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === ${JSON.stringify(label)});
    if (!button) return false; button.click(); return true;
  })()`)
  if (!await click('Цех')) throw new Error('Цех батырмасы табылмады')
  await waitFor(() => evaluate("document.body.innerText.includes('Настройки цеха')"), 'shop dialog')
  if (!await click('Присадка')) throw new Error('Присадка табы табылмады')
  await waitFor(() => evaluate("document.body.innerText.includes('Передний ряд полкодержателей')"), 'drilling fields')
  const changed = await evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((item) => item.textContent?.includes('Передний ряд полкодержателей'));
    const input = label?.querySelector('input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '50'); input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
  if (!changed) throw new Error('Алдыңғы баған өрісі табылмады')
  await waitFor(() => evaluate(`(() => {
    const raw = localStorage.getItem('furniture-configurator:shop');
    return raw && JSON.parse(raw).settings.shelfPinFrontOffset === 50;
  })()`), 'profile persisted')
  let reloaded = false
  pageLoaded = () => { reloaded = true }
  await send('Page.reload', { ignoreCache: true })
  await waitFor(async () => reloaded, 'reload')
  await waitFor(() => evaluate("document.body?.innerText.includes('Цех')"), 'reloaded app')
  if (!await click('Цех')) throw new Error('Қайта ашылған Цех батырмасы табылмады')
  await waitFor(() => evaluate("document.body.innerText.includes('Настройки цеха')"), 'reloaded shop dialog')
  if (!await click('Присадка')) throw new Error('Қайта ашылған Присадка табы табылмады')
  await waitFor(() => evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((item) => item.textContent?.includes('Передний ряд полкодержателей'));
    return label?.querySelector('input')?.value === '50';
  })()`), 'persisted field restored after reload')
  const reset = await evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((item) => item.textContent?.includes('Передний ряд полкодержателей'));
    const button = [...(label?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.trim() === 'Сброс');
    if (!button) return false; button.click(); return true;
  })()`)
  if (!reset) throw new Error('Қалпына келтіру батырмасы табылмады')
  await waitFor(() => evaluate(`(() => {
    const raw = localStorage.getItem('furniture-configurator:shop');
    return raw && JSON.parse(raw).settings.shelfPinFrontOffset === undefined;
  })()`), 'default restored')
  process.stdout.write('Shop drilling E2E: өріс сақтау және әдепкіге қайтару PASS\n')
} finally {
  ws?.close()
  if (chrome.pid) {
    try { process.kill(-chrome.pid, 'SIGTERM') } catch { /* Chrome exited already */ }
  }
  await Promise.race([
    new Promise((resolve) => chrome.once('exit', resolve)),
    pause(3000),
  ])
  await rm(profile, { recursive: true, force: true })
}
