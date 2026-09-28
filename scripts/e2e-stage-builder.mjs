/** Алты белсенді түр: бес қадам → Panel[] жобасы → деталировка/смета. */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['STAGE_E2E_CDP_PORT'] ?? 9452)
const profile = mkdtempSync(join(tmpdir(), 'aismebel-stage-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (ok, message) => { if (!ok) throw new Error(message) }

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
        const done = pending.get(message.id)
        if (done) { pending.delete(message.id); done(message) }
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
  await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "try { localStorage.setItem('furniture-configurator:workspace-style', 'classic') } catch {}",
  })
  const cases = [
    ['kitchen', 1280], ['wardrobe', 1280], ['tv', 1280],
    ['chest', 1280], ['office', 1280], ['bedroom', 360],
  ]
  for (const [type, width] of cases.filter(([name]) => !process.env['STAGE_E2E_TYPE'] || process.env['STAGE_E2E_TYPE'] === name)) {
    await session.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 360 })
    await h.goto('/configurator', 3500)
    check(await h.until("[...document.querySelectorAll('button')].some((item) => item.textContent.trim() === 'Создать ▾')", 20000), `${type}: toolbar`)
    await wait(1500)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await h.evaluate("Boolean(document.querySelector('[data-testid=template-gallery-dialog]'))")) break
      await h.menu('Создать', 'Готовые шаблоны', 700)
      await wait(700)
    }
    check(await h.until("Boolean(document.querySelector('[data-testid=template-gallery-dialog]'))", 12000), `${type}: gallery`)
    check(await h.clickText('Наборы', 500), `${type}: sets`)
    check(await h.clickText('Мастер мебели (5 шагов)', 800), `${type}: wizard`)
    check(await h.until("Boolean(document.querySelector('[data-testid=stage-builder-dialog]'))", 12000), `${type}: dialog`)
    const selected = await h.evaluate(`(() => {
      const dialog = document.querySelector('[data-testid=stage-builder-dialog]')
      const select = [...dialog.querySelectorAll('label')].find((label) => label.textContent.includes('Тип мебели'))?.querySelector('select')
      if (!select) return false
      select.value = ${JSON.stringify(type)}
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    check(selected, `${type}: type selector`)
    check(await h.until("Boolean(document.querySelector('[data-testid=stage-preview-price]'))", 15000), `${type}: preview price`)
    for (let step = 1; step <= 4; step += 1) {
      check(await h.clickText('Далее', 300), `${type}: step ${step}`)
      check(await h.evaluate(`document.querySelectorAll('[data-testid=stage-step-bar] button')[${step}]?.className.includes('bg-neutral-900') || document.querySelectorAll('[data-testid=stage-step-bar] button')[${step}]?.className.includes('dark:bg-neutral-100')`), `${type}: active step ${step}`)
      check(await h.evaluate("Boolean(document.querySelector('[data-testid=stage-preview-3d] canvas'))"), `${type}: 3D step ${step}`)
    }
    if (width === 360) {
      const bounds = await h.evaluate(`(() => {
        const dialog = document.querySelector('[data-testid=stage-builder-dialog]')
        const rect = dialog.getBoundingClientRect()
        return { left: rect.left, right: rect.right, content: dialog.scrollWidth, client: dialog.clientWidth }
      })()`)
      const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(process.env['STAGE_SCREENSHOT'] ?? join(tmpdir(), 'aismebel-stage-360.png'), Buffer.from(shot.data, 'base64'))
      if (!(bounds.left >= 0 && bounds.right <= 360 && bounds.content <= bounds.client)) {
        const offenders = await h.evaluate(`[...document.querySelector('[data-testid=stage-builder-dialog]').querySelectorAll('*')]
          .map((el) => ({ tag: el.tagName, className: String(el.className).slice(0, 65), text: el.textContent.trim().slice(0, 30), right: Math.round(el.getBoundingClientRect().right) }))
          .filter((el) => el.right > 360).slice(0, 15)`)
        throw new Error(`mobile overflow: ${JSON.stringify({ ...bounds, offenders })}`)
      }
    }
    check(await h.clickText(type === 'kitchen' ? 'Собрать кухню' : 'Собрать', 1500), `${type}: assemble`)
    check(await h.until("!document.querySelector('[data-testid=stage-builder-dialog]')", 15000), `${type}: wizard closes`)
    await h.evaluate(`(() => {
      const gallery = document.querySelector('[data-testid=template-gallery-dialog]')
      const button = [...(gallery?.querySelectorAll('button') ?? [])].find((item) => item.textContent.trim() === 'Закрыть')
      button?.click()
    })()`)
    check(await h.until("document.body.innerText.includes('Деталей:')", 12000), `${type}: cut list`)
    check(await h.menu('Проект', 'Смета и раскрой', 1200), `${type}: quote`)
    check((await h.text()).includes('Листов всего'), `${type}: nesting result`)
    check(await h.clickText('Стоимость', 500), `${type}: price tab`)
    check((await h.text()).includes('К ОПЛАТЕ'), `${type}: price result`)
    check(await h.clickText('Закрыть', 300), `${type}: close quote`)
    console.log(`${type}: PASS`)
  }
  console.log('stage builder e2e: PASS')
} catch (error) {
  console.error('stage builder e2e: FAIL', error)
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
