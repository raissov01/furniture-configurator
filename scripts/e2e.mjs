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
  await send('Network.enable')
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

  /**
   * Ашық қалған терезені жабу. Бір тест құласа, келесілері оның
   * терезесіне тіреліп қалмауы керек — тестер бір-бірінен тәуелсіз.
   */
  const closeModals = async () => {
    for (let i = 0; i < 3; i += 1) {
      const closed = await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Закрыть')
        if (!b) return false
        b.click()
        return true
      })()`)
      if (!closed) return
      await wait(500)
    }
  }

  return { evaluate, wait, goto, text, clickText, clickContains, cutListRows, setNumberByLabel, closeModals }
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
  // Сессия cookie-і де тазаланады: алдыңғы жүгіріс кірген күйде қалдырса,
  // тіркелу тесті «шыққан» экранды таппай қалады.
  await session.send('Network.clearBrowserCookies')

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
    await h.closeModals()
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
    await h.closeModals()
    check(await h.clickText('Шаблоны', 1200), 'галерея ашылды')
    check(await h.clickText('Наборы', 1200), 'наборы табы ашылды')
    check(await h.clickContains('Угловой шкаф', 3500), 'жиынтық таңдалды')
    await h.closeModals()
    // Тақырыптағы белгі: «N панелей · корпусов: M».
    const body = await h.text()
    check(/корпусов: [2-9]/.test(body), `бірнеше корпус жүктелді (${body.match(/корпусов: \d+/)?.[0] ?? '—'})`)
  })

  await test('Нарисовать: перегородка, ящики, штанга', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    check(await h.clickText('Нарисовать', 1200), 'эскиз ашылды')

    const rect = await h.evaluate(`(() => {
      const s = document.querySelector('svg[aria-label="Эскиз корпуса"]')
      if (!s) return null
      const r = s.getBoundingClientRect()
      return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })
    })()`)
    check(rect, 'сурет салынды')
    if (!rect) return
    const box = JSON.parse(rect)
    const at = async (fx, fy) => {
      const x = box.x + box.w * fx
      const y = box.y + box.h * fy
      await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
      await h.wait(700)
    }
    const sections = () => h.evaluate(`(document.body.innerText.match(/Секции \\((\\d+)\\)/i) || [])[1]`)

    const before = await sections()
    await h.clickText('Перегородка', 500)
    await at(0.5, 0.5)
    const after = await sections()
    check(Number(after) === Number(before) + 1, `перегородка қосылды: ${before} → ${after}`)

    await h.clickText('Ящики', 500)
    await at(0.75, 0.7)
    await h.clickText('Закрыть', 900)
    const rows = await h.cutListRows()
    check(rows.some((r) => r[0].includes('ящика')), 'деталировкада ящик пайда болды')
  })

  await test('Бұрыштық (переходной) корпус', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    const pick = async (label, value, settle = 1500) => {
      const done = await h.evaluate(`(() => {
        const l = [...document.querySelectorAll('label')]
          .find((x) => x.textContent.includes(${JSON.stringify(label)}))
        if (!l) return false
        const sel = l.querySelector('select')
        if (!sel) return false
        const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(value)})
        if (!opt) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        setter.call(sel, opt.value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      await h.wait(settle)
      return done
    }

    check(await pick('Переходной корпус', 'yes'), 'бұрыштық режим қосылды')

    const rows = await h.cutListRows()
    check(rows.length > 0, `деталировка бар (${rows.length} жол)`)
    // ЕҢ БАСТЫСЫ: қосқан бойда қате шықпауы керек — UI шектеулерді өзі орындайды.
    const body = await h.text()
    check(!/арт қабырға|ілгек присадкасы|перегородка әзірге/i.test(body), 'валидация қатесі жоқ')

    // Бүйірлер әртүрлі тереңдікте: кестеде екі бөлек боковина болуы керек.
    const sides = rows.filter((r) => /Боковина/i.test(r[0] ?? ''))
    check(sides.length === 2, `екі түрлі боковина (${sides.length})`)

    // Бұрыштық режим фасадты алып тастайды әрі жоба автосақталады, сондықтан
    // күйді КЕЛЕСІ сценарийге қалдыруға болмайды.
    check(await h.clickText('Сброс', 2000), 'жоба ысырылды')
  })

  await test('Планка, фальш-панель, фартук', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    const before = await h.cutListRows()
    check(await h.clickText('+ Планка', 1500), 'планка қосылды')

    const pick = async (label, value, settle = 1200) => {
      const done = await h.evaluate(`(() => {
        const l = [...document.querySelectorAll('label')]
          .find((x) => x.textContent.includes(${JSON.stringify(label)}))
        if (!l) return false
        const sel = l.querySelector('select')
        if (!sel) return false
        const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(value)})
        if (!opt) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        setter.call(sel, opt.value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      await h.wait(settle)
      return done
    }

    check(await pick('Фартук', 'yes'), 'фартук қосылды')

    const after = await h.cutListRows()
    check(after.length > before.length, `деталировкаға түсті (${before.length} → ${after.length})`)
    const names = after.map((r) => r[0]).join(' | ')
    check(/Планка/i.test(names), 'кестеде «Планка» бар')
    check(/Фартук/i.test(names), 'кестеде «Фартук» бар')

    const body = await h.text()
    check(!/не помести|Ошибка/i.test(body), 'қате жоқ')
  })

  await test('Наполнение: техника мен механизм', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    const pick = async (label, value, settle = 1200) => {
      const done = await h.evaluate(`(() => {
        const l = [...document.querySelectorAll('label')]
          .find((x) => x.textContent.includes(${JSON.stringify(label)}))
        if (!l) return false
        const sel = l.querySelector('select')
        if (!sel) return false
        const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(value)})
        if (!opt) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        setter.call(sel, opt.value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      await h.wait(settle)
      return done
    }

    const before = await h.cutListRows()
    check(await pick('Наполнение', 'trousers'), 'брючница қосылды')
    check(await pick('Техника', 'oven'), 'духовка қосылды')

    const after = await h.cutListRows()
    // Ұя мен механизмнің ӨЗ панелі жоқ; айырма тек БӨЛГІШ сөрелерден.
    check(after.length >= before.length, `деталировка сынбады (${before.length} → ${after.length})`)
    const body = await h.text()
    check(!/Ошибка|не помести/i.test(body), 'валидация қатесі жоқ')

    check(await h.clickText('Смета', 3000), 'смета ашылды')
    check(await h.clickText('Стоимость', 1500), 'стоимость табы ашылды')
    // ТЕК терезенің ішін оқимыз: астындағы «Техника» селекті де «Духовка»
    // деп тұр, ал ол сметаның мазмұны емес.
    const quote = await h.evaluate(`(() => {
      const box = [...document.querySelectorAll('div')]
        .filter((e) => getComputedStyle(e).position === 'fixed')
        .find((e) => /Стоимость|Раскрой/.test(e.innerText))
      return box ? box.innerText : ''
    })()`)
    check(/Брючница/i.test(quote), 'механизм сметада бар')
    // ЕҢ БАСТЫСЫ: техниканы клиент өзі алады — ол КП-ға түспеуі керек.
    check(!/Духовка/i.test(quote), 'техника сметада ЖОҚ')
    await h.clickText('Закрыть', 700)
  })

  await test('Фасад фурнитурасы: өрнек, тұтқа, петля', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    // Селектті белгісі бойынша тауып, мәнін қоямыз.
    const pick = async (label, value, settle = 900) => {
      const done = await h.evaluate(`(() => {
        const l = [...document.querySelectorAll('label')]
          .find((x) => x.textContent.includes(${JSON.stringify(label)}))
        if (!l) return false
        const sel = l.querySelector('select')
        if (!sel) return false
        const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(value)}
          || o.text.trim() === ${JSON.stringify(value)})
        if (!opt) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        setter.call(sel, opt.value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      await h.wait(settle)
      return done
    }

    const before = await h.cutListRows()
    check(before.length > 0, `деталировка бар (${before.length} жол)`)

    check(await pick('Фрезеровка', 'grid'), 'өрнек таңдалды')
    const after = await h.cutListRows()
    // ЕҢ БАСТЫСЫ: өрнек — беттегі ойық, ол детальдің ӨЛШЕМІН өзгертпейді.
    check(
      JSON.stringify(after) === JSON.stringify(before),
      `деталировка ӨЗГЕРМЕДІ (${before.length} → ${after.length})`,
    )

    check(await pick('Ручка', 'handle-knob'), 'тұтқа кнопкаға ауысты')
    check(await pick('Петля', 'hinge-hettich-soft-cross-overlay'), 'петля бренді ауысты')

    const body = await h.text()
    check(/Межцентровое|Расположение|Глубина/.test(body), 'фурнитура өрістері көрінеді')

    // Смета жаңа фурнитураны көруі керек.
    check(await h.clickText('Смета', 3000), 'смета ашылды')
    const quote = await h.text()
    check(/Hettich/i.test(quote), 'сметада Hettich петлясы бар')
    await h.clickText('Закрыть', 700)
  })

  await test('Клиентке сілтеме: /view ашылады', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    check(await h.clickText('Ссылка клиенту', 1500), 'батырма басылды')
    const notice = await h.text()
    // Буферге жазу headless-те тыйылуы мүмкін — екі жағдайда да хабар шығады.
    check(/Ссылка скопирована|скопировать/i.test(notice), 'хабарлама шықты')

    // Бос хешпен ашылған /view ТҮСІНІКТІ қате беруі керек: клиент «бет
    // ашылмады» дегеннен басқа ештеңе көрмесе, цехқа қоңырау шалады.
    await h.goto('/view', 5000)
    const empty = await h.text()
    check(/Ссылка не открылась|нет проекта/i.test(empty), 'бос сілтемеде түсінікті қате')

    // Келесі сценарийлер конфигуратордың ашық тұрғанына сүйенеді.
    await h.goto('/configurator', 11000)
  })

  await test('Смета: раскрой мен баға', async () => {
    await h.closeModals()
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

  await test('Смета: қызметтер, коэффициент, фурнитура тізімі', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    check(await h.clickText('Смета', 3000), 'смета ашылды')
    check(await h.clickText('Стоимость', 1500), 'стоимость табы ашылды')

    const modal = () => h.evaluate(`(() => {
      const box = [...document.querySelectorAll('div')]
        .filter((e) => getComputedStyle(e).position === 'fixed')
        .find((e) => /Стоимость|Раскрой/.test(e.innerText))
      return box ? box.innerText : ''
    })()`)

    const body = await modal()
    check(/Листы по материалам/i.test(body), 'материал бойынша кесте бар')
    check(/Услуги цеха/i.test(body), 'қызметтер бөлімі бар')
    check(/Материалы, кромка, фурнитура/i.test(body), 'қорытынды жіктемесі бар')

    // Фурнитура тізімі бағасыз да шығуы керек — ол клиентке емес, цехқа.
    const btn = await h.evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Фурнитура')
      return b ? !b.disabled : null
    })()`)
    check(btn === true, `«Фурнитура» батырмасы белсенді (${btn})`)
    await h.clickText('Закрыть', 700)
  })

  await test('Цех профилі: баға сақталады', async () => {
    await h.closeModals()
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
    await h.closeModals()
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

  await test('Аккаунт: тіркелу, бұлтқа сақтау, қайта кіру', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    check(await h.clickText('Аккаунт', 1200), 'аккаунт терезесі ашылды')
    check(await h.clickText('Регистрация', 700), 'тіркелу табы')

    // Әр жүгірісте бөлек пошта: база тесттен кейін де қалады.
    const email = `e2e-${Math.floor(Date.now() / 1000)}@example.kz`
    const fill = async (label, value) => h.evaluate(`(() => {
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!l) return false
      const i = l.querySelector('input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, ${JSON.stringify('')} + ${JSON.stringify(value)})
      i.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await fill('Название цеха', 'Цех E2E')
    await fill('Почта', email)
    await fill('Пароль', 'password123')
    await h.wait(400)
    check(await h.clickText('Создать аккаунт', 2500), 'аккаунт жасалды')

    const body = await h.text()
    check(body.includes('Цех E2E'), 'цех аты көрінді')
    // CSS `uppercase` innerText-ке де әсер етеді — регистрсіз тексереміз.
    check(/Проекты в облаке/i.test(body), 'бұлттағы жобалар бөлімі')

    // ⚠ Кідіріс АЛЫС серверге есептелген: жоба сақталуы жергілікті машинада
    // 300 мс, ал VPS-те (тіркелу + профиль + тізім) секундтарға созылады.
    check(await h.clickText('Сохранить текущий', 5000), 'жоба сақталды')
    const saved = await h.text()
    check(!saved.includes('Пока пусто'), 'жоба тізімде пайда болды')

    check(await h.clickText('Выйти', 1500), 'шығу')
    check(await h.clickText('Вход', 600), 'кіру табы')
    await fill('Почта', email)
    await fill('Пароль', 'password123')
    await h.wait(400)
    check(await h.clickText('Войти', 2500), 'қайта кірді')
    const back = await h.text()
    check(back.includes('Цех E2E'), 'аккаунт қалпына келді')
    check(!back.includes('Пока пусто'), 'сақталған жоба орнында')
    await h.clickText('Закрыть', 700)
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
