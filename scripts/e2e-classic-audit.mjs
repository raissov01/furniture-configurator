/** Classic audit: P0 actions and P1 keyboard/button behavior. */
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['CLASSIC_AUDIT_CDP_PORT'] ?? 9464)
const profile = mkdtempSync(join(tmpdir(), 'furniture-classic-audit-'))
const downloads = mkdtempSync(join(tmpdir(), 'furniture-classic-downloads-'))
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
  assert(await h.until("document.querySelector('[data-workspace-style]')?.getAttribute('data-workspace-style') === 'classic'", 15000), 'Classic workspace missing')
  await h.evaluate("[...document.querySelectorAll('[data-testid=template-gallery-dialog] button')].find((button) => button.textContent?.trim() === 'Закрыть')?.click()")
  await h.until("!document.querySelector('[data-testid=template-gallery-dialog]')", 5000)
  // P0-2: every tour target has a visible box and Escape releases the workspace.
  if (await h.until("[...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Пропустить')", 5000)) {
    assert(await h.evaluate("(() => { const ring=document.querySelector('.pointer-events-none.fixed.inset-0 .ring-2'); if (!ring) return false; const r=ring.getBoundingClientRect(); return r.width>0 && r.height>0 })()"), 'Tour target invisible')
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
    assert(await h.until("![...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Пропустить')", 5000), 'Tour traps the screen')
  }
  // P1: a desktop menubar must expose menu roles and keyboard navigation.
  assert(await h.evaluate("document.querySelector('[data-testid=classic-menubar]')?.getAttribute('role') === 'menubar'"), 'Classic menubar lacks role')
  const fileButton = await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-testid=classic-menubar] button')].find(x=>x.textContent?.trim().startsWith('Файл')); b?.focus(); return !!b })()")
  assert(fileButton, 'File menu trigger missing')
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' })
  assert(await h.until("!!document.querySelector('[role=menu] [role=menuitem]:focus')", 3000), 'ArrowDown did not open and focus File menu')
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
  assert(await h.until("!document.querySelector('[role=menu]')", 3000), 'Escape did not close menu')
  const icon = await h.evaluate("(() => { const r=document.querySelector('[data-testid=classic-tool-new]').getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 } })()")
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: icon.x, y: icon.y })
  const hoverColor = await h.evaluate("getComputedStyle(document.querySelector('[data-testid=classic-tool-new]')).backgroundColor")
  const hoverTarget = await h.evaluate(`(() => { const e=document.elementFromPoint(${icon.x}, ${icon.y}); const b=document.querySelector('[data-testid=classic-tool-new]'); const r=b.getBoundingClientRect(); return { tag:e?.tagName, class:e?.className?.toString().slice(0,120), html:e?.outerHTML?.slice(0,140), x:${icon.x}, y:${icon.y}, rect:[r.x,r.y,r.width,r.height] } })()`)
  assert(hoverColor === 'rgb(229, 243, 255)', `Hover color is not the light classic state: ${hoverColor}; target ${hoverTarget}`)
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: icon.x, y: icon.y, button: 'left', clickCount: 1 })
  assert(await h.evaluate("getComputedStyle(document.querySelector('[data-testid=classic-tool-new]')).backgroundColor === 'rgb(204, 232, 255)'"), 'Pressed state does not darken')
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: icon.x, y: icon.y, button: 'left', clickCount: 1 })
  // P0-4/5: disabled icons look disabled; the hidden header controls are reachable.
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-testid=classic-tool-redo]'); return b?.disabled && getComputedStyle(b.querySelector('svg')).filter.includes('grayscale') })()"), 'Disabled icon is visually identical')
  const openMenu = async (label) => h.evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=classic-menubar] [data-menu-trigger]')].find(x=>x.textContent?.trim()===${JSON.stringify(label)}); b?.click(); return !!b })()`)
  assert(await openMenu('Вид'), 'View menu missing')
  assert(await h.until("!!document.querySelector('[data-menu-item=" + JSON.stringify('view.theme.light') + "]')", 3000), 'Theme missing from classic View menu')
  assert(await h.evaluate("!!document.querySelector('[data-menu-item=\"view.quality.high\"]')"), '3D quality missing from classic View menu')
  assert(await openMenu('Сервис'), 'Service menu missing')
  assert(await h.until("!!document.querySelector('[data-menu-item=\"service.price\"]')", 3000), 'Price missing from classic Service menu')
  assert(await h.evaluate("!!document.querySelector('[data-menu-item=\"service.account\"]')"), 'Account missing from classic Service menu')
  assert(await h.evaluate("!!document.querySelector('[data-menu-item^=\"service.lang.\"]')"), 'Language missing from classic Service menu')
  // P0-1: the File menu downloads from its own action, independent of hidden header buttons.
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  assert(await openMenu('Файл'), 'File menu missing')
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-menu-item=\"file.export.xlsx\"]')?.closest('button'); if (!b || b.disabled) return false; b.click(); return true })()"), 'XLSX action missing or disabled')
  const untilDownload = async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (readdirSync(downloads).some((name) => name.endsWith('.xlsx'))) return true
      await wait(400)
    }
    return false
  }
  assert(await untilDownload(), 'Classic File menu did not download XLSX')
  console.log('Classic audit e2e: PASS')
} catch (error) {
  console.error('Classic audit e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  const exited = chrome.exitCode === null ? new Promise((resolve) => chrome.once('exit', resolve)) : Promise.resolve()
  if (chrome.pid && chrome.exitCode === null) {
    try { process.kill(-chrome.pid, 'SIGTERM') } catch { chrome.kill('SIGTERM') }
  }
  await Promise.race([exited, wait(2000)])
  await rm(profile, { recursive: true, force: true })
  await rm(downloads, { recursive: true, force: true })
}
