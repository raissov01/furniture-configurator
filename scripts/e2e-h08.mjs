/** H-08: real Chrome panorama export and guide/layout screenshots. */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2]
if (!base) throw new Error('Usage: node scripts/e2e-h08.mjs http://127.0.0.1:<port>')
const screenshotsOnly = process.env.H08_SCREENSHOTS_ONLY === '1'
const russianOnly = process.env.H08_RU_ONLY === '1'
const kazakhOnly = process.env.H08_KK_ONLY === '1'
const russianCutOnly = process.env.H08_RU_CUT_ONLY === '1'
const kazakhCutOnly = process.env.H08_KK_CUT_ONLY === '1'
const panoramaOnly = process.env.H08_PANORAMA_ONLY === '1'
const port = await new Promise((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const address = server.address(); const value = address.port; server.close(() => resolve(value)) })
})
const profile = mkdtempSync(join(tmpdir(), 'aismebel-h08-chrome-'))
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore', detached: true })
let ws
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) break }
    catch { /* Chrome is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const tab = tabs.find((item) => item.type === 'page')
  if (!tab) throw new Error('Chrome page missing')
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let commandId = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!pending.has(message.id)) return
    const { resolve, reject, timer } = pending.get(message.id)
    clearTimeout(timer); pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, 60000)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${expression}`)
    return result.result.value
  }
  const waitFor = async (expression, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
    console.error('page diagnostic', await evaluate('({ url: location.href, title: document.title, body: document.body?.innerText.slice(0, 1200), canvas: document.querySelectorAll("canvas").length, status: document.querySelectorAll("[data-testid=p100-status]").length })'))
    await screenshot('docs/guide/screenshots/h08-failure.png')
    throw new Error(`Browser wait timed out: ${expression}`)
  }
  const navigate = async (path) => {
    const url = new URL(path, base).href
    await send('Page.navigate', { url })
    await waitFor(`location.href === ${JSON.stringify(url)} && document.readyState === "complete" && document.body !== null`, 45000)
  }
  const screenshot = async (relative) => {
    const target = join(process.cwd(), relative)
    mkdirSync(join(target, '..'), { recursive: true })
    await evaluate(`document.querySelectorAll('nextjs-portal').forEach((portal) => { portal.style.display = 'none' })`)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(target, Buffer.from(shot.data, 'base64'))
    console.log('screenshot', relative)
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  main: {
  await navigate(russianCutOnly || kazakhCutOnly ? '/cut' : '/configurator')
  const project = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
  await evaluate(`(() => { localStorage.setItem('furniture-configurator:workspace-style', 'classic');
    localStorage.setItem('furniture-configurator:tour-done', '1');
    localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(project))}); return true })()`)
  if (russianOnly) {
    await navigate('/configurator?lang=ru')
    await waitFor(`!document.body.innerText.includes('Загрузка 3D') && Boolean(document.querySelector('canvas'))`, 60000)
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await screenshot('docs/guide/screenshots/ru-start.png')
    console.log('H-08 Russian guide screenshot passed')
    break main
  }
  if (russianCutOnly) {
    await navigate('/cut?lang=ru')
    await waitFor(`Boolean(document.querySelector('svg[aria-label^="Лист"]'))`, 60000)
    await screenshot('docs/guide/screenshots/ru-order-flow.png')
    console.log('H-08 Russian cut screenshot passed')
    break main
  }
  if (kazakhCutOnly) {
    await navigate('/cut?lang=kk')
    await waitFor(`Boolean(document.querySelector('svg[aria-label^="Лист"]'))`, 60000)
    await screenshot('docs/guide/screenshots/kk-order-flow.png')
    console.log('H-08 Kazakh cut screenshot passed')
    break main
  }
  if (panoramaOnly) {
    await navigate('/configurator?lang=kk')
    await waitFor('Boolean(document.querySelector("canvas")) && Boolean(document.querySelector("[data-testid=p100-status]"))', 60000)
    await evaluate(`document.querySelector('[aria-label="Рендер"]')?.click()`)
    await waitFor(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.includes('360° панорама')))`)
    await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('360° панорама'))?.click()`)
    await waitFor(`Boolean(document.querySelector('img[alt="360° панорама"]')) || Boolean(document.querySelector('img[alt="Панорама 360°"]'))`, 60000)
    await screenshot('docs/guide/screenshots/panorama-preview.png')
    console.log('H-08 panorama dev preview passed')
    break main
  }
  await navigate('/configurator?lang=kk')
  await waitFor('Boolean(document.querySelector("canvas")) && Boolean(document.querySelector("[data-testid=p100-status]"))', 45000)
  await evaluate('document.querySelector("[data-testid=classic-menubar] [data-menu-trigger]")?.click()')
  await waitFor(`Boolean(document.querySelector('[data-menu-item="file.export.panorama"]'))`)
  await evaluate('document.querySelector("[data-testid=classic-menubar] [data-menu-trigger]")?.click()')
  await new Promise((resolve) => setTimeout(resolve, 2500))
  await screenshot('docs/guide/screenshots/kk-start.png')
  await screenshot('docs/pro100/layout-compare/ours-h08-workspace.png')
  await evaluate('document.querySelector("[data-testid=classic-tool-properties]")?.click()')
  await waitFor('Boolean(document.querySelector("[data-testid=properties-dialog]"))')
  await screenshot('docs/pro100/layout-compare/ours-h08-properties.png')
  await evaluate('document.querySelector("[data-testid=properties-cancel]")?.click()')
  await waitFor('!document.querySelector("[data-testid=properties-dialog]")')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 990, y: 500, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 990, y: 500, button: 'left', clickCount: 1 })
  await new Promise((resolve) => setTimeout(resolve, 4000))
  await screenshot('docs/pro100/layout-compare/ours-h08-selection.png')
  if (kazakhOnly) { console.log('H-08 Kazakh layout screenshots passed'); break main }
  if (!screenshotsOnly) {
  await evaluate(`(() => { window.__h08Downloads = []; const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() { if (this.download === 'panorama-360.png') {
      window.__h08Downloads.push({ name: this.download, prefix: this.href.slice(0, 22), length: this.href.length });
      return; } return original.call(this) }; return true })()`)
  await evaluate('document.querySelector("[data-testid=classic-menubar] [data-menu-trigger]")?.click()')
  await waitFor(`Boolean(document.querySelector('[data-menu-item="file.export.panorama"]'))`)
  await evaluate(`document.querySelector('[data-menu-item="file.export.panorama"]')?.closest('button')?.click()`)
  await waitFor('window.__h08Downloads?.length === 1', 60000)
  const downloaded = await evaluate('window.__h08Downloads[0]')
  if (downloaded.prefix !== 'data:image/png;base64,' || downloaded.length < 10000) throw new Error(`Bad panorama download: ${JSON.stringify(downloaded)}`)
  console.log('panorama PNG export', downloaded.length, 'bytes as data URL')
  await evaluate(`document.querySelector('[aria-label="Рендер"]')?.click()`)
  await waitFor(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.includes('360° панорама')))`)
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('360° панорама'))?.click()`)
  await waitFor(`Boolean(document.querySelector('img[alt="360° панорама"]')) || Boolean(document.querySelector('img[alt="Панорама 360°"]'))`, 60000)
  await screenshot('docs/guide/screenshots/panorama-preview.png')
  }
  await navigate('/cut?lang=kk')
  await waitFor(`Boolean(document.querySelector('svg[aria-label^="Лист"]'))`, 60000)
  await screenshot('docs/guide/screenshots/kk-order-flow.png')
  await navigate('/configurator?lang=ru')
  await waitFor('Boolean(document.querySelector("[data-testid=p100-status]"))', 45000)
  await waitFor(`!document.body.innerText.includes('Загрузка 3D') && Boolean(document.querySelector('canvas'))`, 45000)
  await new Promise((resolve) => setTimeout(resolve, 1800))
  await screenshot('docs/guide/screenshots/ru-start.png')
  await navigate('/cut?lang=ru')
  await waitFor(`Boolean(document.querySelector('svg[aria-label^="Лист"]'))`, 60000)
  await screenshot('docs/guide/screenshots/ru-order-flow.png')
  console.log(screenshotsOnly ? 'H-08 browser screenshot scenario passed' : 'H-08 full browser scenario passed')
  }
} finally {
  ws?.close()
  try { process.kill(-chrome.pid, 'SIGTERM') } catch { /* Chrome already exited. */ }
  if (chrome.exitCode === null && chrome.signalCode === null) {
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000))])
  }
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
