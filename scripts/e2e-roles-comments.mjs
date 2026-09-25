/** Standalone browser scenario; root runs it after the integrated build/dev server is ready. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['ROLES_E2E_CDP_PORT'] ?? 9444)
const profile = mkdtempSync(join(tmpdir(), 'furniture-roles-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((tab) => tab.type === 'page')
      if (!page) throw new Error('page missing')
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((resolve) => { ws.onopen = resolve })
      let id = 0
      const pending = new Map()
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        const resolve = pending.get(message.id)
        if (resolve) { pending.delete(message.id); resolve(message) }
      }
      const send = (method, params = {}) => new Promise((resolve, reject) => {
        const key = ++id
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
        pending.set(key, (value) => {
          clearTimeout(timer)
          if (value.error) reject(new Error(`CDP ${method}: ${value.error.message}`))
          else resolve(value.result)
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

function assert(value, message) {
  if (!value) throw new Error(message)
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await h.goto('/configurator', 8000)
  const email = `roles-e2e-${Date.now()}@example.kz`
  const register = await h.evaluate(`fetch('/api/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:${JSON.stringify(email)},password:'password123',shopName:'E2E'})}).then(r=>r.status)`)
  assert(register === 200, `registration: ${register}`)
  assert(await h.until("document.querySelectorAll('[data-dimension-label]').length === 3", 20000), 'editor dimension labels missing')
  assert(await h.menu('Проект', 'Код для клиента', 1500), 'client code menu missing')
  assert(await h.until("/^[0-9]{6}$/.test(document.querySelector('[data-share-code]')?.textContent?.trim() ?? '')", 20000), 'share code response missing')
  const code = await h.evaluate("document.querySelector('[data-share-code]')?.textContent?.trim()")
  assert(/^\d{6}$/.test(code), 'share code missing')
  await h.goto(`/view?c=${code}`, 8000)
  assert(await h.until("location.pathname === '/view' && Boolean(document.body)", 20000), 'client page did not load')
  assert(!(await h.text()).includes('Размер, H × W × D'), 'client dimensions visible')
  assert(await h.until("Boolean(document.querySelector('#scene-3d canvas'))", 20000), 'client 3D scene missing')
  await h.wait(1000)
  assert(await h.evaluate("document.querySelectorAll('[data-dimension-label]').length === 0"), 'client 3D dimension labels visible')
  assert(await h.until("Boolean(document.querySelector('textarea[aria-label=\"Комментарий\"]'))", 12000), 'comment form did not load')
  const entered = await h.evaluate(`(() => {
    const name = document.querySelector('input[aria-label="Ваше имя"]')
    const body = document.querySelector('textarea[aria-label="Комментарий"]')
    if (!name || !body) return false
    const set = (element, value) => { const proto = element.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})) }
    set(name,'Айша'); set(body,'Фасад түсін өзгертуге бола ма?'); return true
  })()`)
  assert(entered, 'comment form missing')
  assert(await h.clickText('Отправить', 1200), 'comment submit missing')
  await h.goto('/configurator', 8000)
  assert(await h.clickText('Аккаунт', 1000), 'account panel missing')
  assert(await h.until("document.body.innerText.includes('Фасад түсін өзгертуге бола ма?')", 12000), 'designer inbox did not receive client comment')
  assert(await h.clickText('Ответить', 300), 'reply button missing')
  const filled = await h.evaluate(`(() => {
    const area = document.querySelector('textarea[aria-label="Ответ клиенту"]')
    if (!area) return false
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'Иә, болады')
    area.dispatchEvent(new Event('input',{bubbles:true}))
    return true
  })()`)
  assert(filled, 'designer reply field missing')
  assert(await h.clickText('Отправить ответ', 1000), 'designer reply submit missing')
  await h.goto(`/view?c=${code}`, 8000)
  assert(await h.until("document.body?.innerText.includes('Иә, болады') ?? false", 20000), 'client does not see reply')
  console.log('roles/comments e2e: PASS')
} catch (error) {
  console.error('roles/comments e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  // Stop the complete owned process group, including late profile writers.
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
