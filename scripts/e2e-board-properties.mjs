/** Free board Properties, saved cut dimensions and manual drilling. Run against an integrated dev server. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['BOARD_E2E_CDP_PORT'] ?? 9446)
const profile = mkdtempSync(join(tmpdir(), 'furniture-board-e2e-'))
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

const saved = () => "JSON.parse(localStorage.getItem('furniture-configurator:project') || '{}')"
let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await h.goto('/configurator', 7000)
  assert(await h.until("Boolean(document.querySelector('[data-testid=tree-dock]'))", 15000), 'workspace missing')
  assert(await h.clickText('+ доска'), 'add board control missing')
  assert(await h.until("document.querySelectorAll('[data-testid=board-properties]').length === 1", 10000), 'single board Properties missing')
  assert(await h.evaluate("!document.querySelector('[data-tour=size]')"), 'cabinet Properties remained mounted')
  const id = await h.evaluate(`(${saved()}).root.children.find(n=>n.kind==='board')?.id`)
  assert(id, 'new board not saved')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=board-properties] button')].find(x=>x.textContent.trim()==='Материал'); if (!b) return false; b.click(); return true })()"), 'Material tab missing')
  assert(await h.evaluate("(() => { const l=[...document.querySelectorAll('[data-testid=board-properties] label')].find(x=>x.textContent.includes('Кромка W1')); const s=l?.querySelector('select'); const o=[...s?.options ?? []].find(x=>x.textContent.includes('2 мм')); if (!o) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value); s.dispatchEvent(new Event('change',{bubbles:true})); return true })()"), '2 mm edge choice failed')
  assert(await h.until(`(${saved()}).root.children.some(n=>n.id===${JSON.stringify(id)} && n.board.edges.W1?.bandId)`, 10000), 'board edge not persisted')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=board-properties] button')].find(x=>x.textContent.trim()==='Отчёты'); if (!b) return false; b.click(); return true })()"), 'Reports tab missing')
  assert(await h.until("document.querySelector('[data-testid=board-cut-size]')?.textContent.includes('98 × 100')", 5000), '2 mm edge did not reduce cut dimension')
  await h.goto('/cut', 5000)
  assert(await h.until("Number(document.querySelector('main[data-cut-panel-count]')?.getAttribute('data-cut-panel-count')) >= 1", 15000), 'board missing from cut page')
  await h.goto('/configurator', 7000)
  assert(await h.until(`Boolean(document.querySelector('[data-tree-node=${JSON.stringify(id)}]'))`, 10000), 'board missing after reload')
  assert(await h.evaluate(`(() => { const b=document.querySelector('[data-tree-node=${JSON.stringify(id)}]'); if (!b) return false; b.click(); return true })()`), 'cannot reselect board')
  assert(await h.until("document.querySelector('[data-testid=board-cut-size]')?.textContent.includes('98 × 100')", 5000), 'cut dimension changed after reload')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=board-properties] button')].find(x=>x.textContent.trim()==='Производство'); if (!b) return false; b.click(); return true })()"), 'Production tab missing')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=board-properties] button')].find(x=>x.textContent.trim()==='Открыть присадку'); if (!b) return false; b.click(); return true })()"), 'board DrillEditor button missing')
  assert(await h.until("Boolean(document.querySelector('svg[aria-label=\"Развёртка детали\"]'))", 5000), 'board DrillEditor missing')
  assert(await h.evaluate("(() => { const svg=document.querySelector('svg[aria-label=\"Развёртка детали\"]'); if (!svg) return false; const r=svg.getBoundingClientRect(); svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*0.5,clientY:r.top+r.height*0.5})); return true })()"), 'manual hole gesture failed')
  assert(await h.until(`(${saved()}).root.children.some(n=>n.id===${JSON.stringify(id)} && n.board.drilling?.length===1)`, 10000), 'manual hole not saved in board')
  assert(await h.clickText('Закрыть'), 'cannot close DrillEditor')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=board-properties] button')].find(x=>x.textContent.trim().startsWith('Экспорт')); if (!b) return false; b.click(); return true })()"), 'board export menu missing')
  assert(await h.until("[...document.querySelectorAll('[data-testid=board-properties] button')].some(x=>x.textContent.includes('DXF'))", 5000), 'board DXF export missing')
  console.log('board Properties e2e: PASS')
} catch (error) {
  console.error('board Properties e2e: FAIL', error)
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
