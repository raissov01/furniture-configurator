/** `/cut` Базис бумасының нақты браузерлік экспорты; dev серверді өзі қоспайды. */
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['BASIS_E2E_CDP_PORT'] ?? 9448)
const profile = mkdtempSync(join(tmpdir(), 'furniture-basis-e2e-'))
const downloads = mkdtempSync(join(tmpdir(), 'furniture-basis-downloads-'))
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
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await h.goto('/cut', 6500)
  assert(await h.until("Number(document.querySelector('main[data-cut-panel-count]')?.dataset.cutPanelCount) > 0", 15000), 'cut page has no panels')
  assert(await h.clickText('Базис'), 'Basis export button missing or disabled')
  let zipFile
  for (let attempt = 0; attempt < 60; attempt += 1) {
    zipFile = readdirSync(downloads).find((file) => file.endsWith('-базис.zip'))
    if (zipFile) break
    await wait(500)
  }
  assert(zipFile, 'Basis ZIP was not downloaded')
  const files = unzipSync(readFileSync(join(downloads, zipFile)))
  for (const name of ['bazis-import.js', 'detali.csv', 'detali.xlsx', 'README.txt']) {
    assert(files[name]?.length > 0, `${name} missing from Basis ZIP`)
  }
  assert(!files['prisadka.csv'], 'obsolete prisadka.csv is present')
  console.log('Basis export e2e: PASS')
} catch (error) {
  console.error('Basis export e2e: FAIL', error)
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
  await Promise.all([profile, downloads].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })))
}
