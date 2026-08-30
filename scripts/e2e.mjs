/**
 * Браузердегі тестер (E2E).
 *
 * Юнит-тестер ядроны тексереді, ал бұл — САЙТТЫҢ ӨЗІН: бет ашыла ма, батырма
 * жұмыс істей ме, деталировка жаңара ма, жоба сақтала ма. Тәуелділік жоқ:
 * Chrome-ды CDP арқылы басқарамыз (Node 22-нің өз WebSocket-і жеткілікті).
 *
 *   node scripts/e2e.mjs [http://localhost:3000]
 *
 * Chrome алдын ала қосулы болуы керек:
 *   google-chrome --headless=new --remote-debugging-port=9333 about:blank
 * немесе скрипт өзі қосады (CHROME=... арқылы жолын беруге болады).
 */

import { spawn } from 'node:child_process'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const PORT = 9333
const CHROME = process.env['CHROME'] ?? 'google-chrome'

// ── CDP қабығы ───────────────────────────────────────────────────────────────

let chrome = null

async function ensureChrome() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`)
    return
  } catch {
    // қосулы емес — өзіміз қосамыз
  }
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--window-size=1500,1000', 'about:blank',
  ], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`)
      return
    } catch { /* әлі көтерілмеді */ }
  }
  throw new Error('Chrome қосылмады')
}

async function connect() {
  const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = tabs.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const consoleErrors = []

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result)
      pending.delete(msg.id)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  }
  await new Promise((r) => { ws.onopen = r })

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id
      pending.set(i, resolve)
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false,
  })

  return { ws, send, consoleErrors }
}

// ── Тест қабығы ──────────────────────────────────────────────────────────────

const results = []
let current = null

async function test(name, fn) {
  current = { name, checks: [] }
  try {
    await fn()
    const failed = current.checks.filter((c) => !c.ok)
    results.push({ name, ok: failed.length === 0, failed })
  } catch (error) {
    results.push({ name, ok: false, failed: [{ message: `қате: ${error.message}` }] })
  }
}

function check(ok, message) {
  current.checks.push({ ok: Boolean(ok), message })
}

// ── Көмекшілер ───────────────────────────────────────────────────────────────

function makeHelpers({ send }) {
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    return r?.result?.value
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const goto = async (path, settleMs = 9000) => {
    await send('Page.navigate', { url: `${BASE}${path}` })
    await wait(settleMs)
  }

  const text = () => evaluate('document.body.innerText')

  const clickText = async (label, settleMs = 900) => {
    const done = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')]
        .find((x) => x.textContent.trim() === ${JSON.stringify(label)})
      if (!b) return false
      b.click()
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  const clickContains = async (label, settleMs = 900) => {
    const done = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')]
        .find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!b) return false
      b.click()
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  /** Деталировка кестесіндегі жолдар. */
  const cutListRows = () => evaluate(`(() => {
    const table = [...document.querySelectorAll('table')]
      .find((t) => t.textContent.includes('Наименование'))
    if (!table) return []
    return [...table.querySelectorAll('tbody tr')].map((r) =>
      [...r.children].map((c) => c.textContent.trim()))
  })()`)

  const setNumberByLabel = async (label, value, settleMs = 700) => {
    const done = await evaluate(`(() => {
      const l = [...document.querySelectorAll('label')]
        .find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!l) return false
      const i = l.querySelector('input[type=number]')
      if (!i) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, ${JSON.stringify(String(value))})
      i.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  return { evaluate, wait, goto, text, clickText, clickContains, cutListRows, setNumberByLabel }
}

// ── Тестер ───────────────────────────────────────────────────────────────────

async function run() {
  await ensureChrome()
  const session = await connect()
  const h = makeHelpers(session)

  // Тестер бір-бірінен ТӘУЕЛСІЗ болуы керек: алдыңғы жүгіріс сақтаған жоба
  // мен цех профилі жаңа жүгірісте эталон шкафты ауыстырып жіберер еді.
  await h.goto('/configurator', 6000)
  await h.evaluate('localStorage.clear()')

  await test('Лендинг ашылады', async () => {
    await h.goto('/', 7000)
    const body = await h.text()
    check(body.includes('Корпус, раскрой и цена'), 'басты тақырып бар')
    check(body.includes('Тарифы') || body.includes('тариф'), 'тарифтер бөлімі бар')
    check(body.includes('Деталировка'), 'нақты деталировка көрсетілген')
    const svg = await h.evaluate("document.querySelectorAll('svg[role=img]').length")
    check(svg > 0, `раскрой суреті салынған (${svg})`)
  })

  await test('Лендингтен конфигураторға өту', async () => {
    const clicked = await h.clickText('Открыть конфигуратор', 9000)
    check(clicked, 'батырма табылды')
    const url = await h.evaluate('location.pathname')
    check(url === '/configurator', `мекенжай /configurator (${url})`)
  })

  await test('Эталон шкаф: 6 позиция / 11 деталь', async () => {
    await h.goto('/configurator', 11000)
    const body = await h.text()
    check(body.includes('Позиций: 6'), 'позиция саны 6')
    check(body.includes('Деталей: 11'), 'деталь саны 11')
    const rows = await h.cutListRows()
    check(rows.length === 6, `кестеде 6 жол (${rows.length})`)
    check(rows.some((r) => r[0] === 'Боковина'), 'боковина бар')
  })

  await test('Габаритті өзгерту деталировканы қайта санайды', async () => {
    await h.setNumberByLabel('Высота (H)', 2200)
    const rows = await h.cutListRows()
    const side = rows.find((r) => r[0] === 'Боковина')
    check(side && side.includes('2200'), `боковина 2200 болды (${side?.join(' ')})`)
  })

  await test('Шаблон галереясы: ящикті комод', async () => {
    check(await h.clickText('Шаблоны', 1500), 'галерея ашылды')
    const cards = await h.evaluate(`[...document.querySelectorAll('button')]
      .filter((b) => b.querySelector('svg[role=img]')).length`)
    check(cards >= 30, `шаблон саны ${cards} (≥30)`)
    check(await h.clickContains('Комод 800', 2500), 'комод таңдалды')
    const rows = await h.cutListRows()
    check(rows.some((r) => r[0].includes('Фасад ящика')), 'деталировкада ящик фасады бар')
    check(rows.some((r) => r[0].includes('Дно ящика')), 'деталировкада ящик түбі бар')
  })

  await test('Жиынтық: бұрыштық шкаф екі корпус қояды', async () => {
    check(await h.clickText('Шаблоны', 1200), 'галерея ашылды')
    check(await h.clickText('Наборы', 1200), 'наборы табы ашылды')
    check(await h.clickContains('Угловой шкаф', 3000), 'жиынтық таңдалды')
    const body = await h.text()
    check(/корпусов: [2-9]/.test(body), `бірнеше корпус жүктелді (${body.match(/корпусов: \d+/)?.[0] ?? '—'})`)
  })

  await test('Смета: раскрой мен баға', async () => {
    check(await h.clickText('Смета', 3000), 'смета ашылды')
    const body = await h.text()
    check(body.includes('Листов всего'), 'парақ саны көрсетілген')
    check(/отход \d/.test(body), 'қалдық пайызы бар')
    check(await h.clickText('Стоимость', 1500), 'стоимость табы ашылды')
    const priced = await h.text()
    check(priced.includes('Итого клиенту'), 'қорытынды жол бар')
    check(priced.includes('Не заданы цены') || priced.includes('₸'), 'баға немесе ескерту көрсетілген')
    await h.clickText('Закрыть', 800)
  })

  await test('Цех профилі: баға сақталады', async () => {
    check(await h.clickText('Цех', 1200), 'цех терезесі ашылды')
    check(await h.clickText('Материалы', 900), 'материалдар табы')
    const filled = await h.evaluate(`(() => {
      const rows = [...document.querySelectorAll('tbody tr')]
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      let n = 0
      for (const r of rows) {
        const inputs = [...r.querySelectorAll('input[type=number]')]
        const last = inputs[inputs.length - 1]
        if (!last) continue
        setter.call(last, '28500')
        last.dispatchEvent(new Event('input', { bubbles: true }))
        n += 1
      }
      return n
    })()`)
    check(filled > 0, `${filled} материалға баға қойылды`)
    await h.wait(900)
    const stored = await h.evaluate(`(() => {
      const raw = localStorage.getItem('furniture-configurator:shop')
      if (!raw) return null
      const shop = JSON.parse(raw)
      return shop.materials.filter((m) => m.pricePerSheet > 0).length
    })()`)
    check(stored > 0, `профиль қоймаға жазылды (${stored} материал)`)
    await h.clickText('Закрыть', 800)
  })

  await test('Жоба бетті жаңартқанда жоғалмайды', async () => {
    await h.setNumberByLabel('Ширина (W)', 1234, 1200)
    const before = await h.evaluate(`(() => {
      const raw = localStorage.getItem('furniture-configurator:project')
      return raw ? JSON.parse(raw).cabinets.some((c) => c.width === 1234) : false
    })()`)
    check(before, 'жоба автосақталды')

    await h.goto('/configurator', 11000)
    const width = await h.evaluate(`(() => {
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Ширина (W)'))
      return l ? l.querySelector('input').value : null
    })()`)
    check(width === '1234', `жаңартудан кейін ені сақталды (${width})`)
  })

  await test('Бөлме: қабырғаға корпус қосу', async () => {
    check(await h.clickText('Стены', 1500), 'бөлме терезесі ашылды')
    // CSS `text-transform: uppercase` innerText-ке де әсер етеді, сондықтан
    // тіркес регистрсіз ізделеді.
    const count = () => h.evaluate(`(document.body.innerText.match(/Корпуса \\((\\d+)\\)/i) || [])[1]`)
    const before = await count()
    check(await h.clickText('+ корпус', 1500), 'корпус қосылды')
    const after = await count()
    check(Number(after) === Number(before) + 1, `корпус саны ${before} → ${after}`)
    await h.clickText('Закрыть', 800)
  })

  await test('Консольде қате жоқ', async () => {
    const real = session.consoleErrors.filter((e) => !/DevTools|favicon|THREE.Clock/.test(e))
    check(real.length === 0, `қате жоқ (${real.slice(0, 2).join(' | ') || 'таза'})`)
  })

  session.ws.close()
  if (chrome) process.kill(-chrome.pid)

  // ── Қорытынды ──────────────────────────────────────────────────────────────
  let failed = 0
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.name}`)
    } else {
      failed += 1
      console.log(`  ✗ ${r.name}`)
      for (const f of r.failed) console.log(`      ${f.message}`)
    }
  }
  console.log(`\n  ${results.length - failed}/${results.length} тест өтті`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('E2E құлады:', error)
  process.exit(1)
})
