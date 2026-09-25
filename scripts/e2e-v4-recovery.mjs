/** Corrupt local project must remain recoverable until an explicit new-project action. */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = 10000 + Math.floor(Math.random() * 40000)
const profile = mkdtempSync(join(tmpdir(), 'furniture-v4-recovery-e2e-'))
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

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
        const callback = pending.get(event.data ? JSON.parse(event.data).id : undefined)
        if (callback) {
          const message = JSON.parse(event.data)
          pending.delete(message.id)
          callback(message)
        }
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

const damaged = '{"schemaVersion":4,"name":123}'
const historyProject = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
const history = [{ at: 1_700_000_000_000, name: 'Recovery fixture', json: JSON.stringify(historyProject) }]
let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('furniture-configurator:project', ${JSON.stringify(damaged)});
      localStorage.setItem('furniture-configurator:history', ${JSON.stringify(JSON.stringify(history))})`,
  })
  await h.goto('/configurator', 7000)
  await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
  assert(await h.until("Boolean(document.querySelector('[role=alert]'))", 15000), 'corrupt-project banner missing')
  assert(await h.evaluate(`localStorage.getItem('furniture-configurator:project') === ${JSON.stringify(damaged)}`),
    'autosave overwrote corrupt source')
  assert(await h.evaluate(`localStorage.getItem('furniture-configurator:project-corrupt-backup') === ${JSON.stringify(damaged)}`),
    'corrupt source backup missing')
  assert(await h.clickText('Восстановить из истории'), 'history recovery action missing')
  assert(await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Вернуть')", 5000),
    'saved history entry missing')
  const restoredEntry = await h.evaluate(`(() => {
    const row = [...document.querySelectorAll('li')]
      .find((entry) => entry.textContent.includes('Recovery fixture'))
    const button = [...(row?.querySelectorAll('button') ?? [])]
      .find((entry) => entry.textContent.trim() === 'Вернуть')
    button?.click()
    return Boolean(button)
  })()`)
  assert(restoredEntry, 'history restore button for Recovery fixture missing')
  assert(await h.until(`(() => { try { const saved = JSON.parse(localStorage.getItem('furniture-configurator:project'));
    return saved.schemaVersion === 4 && saved.name === ${JSON.stringify(historyProject.name)} } catch { return false } })()`, 10000),
  'restored history was not saved immediately')
  assert(await h.evaluate(`localStorage.getItem('furniture-configurator:project-corrupt-backup') === ${JSON.stringify(damaged)}`),
    'history restore discarded corrupt source backup')
  await h.goto('/configurator', 7000)
  assert(await h.evaluate("!document.querySelector('[role=alert]')"), 'history restore did not survive reload')

  const secondInjection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('furniture-configurator:project', ${JSON.stringify(damaged)})`,
  })
  await h.goto('/configurator', 7000)
  await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: secondInjection.identifier })
  assert(await h.until("Boolean(document.querySelector('[role=alert]'))", 15000), 'second corrupt-project banner missing')
  assert(await h.clickText('Начать новый проект'), 'explicit new-project action missing')
  assert(await h.until("(() => { try { return JSON.parse(localStorage.getItem('furniture-configurator:project'))?.schemaVersion === 4 } catch { return false } })()", 10000),
    'new project was not saved')
  assert(await h.evaluate(`localStorage.getItem('furniture-configurator:project-corrupt-backup') === ${JSON.stringify(damaged)}`),
    'new project discarded corrupt source backup')
  await h.goto('/configurator', 7000)
  assert(await h.until("Boolean(document.querySelector('#scene-3d canvas'))", 15000), 'new project failed to reload')
  assert(await h.evaluate("!document.querySelector('[role=alert]')"), 'recovery banner remained after reload')
  console.log('v4 recovery e2e: PASS')
} catch (error) {
  console.error('v4 recovery e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  const exited = chrome.exitCode === null
    ? new Promise((resolve) => chrome.once('exit', resolve)) : Promise.resolve()
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
