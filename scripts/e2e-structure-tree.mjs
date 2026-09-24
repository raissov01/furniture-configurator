/** Standalone Structure/Layers browser scenario. Root runs this against an integrated dev server. */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['STRUCTURE_E2E_CDP_PORT'] ?? 9445)
const profile = mkdtempSync(join(tmpdir(), 'furniture-structure-e2e-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' })
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

const source = JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8'))
const transform = { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }
const board = (id, x) => ({
  kind: 'board', id, name: id === 'board-a' ? 'Тақта A' : 'Тақта B',
  transform: { ...transform, pos: { x, y: 300, z: 1000 } },
  board: {
    materialId: source.materials[0].id, length: 600, width: 450,
    orientation: { length: 'x', width: 'y', thickness: 'z' },
    edges: { L1: null, L2: null, W1: null, W2: null },
    grainAlongLength: true, role: 'custom',
  },
})
const fixture = {
  schemaVersion: 4, name: 'Structure E2E', materials: source.materials,
  edgeBands: source.edgeBands, room: { width: 4000, depth: 3000, height: 2700 },
  root: { kind: 'group', id: 'root', name: 'Structure E2E', transform, children: [
    board('board-a', 400), board('board-b', 1200),
    { kind: 'group', id: 'group-target', name: 'Орналастыру тобы', transform, children: [] },
  ] },
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  // Inject before Workspace hydrates; leaving a mounted editor would flush its
  // old store on pagehide and overwrite the fixture during navigation.
  const injection = await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('furniture-configurator:project', ${JSON.stringify(JSON.stringify(fixture))})`,
  })
  await h.goto('/configurator', 7000)
  await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
  assert(await h.until("Boolean(document.querySelector('[data-testid=tree-dock] [data-tree-node=board-a]'))", 20000), 'canonical board tree missing')
  assert(await h.evaluate("document.querySelectorAll('[data-testid=tree-dock] [data-tree-node=board-a]').length === 1"), 'duplicate board tree')

  // Rename commits once; Ctrl+Z/Ctrl+Shift+Z restore the complete v4 tree.
  assert(await h.evaluate("(() => { const a=document.querySelector('[data-tree-node=board-a]'); if (!a) return false; a.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,detail:2})); return true })()"), 'rename gesture failed')
  assert(await h.until("Boolean(document.querySelector('[data-panel=structure] input[aria-label=\"Название\"]'))", 5000), 'rename input missing')
  assert(await h.evaluate("(() => { const input=document.querySelector('[data-panel=structure] input[aria-label=\"Название\"]'); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Тақта A жаңа'); input.dispatchEvent(new Event('input',{bubbles:true})); return true })()"), 'rename input failed')
  await h.wait(100)
  await h.evaluate("document.querySelector('[data-panel=structure] input[aria-label=\"Название\"]')?.blur()")
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.id==='board-a' && n.name==='Тақта A жаңа')", 10000), 'renamed board not persisted')
  await h.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))")
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.id==='board-a' && n.name==='Тақта A')", 10000), 'undo did not restore board name')
  await h.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true}))")
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.id==='board-a' && n.name==='Тақта A жаңа')", 10000), 'redo did not restore rename')

  assert(await h.evaluate("(() => { const row=document.querySelector('[data-tree-node=board-a]')?.parentElement; const b=row?.querySelector('[aria-label=\"Заблокировать\"]'); if (!b) return false; b.click(); return true })()"), 'lock control missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.id==='board-a' && n.locked===true)", 10000), 'node lock not persisted')
  assert(await h.evaluate("(() => { const row=document.querySelector('[data-tree-node=board-a]')?.parentElement; const b=row?.querySelector('[aria-label=\"Разблокировать\"]'); if (!b) return false; b.click(); return true })()"), 'unlock control missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.id==='board-a' && n.locked===false)", 10000), 'node unlock not persisted')

  // Select two free boards with Ctrl; grouping is a single persisted tree edit.
  assert(await h.evaluate("(() => { const a=document.querySelector('[data-tree-node=board-a]'); if (!a) return false; a.click(); return true })()"), 'board A cannot be selected')
  assert(await h.evaluate("document.querySelector('[data-tree-node=board-a]')?.parentElement?.getAttribute('aria-selected') === 'true'"), 'tree board selection missing')
  assert((await h.text()).includes('Выберите корпус в структуре проекта'), 'board selection still exposes cabinet editor')
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-tree-node=board-b]'); if (!b) return false; b.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true})); return true })()"), 'board B Ctrl-select failed')
  assert(await h.evaluate("document.querySelector('[data-tree-node=board-b]')?.parentElement?.getAttribute('aria-selected') === 'true'"), 'Ctrl selection did not retain second board')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-panel=structure] button')].find(x=>x.textContent.trim()==='Группа'); if (!b || b.disabled) return false; b.click(); return true })()"), 'Group control disabled after Ctrl selection')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.some(n=>n.kind==='group' && n.children.length===2)", 10000), 'group was not persisted')

  // Drag the new group into the pre-existing target group; core preserves world poses.
  assert(await h.evaluate("(() => { const p=JSON.parse(localStorage.getItem('furniture-configurator:project')); const group=p.root.children.find(n=>n.kind==='group' && n.children.length===2); const target=document.querySelector('[data-tree-node=group-target]')?.parentElement; if (!group || !target) return false; const transfer=new DataTransfer(); transfer.setData('text/plain',group.id); target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer})); target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer})); return true })()"), 'reparent drop failed')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.find(n=>n.id==='group-target')?.children.some(n=>n.kind==='group' && n.children.length===2)", 10000), 'group reparent was not persisted')

  // Ungroup keeps the boards in the same parent; one Undo restores the group.
  assert(await h.evaluate("(() => { const p=JSON.parse(localStorage.getItem('furniture-configurator:project')); const id=p.root.children.find(n=>n.id==='group-target')?.children.find(n=>n.kind==='group')?.id; const button=[...document.querySelectorAll('[data-tree-node]')].find(x=>x.dataset.treeNode===id); if (!button) return false; button.click(); return true })()"), 'reparented group cannot be selected')
  assert(await h.evaluate("(() => { const b=[...document.querySelectorAll('[data-panel=structure] button')].find(x=>x.textContent.trim()==='Разгруппировать'); if (!b || b.disabled) return false; b.click(); return true })()"), 'Ungroup control disabled')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.find(n=>n.id==='group-target')?.children.filter(n=>n.kind==='board').length === 2", 10000), 'ungroup did not keep both boards')
  await h.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))")
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.find(n=>n.id==='group-target')?.children.some(n=>n.kind==='group' && n.children.length===2)", 10000), 'ungroup undo did not restore the group')

  // Layer assignment and visibility must affect the same production model as tree hiding.
  const openLayers = "(() => { const tab=[...document.querySelectorAll('[data-testid=tree-dock] [role=tab]')].find(x=>x.textContent.trim()==='Слои'); if (!tab) return false; tab.click(); return true })()"
  assert(await h.evaluate(openLayers), 'Layers tab missing from the shared dock')
  assert(await h.evaluate("(() => { const input=document.querySelector('[data-testid=tree-dock] input[placeholder]'); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Tech'); input.dispatchEvent(new Event('input',{bubbles:true})); return true })()"), 'layer name input missing')
  await h.wait(100)
  assert(await h.evaluate("(() => { const input=document.querySelector('[data-testid=tree-dock] input[placeholder]'); const button=input?.closest('div.flex.items-end')?.querySelector('button'); if (!button || button.disabled) return false; button.click(); return true })()"), 'Create layer control disabled')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).layers?.some(l=>l.name==='Tech')", 10000), 'new layer was not persisted')
  assert(await h.evaluate("(() => { const row=[...document.querySelectorAll('[data-testid=tree-dock] select')].find(x=>x.closest('li')?.textContent.includes('Тақта B')); const layer=JSON.parse(localStorage.getItem('furniture-configurator:project')).layers.find(l=>l.name==='Tech'); if (!row || !layer) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(row,layer.id); row.dispatchEvent(new Event('change',{bubbles:true})); return true })()"), 'board B layer assignment control missing')
  assert(await h.until("(() => { const p=JSON.parse(localStorage.getItem('furniture-configurator:project')); return p.root.children.find(n=>n.id==='group-target')?.children[0]?.children.some(n=>n.id==='board-b' && n.layerId===p.layers.find(l=>l.name==='Tech')?.id) })()", 10000), 'board layer assignment was not persisted')
  const layerToggle = (index) => `(() => { const row=[...document.querySelectorAll('[data-testid=layers-list] > li')].find(x=>x.querySelector('input[aria-label="Название слоя"]')?.value==='Tech'); const input=row?.querySelectorAll('input[type=checkbox]')[${index}]; if (!input) return false; input.click(); return true })()`
  assert(await h.evaluate(layerToggle(0)), 'layer visibility toggle missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).layers?.some(l=>l.name==='Tech' && l.visible===false)", 10000), 'layer visibility was not persisted')
  await h.goto('/cut', 5000)
  assert(await h.until("document.querySelector('main[data-cut-panel-count]')?.getAttribute('data-cut-panel-count') === '1'", 15000), 'invisible layer still reached production')
  await h.goto('/configurator', 7000)
  assert(await h.until("Boolean(document.querySelector('[data-testid=tree-dock]'))", 10000), 'tree dock missing after layer reload')
  assert(await h.evaluate(openLayers), 'Layers tab missing after reload')
  assert(await h.evaluate(layerToggle(0)), 'layer visibility cannot be restored after reload')
  assert(await h.evaluate(layerToggle(1)), 'layer lock toggle missing')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).layers?.some(l=>l.name==='Tech' && l.visible===true && l.locked===true)", 10000), 'layer lock/visibility was not persisted')
  await h.goto('/configurator', 7000)
  assert(await h.until("document.querySelector('[data-tree-node=board-b]')?.disabled === true", 10000), 'layer lock did not protect its node after reload')
  assert(await h.evaluate(openLayers), 'Layers tab missing for unlock')
  assert(await h.evaluate(layerToggle(1)), 'layer could not be unlocked')
  assert(await h.until("JSON.parse(localStorage.getItem('furniture-configurator:project')).layers?.some(l=>l.name==='Tech' && l.locked===false)", 10000), 'layer unlock was not persisted')
  assert(await h.evaluate("(() => { const tab=[...document.querySelectorAll('[data-testid=tree-dock] [role=tab]')].find(x=>x.textContent.trim()==='Структура проекта'); if (!tab) return false; tab.click(); return true })()"), 'Structure tab missing after layer edit')

  // Hidden board remains in the tree, but production contains only the visible board.
  assert(await h.evaluate("(() => { const b=document.querySelector('[data-tree-node=board-b]'); const hide=b?.parentElement?.querySelector('[aria-label=\"Скрыть\"]'); if (!hide) return false; hide.click(); return true })()"), 'board B hide control missing')
  assert(await h.until("JSON.stringify(JSON.parse(localStorage.getItem('furniture-configurator:project')).root).includes('\"id\":\"board-b\"') && JSON.parse(localStorage.getItem('furniture-configurator:project')).root.children.find(n=>n.id==='group-target')?.children[0]?.children.some(n=>n.id==='board-b' && n.hidden===true)", 10000), 'hidden flag was not persisted')
  await h.goto('/cut', 5000)
  assert(await h.until("document.querySelector('main[data-cut-panel-count]')?.getAttribute('data-cut-panel-count') === '1'", 15000), 'cut page did not use visible board-only tree')
  await h.goto('/configurator', 7000)
  assert(await h.until("Boolean(document.querySelector('[data-tree-node=board-b]'))", 10000), 'hidden board disappeared from structure tree after reload')

  assert(await h.evaluate("(() => { const a=document.querySelector('[data-tree-node=board-a]'); const hide=a?.parentElement?.querySelector('[aria-label=\"Скрыть\"]'); if (!hide) return false; hide.click(); return true })()"), 'board A hide control missing')
  await h.goto('/cut', 5000)
  assert(await h.until("document.querySelector('main[data-cut-panel-count]')?.getAttribute('data-cut-panel-count') === '0'", 15000), 'hidden group children still counted in production')
  console.log('structure tree e2e: PASS')
} catch (error) {
  console.error('structure tree e2e: FAIL', error)
  process.exitCode = 1
} finally {
  session?.ws.close()
  if (chrome.exitCode === null) {
    const exited = new Promise((resolve) => chrome.once('exit', resolve))
    chrome.kill('SIGTERM')
    await Promise.race([exited, wait(5000)])
    if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([exited, wait(2000)]) }
  }
  rmSync(profile, { recursive: true, force: true })
}
