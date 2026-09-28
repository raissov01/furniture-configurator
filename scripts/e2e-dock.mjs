/** Live workspace dock smoke test. Run with one dev server: node scripts/e2e-dock.mjs URL. */
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['E2E_CDP_PORT'] ?? 9334)
const shots = process.env['E2E_SHOTS'] ?? '/tmp/e2e-dock-shots'
const dxf = readFileSync(resolve('tests/fixtures/dxf-rect-lines.dxf')).toString('base64')
let chrome = null
let socket = null

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function connect() {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`)
  } catch {
    chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
      '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`, '--window-size=1500,1000', 'about:blank',
    ], { stdio: 'ignore' })
    let ready = false
    for (let i = 0; i < 40; i++) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 500))
      try { await fetch(`http://127.0.0.1:${port}/json/version`); ready = true; break } catch { /* browser starting */ }
    }
    assert(ready, 'Chrome іске қосылмады')
  }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = tabs.find((tab) => tab.type === 'page')
  assert(page, 'CDP беті табылмады')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolveOpen) => { socket.onopen = resolveOpen })
  let id = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const finish = pending.get(message.id)
    if (finish) { pending.delete(message.id); finish(message) }
  }
  const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
    const callId = ++id
    const timer = setTimeout(() => { pending.delete(callId); rejectSend(new Error(`${method} 60 с ішінде жауап бермеді`)) }, 60000)
    pending.set(callId, (message) => {
      clearTimeout(timer)
      if (message.error) rejectSend(new Error(message.error.message))
      else resolveSend(message.result)
    })
    socket.send(JSON.stringify({ id: callId, method, params }))
  })
  await send('Runtime.enable')
  await send('Page.enable')
  return { send }
}

async function run() {
  const session = await connect()
  const h = makeHelpers(session, base)
  mkdirSync(shots, { recursive: true })
  await h.goto('/configurator', 6000)
  assert(await h.until("Boolean(localStorage.getItem('furniture-configurator:project'))", 10000), 'бастапқы жоба сақталмады')
  const project = await h.evaluate("JSON.parse(localStorage.getItem('furniture-configurator:project'))")
  project.room = { ...project.room, width: 5000, depth: 4500 }

  for (const style of ['classic']) {
    // Inject on the next document: the outgoing Workspace saves on pagehide.
    const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', { source:
      `localStorage.setItem('furniture-configurator:workspace-style', ${JSON.stringify(style)}); localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(project))}); localStorage.removeItem('furniture-configurator:workspace-dock')`,
    })
    await h.goto('/configurator', 7000)
    await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
    await h.clickText('Пропустить', 100)
    assert(await h.until(`document.querySelector('[data-workspace-style="${style}"]') !== null`, 10000), `${style}: режим ашылмады`)
    assert(await h.until("(() => { const r=JSON.parse(localStorage.getItem('furniture-configurator:project')).room; return r.width===5000 && r.depth===4500 })()", 10000), `${style}: импорт алдындағы өлшем қате`)

    for (const [id, title] of [
      ['find', 'Найти'], ['price', 'Прайс-лист'], ['dimensions', 'Размеры'],
      ['info', 'Информация'], ['import', 'Импорт'],
    ]) {
      assert(await h.clickText(`Открыть ${title}`, 150), `${style}: ${title} ашу батырмасы жоқ`)
      assert(await h.until(`document.querySelector('[data-dock-panel="${id}"]')?.dataset.dockHidden === 'false'`, 5000), `${style}: ${title} ашылмады`)
    }

    const searchReady = await h.evaluate(`(() => {
      const input = document.querySelector('[data-dock-panel="find"] input[type="text"]')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, 'Боковина')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    assert(searchReady, `${style}: Find іздеу өрісі жоқ`)
    const findHasResult = await h.until(`document.querySelector('[data-panel="find"] button') !== null`, 10000)
    if (!findHasResult) {
      const findText = await h.evaluate("document.querySelector('[data-panel=find]')?.textContent ?? 'panel missing'")
      const findValue = await h.evaluate("document.querySelector('[data-panel=find] input')?.value ?? 'input missing'")
      throw new Error(`${style}: Find нәтиже жоқ; input=${findValue}; panel=${findText}`)
    }
    const selected = await h.evaluate(`(() => {
      const button = document.querySelector('[data-panel="find"] button')
      if (!button) return false
      button.click()
      return true
    })()`)
    assert(selected, `${style}: Find нысанды таңдамады`)
    assert(await h.until(`document.querySelector('[data-panel="info"]')?.textContent.includes('Боковина')`, 5000), `${style}: Info таңдалған детальді көрсетпеді`)

    const dimensions = await h.evaluate(`(() => {
      const input = document.querySelector('[data-panel="dimensions"] input[type="checkbox"]')
      if (!input) return false
      input.click()
      return true
    })()`)
    assert(dimensions, `${style}: Dimensions ауыстырғышы жоқ`)
    assert(await h.evaluate(`document.querySelector('[data-panel="price"]') !== null`), `${style}: Price мазмұны жоқ`)

    const uploaded = await h.evaluate(`(() => {
      const input = document.querySelector('[data-dock-panel="import"] input[type="file"]')
      if (!input) return false
      const bytes = atob(${JSON.stringify(dxf)})
      const file = new File([bytes], 'dxf-rect-lines.dxf', { type: 'application/dxf' })
      const files = new DataTransfer()
      files.items.add(file)
      input.files = files.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    assert(uploaded, `${style}: Import файл өрісі жоқ`)
    assert(await h.until(`[...document.querySelectorAll('[data-dock-panel="import"] button')].some((item) => item.textContent.trim() === 'Импортировать')`, 10000), `${style}: DXF алдын ала көрінісі шықпады`)
    const imported = await h.evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-dock-panel="import"] button')]
        .find((item) => item.textContent.trim() === 'Импортировать')
      if (!button || button.disabled) return false
      button.click()
      return true
    })()`)
    assert(imported, `${style}: DXF импортталмады`)
    assert(await h.until(`(() => {
      const raw = localStorage.getItem('furniture-configurator:project')
      if (!raw) return false
      const room = JSON.parse(raw).room
      return room?.width === 4000 && room?.depth === 3000
    })()`, 10000), `${style}: импортталған бөлме жобада сақталмады`)

    const screenshot = await session.send('Page.captureScreenshot', { format: 'png' })
    assert(screenshot?.data, `${style}: скриншот алынбады`)
    writeFileSync(`${shots}/workspace-dock-${style}.png`, Buffer.from(screenshot.data, 'base64'))
    process.stdout.write(`✓ ${style}: бес панель, Find, Info, Dimensions, Price, DXF импорт және скриншот\n`)
  }
}

try {
  await run()
} finally {
  socket?.close()
  if (chrome) chrome.kill('SIGTERM')
}
