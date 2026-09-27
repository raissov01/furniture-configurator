/** Цехтың келісілген нұсқасы жоба өзгерген соң да ескі мөр PDF-іне сілтейді. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['APPROVAL_BANNER_E2E_CDP_PORT'] ?? 9453)
const profile = mkdtempSync(join(tmpdir(), 'furniture-approval-banner-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (ok, message) => { if (!ok) throw new Error(message) }

async function connect() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((tab) => tab.type === 'page')
      if (!page) throw new Error('Chrome page missing')
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
  await h.goto('/configurator', 7000)
  assert(await h.menu('Проект', 'Код для клиента'), 'client code menu did not open')
  assert(await h.until(`/^\\d{6}$/.test(document.querySelector('[data-share-code]')?.textContent.trim() ?? '')`, 15000),
    'share code did not appear')
  const code = await h.evaluate(`document.querySelector('[data-share-code]').textContent.trim()`)
  assert(await h.evaluate(`(() => {
    const original = window.fetch.bind(window)
    window.__approvalBannerReply = { version: 1, status: 'approved', latestApprovedVersion: 1 }
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url === '/api/share/${code}/approval') return Promise.resolve(new Response(
        JSON.stringify(window.__approvalBannerReply), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      return original(input, init)
    }
    return true
  })()`), 'approval response hook failed')
  assert(await h.until(`Boolean(document.querySelector('[data-testid="approved-version-banner"]'))`, 10000),
    'workshop approval banner did not appear')
  assert(await h.evaluate(`document.querySelector('[data-testid="approved-version-banner"] a')?.getAttribute('href')
    === '/api/share/${code}/approval?version=1&format=pdf'`), 'stamped PDF link is wrong')
  await h.evaluate(`window.__approvalBannerReply = { version: 2, status: 'changed', latestApprovedVersion: 1 }`)
  assert(await h.until(`document.querySelector('[data-testid="approved-version-banner"]')?.textContent
    .includes('Текущий проект изменён после согласования')`, 10000), 'changed project notice did not appear')
  assert(await h.evaluate(`document.querySelector('[data-testid="approved-version-banner"] a')?.getAttribute('href')
    === '/api/share/${code}/approval?version=1&format=pdf'`), 'old stamped PDF link was lost')
  assert(await h.evaluate('document.documentElement.scrollWidth <= innerWidth'), '390 px banner overflows')
  console.log('approval banner e2e: PASS')
} catch (error) {
  console.error('approval banner e2e: FAIL', error)
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
