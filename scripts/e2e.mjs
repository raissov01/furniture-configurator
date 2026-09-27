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
import { captureFailureSnapshot, makeHelpers, serializeCapture } from './e2eHelpers.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const PORT = Number(process.env['E2E_CDP_PORT'] ?? 9333)
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

  /*
   * ⚠ ТАЙМАУТ. Бұрын жауап келмесе `send` мәңгі күтетін: 09-13-те бір CDP
   * жауабы жоғалып, бүкіл жүгіріс 15+ минут қатып тұрды (бет тірі еді,
   * Node 0 % CPU-мен күтіп тұрды). Енді 60 с-тан кейін қате — тест құлайды
   * да, қай әрекет жауап бермегені хабарда көрінеді.
   */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id
      const timer = setTimeout(() => {
        pending.delete(i)
        reject(new Error(`CDP ${method} не ответил за 60 с`))
      }, 60_000)
      pending.set(i, (result) => { clearTimeout(timer); resolve(result) })
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

/** Құлаған тесттің скриншоты осында түседі — «неге таппады» көзбен көрінсін. */
const SHOT_DIR = process.env['E2E_SHOTS'] ?? '/tmp/e2e-shots'
let snapshot = null

async function test(name, fn) {
  const only = process.env['E2E_ONLY']
  if (only && !only.split('|').some((part) => name.includes(part))) return
  current = { name, checks: [] }
  try {
    await fn()
    const failed = current.checks.filter((c) => !c.ok)
    results.push({ name, ok: failed.length === 0, failed })
  } catch (error) {
    results.push({ name, ok: false, failed: [{ message: `қате: ${error.message}` }] })
  }
  const last = results[results.length - 1]
  console.log(`  ${last.ok ? '✓' : '✗'} ${results.length}: ${name}`, last.failed)
  if (!last.ok && snapshot) {
    const captured = await (current.shot ?? captureFailureSnapshot(() => snapshot(results.length)))
    if (captured.error) last.failed.push({ message: `скриншот алынбады: ${captured.error}` })
    if (captured.file) last.failed.push({ message: `скриншот: ${captured.file}` })
  }
}

function check(ok, message) {
  current.checks.push({ ok: Boolean(ok), message })
  // Бірінші құлаған тексерудің ШАМАСЫНДАҒЫ экран: тесттің соңында терезе
  // жабылып қалады да, «неге таппады» көрінбей кетеді. ⚠ Кадр асинхронды —
  // келесі 1–2 әрекет үлгеріп кетуі мүмкін, дәл сәт емес.
  if (!ok && snapshot && !current.shot) {
    current.shot = captureFailureSnapshot(() => snapshot(results.length + 1))
  }
}

// ── Көмекшілер ───────────────────────────────────────────────────────────────

// ── Тестер ───────────────────────────────────────────────────────────────────

async function run() {
  await ensureChrome()
  const session = await connect()
  const h = makeHelpers(session, BASE)
  const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs')
  snapshot = serializeCapture(async (n) => {
    const shot = await session.send('Page.captureScreenshot', { format: 'png' })
    if (!shot?.data) return null
    mkdirSync(SHOT_DIR, { recursive: true })
    const file = `${SHOT_DIR}/${String(n).padStart(2, '0')}.png`
    writeFileSync(file, Buffer.from(shot.data, 'base64'))
    return file
  })

  // Тестер бір-бірінен ТӘУЕЛСІЗ болуы керек: алдыңғы жүгіріс сақтаған жоба
  // мен цех профилі жаңа жүгірісте эталон шкафты ауыстырып жіберер еді.
  await h.goto('/configurator', 6000)
  await h.evaluate('localStorage.clear()')
  // Бұл ескі сценарийлер оң жақтағы тұрақты редакторды тексереді.
  // Жаңа әдепкі классикалық жұмыс орны бөлек e2e сценарийінде тексеріледі.
  await h.evaluate("localStorage.setItem('furniture-configurator:workspace-style', 'ours')")
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

  await test('AisMebel бренді: лендинг, manifest, классикалық жолақ және телефон', async () => {
    await h.goto('/', 7000)
    const landing = await h.evaluate(`(async () => {
      const manifest = await (await fetch('/manifest.webmanifest')).json()
      const mark = document.querySelector('header img[src="/brand/aismebel-mark.svg"]')
      const header = document.querySelector('header')
      return {
        title: document.title,
        text: document.body.innerText,
        manifest: manifest.name,
        shortName: manifest.short_name,
        markLoaded: Boolean(mark?.complete && mark.naturalWidth > 0),
        headerBlur: header && getComputedStyle(header).backdropFilter,
      }
    })()`)
    check(landing.title.includes('AisMebel'), 'лендинг title-ында AisMebel бар')
    check(landing.text.includes('AisMebel'), 'лендингте атау көрінеді')
    check(landing.manifest === 'AisMebel — мебель цехтарына' && landing.shortName === 'AisMebel', 'manifest атауы дұрыс')
    check(landing.markLoaded, 'лендинг логотипі жүктелді')
    check(landing.headerBlur === 'none', 'жолақта blur жоқ')
    check(Boolean(await snapshot('brand-landing')), 'лендинг скриншоты сақталды')

    await h.evaluate("localStorage.setItem('furniture-configurator:workspace-style', 'classic')")
    await h.goto('/configurator', 10000)
    await h.clickText('Пропустить', 100)
    const workspace = await h.evaluate(`(() => ({
      mark: (() => {
        const image = document.querySelector('[data-testid="brand-mark"]')
        return Boolean(image?.complete && image.naturalWidth > 0)
      })(),
      title: document.title,
    }))()`)
    check(workspace.mark && workspace.title.includes('AisMebel'), 'классикалық жұмыс орнында бренд белгісі бар')
    check(Boolean(await snapshot('brand-workspace')), 'классикалық жұмыс орнының скриншоты сақталды')
    await h.evaluate("localStorage.setItem('furniture-configurator:workspace-style', 'ours')")

    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    })
    try {
      await h.goto('/mobile', 7000)
      const mobile = await h.evaluate(`(() => ({
        brand: document.querySelector('[data-testid="brand"]')?.innerText,
        title: document.title,
      }))()`)
      check(mobile.brand?.includes('AisMebel') && mobile.title.includes('AisMebel'), 'телефон бетінде атау бар')
      check(Boolean(await snapshot('brand-mobile')), 'телефон скриншоты сақталды')
    } finally {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false,
      })
    }
    await h.goto('/', 7000)
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

  await test('3D: фурнитура көрінісі, тесік пен бекіткіш режимі', async () => {
    await h.goto('/configurator', 11000)
    await h.clickText('Пропустить', 100)
    check(await h.menu('Вид', 'Фурнитура: отверстия', 400), 'тесік режимі қосылды')
    check(await h.menu('Вид', 'Фурнитура: крепёж', 500), 'бекіткіш режимі қосылды')
    const explode = async (value) => {
      const opened = await h.evaluate(`(() => {
        const menu = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Вид ▾')
        if (!menu) return false
        menu.click()
        return true
      })()`)
      if (!opened) return false
      await h.wait(150)
      const changed = await h.evaluate(`(() => {
      const label = [...document.querySelectorAll('label')].find((entry) => entry.textContent.includes('Разнести'))
      const input = label?.querySelector('input[type="range"]')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(String(value))})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
      await h.wait(150)
      await h.evaluate(`(() => {
        const menu = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Вид ▾')
        menu?.click()
      })()`)
      return changed
    }
    check(await explode(0.65), 'жарылған көрініс қосылды')
    await h.wait(400)
    const image = await snapshot('fittings')
    check(Boolean(image), `бекіткіштер скриншоты сақталды (${image ?? 'жоқ'})`)
    check(await h.menu('Вид', 'Фурнитура: скрыть', 300), 'фурнитура жасырылды')
    const hiddenImage = await snapshot('fittings-hidden')
    check(Boolean(hiddenImage), 'жасырылған режимнің салыстыру скриншоты сақталды')
    check(await explode(0), 'жарылған көрініс өшірілді')
  })

  await test('Properties: конфирмат пен минификсті ауыстыру', async () => {
    check(await h.clickText('Производство', 150), 'өндіріс қосымшасы ашылды')
    const chooseJoint = async (value) => h.evaluate(`(() => {
      const label = [...document.querySelectorAll('label')]
        .find((entry) => entry.textContent.includes('Крепёж корпуса'))
      const select = label?.querySelector('select')
      if (!select) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, ${JSON.stringify(value)})
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    check(await chooseJoint('minifix'), 'минификс таңдалды')
    check(await h.until(`document.body.innerText.includes('Источник: этот корпус')`, 3000), 'шкаф override-ы көрінеді')
    check(await h.clickText('Открыть присадку', 400), 'жаңа присадка ашылды')
    check((await h.text()).includes('Минификс'), 'жаңа типтің тесіктері көрсетіледі')
    await h.closeModals()
    check(await chooseJoint('confirmat'), 'конфирматқа қайта ауысты')
  })

  await test('Габаритті өзгерту деталировканы қайта санайды', async () => {
    check(await h.clickText('Общее', 300), 'жалпы қасиеттер ашылды')
    check(await h.setNumberByLabel('Высота (H)', 2200), 'биіктік өрісі өзгертілді')
    const rows = await h.cutListRows()
    const side = rows.find((r) => r[0] === 'Боковина')
    check(side && side.includes('2200'), `боковина 2200 болды (${side?.join(' ')})`)
  })

  await test('Шаблон галереясы: ящикті комод', async () => {
    await h.closeModals()
    check(await h.menu('Создать', 'Готовые шаблоны', 1500), 'галерея ашылды')
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
    check(await h.menu('Создать', 'Готовые шаблоны', 1200), 'галерея ашылды')
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
    check(await h.menu('Создать', 'Нарисовать мышью', 1200), 'эскиз ашылды')

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

    // 6-сценарий екі корпусты жиынтықты қойған. Таңдалған бірінші корпус
    // екі түрлі бүйір береді; екінші корпустың жұп бүйірі үшінші позиция.
    // Кесте бүкіл жобаның деталировкасы, сондықтан оны бір корпус деп санауға болмайды.
    const sides = rows.filter((r) => /Боковина/i.test(r[0] ?? ''))
    const sideWidths = sides.map((r) => [Number(r[3]), Number(r[1])])
      .sort((a, b) => a[0] - b[0])
    check(JSON.stringify(sideWidths) === JSON.stringify([[300, 1], [447, 2], [600, 1]]),
      `бұрыштық және екінші корпустың бүйірлері (${JSON.stringify(sideWidths)})`)

    // Бұрыштық режим фасадты алып тастайды әрі жоба автосақталады, сондықтан
    // күйді КЕЛЕСІ сценарийге қалдыруға болмайды.
    check(await h.menu('Проект', 'Сброс', 2000), 'жоба ысырылды')
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

    check(await h.menu('Проект', 'Смета и раскрой', 3000), 'смета ашылды')
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
    check(await h.menu('Проект', 'Смета и раскрой', 3000), 'смета ашылды')
    const quote = await h.text()
    check(/Hettich/i.test(quote), 'сметада Hettich петлясы бар')
    await h.clickText('Закрыть', 700)
  })

  await test('Клиентке сілтеме: /view ашылады', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    check(await h.menu('Проект', 'Ссылка клиенту', 300), 'батырма басылды')
    // Буферге жазу headless-те тыйылуы мүмкін — екі жағдайда да хабар шығады,
    // бірақ уәде кешігіп орындалады.
    check(
      await h.until(`/Ссылка скопирована|скопировать/i.test(document.body.innerText)`, 8000),
      'хабарлама шықты',
    )

    // Бос хешпен ашылған /view ТҮСІНІКТІ қате беруі керек: клиент «бет
    // ашылмады» дегеннен басқа ештеңе көрмесе, цехқа қоңырау шалады.
    // Күту НӘТИЖЕ бойынша: дев-серверде /view алғаш компиляцияланғанда 5 с
    // «Открываем проект…» деп тұрады.
    await h.goto('/view', 1000)
    check(
      await h.until(`/Ссылка не открылась|нет проекта/i.test(document.body.innerText)`, 60000),
      'бос сілтемеде түсінікті қате',
    )

    // Келесі сценарийлер конфигуратордың ашық тұрғанына сүйенеді.
    await h.goto('/configurator', 11000)
    await h.sceneCenter(60000)
  })

  await test('Смета: раскрой мен баға', async () => {
    await h.closeModals()
    check(await h.menu('Проект', 'Смета и раскрой', 3000), 'смета ашылды')
    const body = await h.text()
    check(body.includes('Листов всего'), 'парақ саны көрсетілген')
    check(/отход \d/.test(body), 'қалдық пайызы бар')
    check(await h.clickText('Стоимость', 1500), 'стоимость табы ашылды')
    const priced = await h.text()
    check(['ВСЕГО', 'СКИДКА', 'К ОПЛАТЕ'].every((label) => priced.includes(label)), 'сома, жеңілдік және төлем қорытындысы бар')
    check(priced.includes('Не заданы цены') || priced.includes('₸'), 'баға немесе ескерту көрсетілген')
    await h.clickText('Закрыть', 800)
  })

  await test('Смета: қызметтер, коэффициент, фурнитура тізімі', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)

    check(await h.menu('Проект', 'Смета и раскрой', 3000), 'смета ашылды')
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
    check(await h.setNumberByLabel('Ширина (W)', 1234, 300), 'ені өзгертілді')
    // Автосақтау кейінге қалдырылады, ал ауыр сахнада (планка, фартук, AO)
    // тіркелген 1,2 с жетпей қалатын — күту НӘТИЖЕ бойынша.
    const before = await h.waitForSavedCabinetWidth(1234, 8000)
    const inputWidth = await h.numberValue('Ширина (W)')
    const saveDiagnostic = before ? '' : await h.evaluate("(() => { const file = JSON.parse(localStorage.getItem('furniture-configurator:project') || 'null'); const widths = []; const walk = (node) => { if (node?.kind === 'cabinet') widths.push(node.config.width); for (const child of node?.children || []) walk(child) }; walk(file?.root); return JSON.stringify({ widths, alerts: [...document.querySelectorAll('[role=alert]')].map((item) => item.textContent?.slice(0, 120)) }) })()")
    check(before, `жоба автосақталды (өріс: ${inputWidth}; ${saveDiagnostic})`)

    await h.goto('/configurator', 11000)
    const restored = await h.waitForNumber('Ширина (W)', '1234')
    const width = await h.numberValue('Ширина (W)')
    check(restored && width === '1234', `жаңартудан кейін ені сақталды (${width})`)
  })

  await test('3D: таңдалған модульді сүйреп жылжыту, бір undo', async () => {
    await h.closeModals()
    const offset = () => h.evaluate(`(() => {
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Смещение'))
      return l?.querySelector('input[type=number]')?.value ?? null
    })()`)
    const box = await h.sceneCenter()
    const mouse = (type, x, y, buttons) => session.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1,
    })
    // Бірінші басу — детальді таңдау (таңдалмаған модуль сүйрелмейді).
    await mouse('mouseMoved', box.x, box.y, 0)
    await mouse('mousePressed', box.x, box.y, 1)
    await mouse('mouseReleased', box.x, box.y, 0)
    check(await h.until(`document.body.innerText.includes('Рез · цех:')`, 5000), 'деталь таңдалды')
    const before = await offset()
    check(before !== null, `оң панельде «Смещение» бар: ${before}`)

    // Сүйреу: 5 қадам × 16 px. Swiftshader-де әр кадр ~5 с, яғни қадамдар 500 мс
    // coalesce терезесінен сирек — undo бәрібір БІР қадам болуы керек (бір қимыл).
    await mouse('mousePressed', box.x, box.y, 1)
    for (let i = 1; i <= 5; i += 1) {
      await mouse('mouseMoved', box.x - i * 16, box.y, 1)
      await h.wait(40)
    }
    await mouse('mouseReleased', box.x - 80, box.y, 0)
    await h.wait(1500)
    const after = await offset()
    check(after !== null && after !== before, `модуль жылжыды: ${before} → ${after}`)
    // 80 px — қабырға бойымен бірнеше жүз мм. Метрлер — жазықтық/камера ақауы.
    check(Math.abs(Number(after) - Number(before)) <= 1000, `курсордан озып кетпеді: ${before} → ${after}`)
    check(Number.isInteger(Number(after)), `орны бүтін мм: ${after}`)
    check(await h.until(`document.body.innerText.includes('Рез · цех:')`, 2000), 'сүйреуден кейін таңдау қалды')

    await h.evaluate(`document.querySelector('button[title="Ctrl+Z"]')?.click()`)
    await h.wait(600)
    check(await offset() === before, `бір undo бастапқы орынға қайтарды: ${await offset()} (күтілгені ${before})`)
  })

  await test('Бөлме: қабырғаға корпус қосу', async () => {
    await h.closeModals()
    check(await h.menu('Проект', 'Стены и комната', 1500), 'бөлме терезесі ашылды')
    // CSS `text-transform: uppercase` innerText-ке де әсер етеді, сондықтан
    // тіркес регистрсіз ізделеді.
    const count = () => h.evaluate(`(document.body.innerText.match(/Корпуса \\((\\d+)\\)/i) || [])[1]`)
    const before = await count()
    check(await h.clickText('+ корпус', 1500), 'корпус қосылды')
    const after = await count()
    check(Number(after) === Number(before) + 1, `корпус саны ${before} → ${after}`)
    await h.clickText('Закрыть', 800)
  })

  const ownerEmail = `e2e-${Math.floor(Date.now() / 1000)}@example.kz`

  await test('Аккаунт: тіркелу, бұлтқа сақтау, қайта кіру', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    const projectName = await h.evaluate(`JSON.parse(localStorage.getItem('furniture-configurator:project')).name`)
    const cloudProjects = () => h.retryTransientFetch(() => h.evaluate(`(async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('GET /api/projects: ' + res.status)
      return (await res.json()).projects
    })()`))
    check(await h.clickText('Аккаунт', 1200), 'аккаунт терезесі ашылды')
    check(await h.clickText('Регистрация', 700), 'тіркелу табы')

    // Әр жүгірісте бөлек пошта: база тесттен кейін де қалады.
    // Келесі тест (команда) ДӘЛ ОСЫ иенің атынан кіреді.
    const email = ownerEmail
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
    check(await h.clickText('Создать аккаунт', 800), 'аккаунт жасалды')

    const shown = await h.until(`document.body.innerText.includes('Цех E2E')`)
    // Құласа — терезеде НЕ тұрғаны хабарда көрінсін (сервердің қатесі т.б.).
    const modalText = shown ? '' : await h.evaluate(
      `(document.querySelector('.fixed.inset-0.z-50')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 200)`,
    )
    check(shown, `цех аты көрінді${modalText ? ` (терезеде: ${modalText})` : ''}`)
    const body = await h.text()
    // CSS `uppercase` innerText-ке де әсер етеді — регистрсіз тексереміз.
    check(/Проекты в облаке/i.test(body), 'бұлттағы жобалар бөлімі')

    // ⚠ Кідіріс АЛЫС серверге есептелген: жоба сақталуы жергілікті машинада
    // 300 мс, ал VPS-те (тіркелу + профиль + тізім) секундтарға созылады.
    // Тіркелгеннен кейін профиль мен тізім жүктелгенше батырма `disabled`:
    // оны басу үнсіз өтеді де, сұраныс мүлде кетпейді. Белсенді болғанын күтеміз.
    check(
      await h.until(`[...document.querySelectorAll('button')]
        .some((b) => b.textContent.trim() === 'Сохранить текущий' && !b.disabled)`),
      '«Сохранить текущий» белсенді',
    )
    check(await h.clickText('Сохранить текущий', 800), 'жоба сақталды')
    check(
      await h.waitForCloudProject(projectName),
      'жоба тізімде пайда болды',
    )

    const savedProjects = await cloudProjects()
    const savedId = savedProjects.find((p) => p.name === projectName)?.id
    check(savedProjects.length === 1 && typeof savedId === 'string', 'серверде нақты бір жоба сақталған')

    check(await h.clickText('Выйти', 300), 'шығу')
    // Шығу — сервер сұранысы, содан кейін ғана терезе «Вход/Регистрация»
    // табына ауысады. Тіркелген 1,5 с дев-серверде жетпей қалатын.
    check(
      await h.until(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Вход')`),
      'шыққан экран көрінді',
    )
    check(await h.clickText('Вход', 600), 'кіру табы')
    await fill('Почта', email)
    await fill('Пароль', 'password123')
    await h.wait(400)
    check(await h.clickText('Войти', 800), 'қайта кірді')
    check(await h.until(`document.body.innerText.includes('Цех E2E')`), 'аккаунт қалпына келді')
    check(
      await h.waitForCloudProject(projectName),
      'сақталған жоба орнында',
    )
    const reopenedProjects = await cloudProjects()
    check(typeof savedId === 'string' && reopenedProjects.some((p) => p.id === savedId && p.name === projectName),
      'қайта кіргенде сервердегі жоба ID-і сақталды')
    await h.clickText('Закрыть', 700)
  })

  /*
   * КОМАНДА: шақыру → қосылу → шығару.
   *
   * Алдыңғы тест цехтың ИЕСІ болып кірген күйде бітеді, сондықтан осында
   * шақыруды сол жасайды. Тексерілетіні — шығарудың ТОЛЫҚ шынжыры: адам
   * тізімнен кетеді, ал оның сілтемесі қайта ашылмайды.
   */
  await test('Команда: шақыру, қосылу, цехтан шығару', async () => {
    await h.closeModals()
    check(await h.clickText('Аккаунт', 1200), 'аккаунт терезесі ашылды')
    // «Пригласить» те `disabled={busy}`: кіргеннен кейін профиль мен тізім
    // жүктелгенше басу үнсіз өтеді. Белсенді болғанын, сосын сілтемені күтеміз.
    check(
      await h.until(`[...document.querySelectorAll('button')]
        .some((b) => b.textContent.trim() === 'Пригласить' && !b.disabled)`),
      '«Пригласить» белсенді',
    )
    check(await h.clickText('Пригласить', 300), 'шақыру жасалды')
    await h.until(`[...document.querySelectorAll('input[readonly]')].some((x) => x.value.includes('invite='))`)
    const link = await h.evaluate(`(() => {
      const i = [...document.querySelectorAll('input[readonly]')].find((x) => x.value.includes('invite='))
      return i ? i.value : null
    })()`)
    check(typeof link === 'string', 'шақыру сілтемесі көрінді')
    check(await h.clickText('Выйти', 1500), 'иесі шықты')
    await h.closeModals()

    // Шақырумен келген адам ЖАҢА цех ашпайды — барына қосылады.
    const worker = `worker-${Date.now()}@example.kz`
    await session.send('Page.navigate', { url: link })
    check(await h.until(`Boolean(document.querySelector('input[type=email]')) &&
      [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Создать аккаунт')`, 30000),
    'шақыру сілтемесіндегі тіркелу формасы дайын')
    const fill = async (label, value) => h.evaluate(`(() => {
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!l) return false
      const i = l.querySelector('input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, ${JSON.stringify('')} + ${JSON.stringify(value)})
      i.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check(await fill('Почта', worker), 'жұмысшының поштасы енгізілді')
    check(await fill('Пароль', 'password123'), 'жұмысшының паролі енгізілді')
    await h.wait(400)
    check(await h.until(`document.querySelector('input[type=email]')?.value === ${JSON.stringify(worker)}`),
      'жұмысшы поштасы формада сақталды')
    check(await h.clickText('Создать аккаунт', 800), 'жұмысшы қосылды')
    check(await h.until(`document.body.innerText.includes('Цех E2E')`, 30000), 'жұмысшы шақырылған цехқа кірді')
    /*
     * Команда тізімі БӨЛЕК сұраныспен келеді. Мәтіннен іздеу жарамайды:
     * терезенің басында аккаунттың ӨЗ поштасы тұр, сондықтан «пошта бар»
     * дегені тізім келді дегенді білдірмейді. Жолдардың ӨЗІН күтеміз.
     */
    check(
      await h.until(`[...document.querySelectorAll('li')]
        .filter((x) => x.textContent.includes('@')).length >= 2`),
      'тізімде екі адам',
    )
    check((await h.text()).includes('Цех E2E'), 'бөтен цех емес, БАР цехқа кірді')

    // Қатардағы адамның өз жолында «Уйти» тұрады, ал иесінде ештеңе жоқ.
    const labels = await h.evaluate(`(() => {
      const rows = [...document.querySelectorAll('li')].filter((x) => x.textContent.includes('@'))
      return rows.map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent.trim()).join(','))
    })()`)
    check(JSON.stringify(labels).includes('Уйти'), `өз жолында «Уйти» (${JSON.stringify(labels)})`)

    // Иесі қайта кіріп, жұмысшыны шығарады: екі басу — сұрақ, сосын әрекет.
    check(await h.clickText('Выйти', 300), 'жұмысшы шықты')
    await h.until(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Вход')`)
    await h.clickText('Вход', 600)
    await fill('Почта', ownerEmail)
    await fill('Пароль', 'password123')
    // «Войти» тек `mode === 'login'` кезінде бар. Шақырумен ашылған бетте
    // терезе «Регистрация»-дан басталады, сондықтан таб ауысқанын күтеміз;
    // келмесе — терезеде не тұрғаны хабарда көрінсін.
    const loginReady = await h.until(`[...document.querySelectorAll('button')]
      .some((b) => b.textContent.trim() === 'Войти')`, 8000)
    const loginModal = loginReady ? '' : await h.evaluate(
      `(document.querySelector('.fixed.inset-0.z-50')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 200)`,
    )
    check(await h.clickText('Войти', 800), `иесі қайта кірді${loginModal ? ` (терезеде: ${loginModal})` : ''}`)
    /*
     * Батырма ПАЙДА БОЛҒАНЫ жеткіліксіз: сұраныстар бітпей тұрғанда ол әлі
     * `disabled`, ал өшірулі батырманы басу үнсіз өтеді де, тест жалған
     * «бастым» деп есептейді. Сондықтан белсенді болғанын күтеміз.
     */
    check(
      await h.until(`[...document.querySelectorAll('button')]
        .some((b) => b.textContent.trim() === 'Убрать' && !b.disabled)`, 30000),
      '«Убрать» белсенді',
    )
    check(await h.clickText('Убрать', 600), 'шығару сұралды')
    check(await h.clickText('Точно?', 800), 'шығару расталды')
    check(
      await h.until(`!document.body.innerText.includes(${JSON.stringify(worker)})`),
      'жұмысшы тізімнен кетті',
    )
    await h.closeModals()
  })

  /*
   * ЖИНАУ ҚАДАМЫ: сахна да, «Жоба» терезесіндегі тізім де БІР ретті көреді.
   * Тексерілетіні — сол байланыс: тізімдегі жолды бассаң, тақтадағы қадам
   * дәл сол нөмір болады.
   */
  await test('Сборка по шагам: тізім мен 3D бір ретте', async () => {
    await h.closeModals()
    check(await h.clickText('Сборка', 900), 'жинау режимі қосылды')
    const slider = await h.evaluate(`(() => {
      // Тақтада «Разнести» слайдері де бар — өзімізді aria-label-мен табамыз.
      const i = document.querySelector('input[aria-label="Показать сборку по шагам"]')
      return i ? { max: Number(i.max), value: Number(i.value) } : null
    })()`)
    check(slider !== null, 'қадам слайдері шықты')
    check(slider && slider.value === 1, 'бірінші қадамнан басталады')
    // Осы кезде жобада бірнеше корпус тұр — қадам саны ЖОБА бойынша.
    check(slider && slider.max > 1, `слайдердің шегі — деталь саны (${slider?.max})`)

    check(await h.menu('Проект', 'Материалы и сборка', 800), '«Жоба» терезесі ашылды')
    // Терезедегі «Сборка» табы (тақтадағы батырма емес — ол қосулы тұр).
    const tab = await h.evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50')
      if (!modal) return false
      const b = [...modal.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Сборка')
      if (!b) return false
      b.click()
      return true
    })()`)
    check(tab, 'жинау табы ашылды')
    await h.wait(500)

    const clicked = await h.evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50')
      const rows = [...modal.querySelectorAll('button[data-step]')]
      if (rows.length < 3) return 0
      rows[2].click()
      return rows.length
    })()`)
    // Тізімдегі жол саны мен слайдердің шегі БІР болуы керек: екеуі де бір
    // ретті көрсетеді.
    check(clicked === slider?.max, `тізімдегі жол саны слайдермен бірдей (${clicked} / ${slider?.max})`)
    await h.wait(400)
    await h.closeModals()

    const after = await h.evaluate(
      `Number(document.querySelector('input[aria-label="Показать сборку по шагам"]').value)`,
    )
    check(after === 3, `үшінші жолды басқанда қадам да үшінші (${after})`)

    // Режимді сөндіріп кетеміз: келесі тестер ТОЛЫҚ шкафты көруі керек.
    check(await h.clickText('Сборка', 700), 'жинау режимі сөнді')
    const off = await h.evaluate(
      `document.querySelector('input[aria-label="Показать сборку по шагам"]') === null`,
    )
    check(off, 'слайдер жоғалды')
  })

  await test('Жеке кітапхана: сақтау, категория, іздеу, қою және қайта ашу', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    await h.closeModals()
    const opened = await h.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[data-testid="tree-dock"] [role="tab"]')]
        .find((node) => node.textContent.trim() === 'Библиотека')
      tab?.click()
      return Boolean(tab)
    })()`)
    check(opened, 'кітапхана редакторда ашылды')
    const filled = await h.evaluate(`(() => {
      const field = document.querySelector('[data-testid="tree-dock"] input[aria-label="Категория"]')
      if (!field) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(field, 'E2E жиһаз')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check(filled, 'категория енгізілді')
    await h.wait(200)
    const saved = await h.evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-testid="tree-dock"] button')]
        .find((node) => node.textContent.trim() === 'Сохранить в библиотеку')
      if (!button || button.disabled) return false
      button.click()
      return true
    })()`)
    check(saved, 'түйін кітапханаға сақталды')
    await h.wait(350)
    const library = await h.evaluate(`(() => {
      const value = localStorage.getItem('furniture-configurator:library-v1')
      return value ? JSON.parse(value) : null
    })()`)
    check(library?.schemaVersion === 1 && library.items?.length === 1, 'v1 JSON жергілікті сақталды')
    check(library?.items?.[0]?.category === 'E2E жиһаз', 'категория сақталды')
    const categoryFound = await h.evaluate(`(() => {
      const filter = document.querySelector('[data-testid="tree-dock"] select[aria-label="Фильтр категории"]')
      if (!filter) return false
      filter.value = 'E2E жиһаз'
      filter.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    check(categoryFound, 'категория сүзгісі табылды')
    const searched = await h.evaluate(`(() => {
      const field = document.querySelector('[data-testid="tree-dock"] input[aria-label="Поиск в библиотеке"]')
      if (!field) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(field, 'E2E жиһаз')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check(searched, 'іздеу енгізілді')
    await h.wait(200)
    const partsBefore = await h.evaluate(`Number(document.querySelector('header span[title^="Бюджет:"]')
      ?.textContent.match(/^(\\d+) панелей/)?.[1] ?? 0)`)
    const placed = await h.evaluate(`(() => {
      const dock = document.querySelector('[data-testid="tree-dock"]')
      const preview = dock?.querySelector('svg[aria-label="Предпросмотр элемента"]')
      const button = [...(dock?.querySelectorAll('button') ?? [])]
        .find((node) => node.textContent.trim() === 'Поставить')
      button?.click()
      return { preview: Boolean(preview), placed: Boolean(button) }
    })()`)
    check(placed.preview, 'өлшемнен жасалған нобай көрсетілді')
    check(placed.placed, 'кітапхана элементі жобаға қойылды')
    await h.wait(700)
    const partsAfter = await h.evaluate(`Number(document.querySelector('header span[title^="Бюджет:"]')
      ?.textContent.match(/^(\\d+) панелей/)?.[1] ?? 0)`)
    check(partsAfter > partsBefore, `жаңа түйін деталировкаға түсті (${partsBefore} → ${partsAfter} деталь)`)
    await h.goto('/configurator', 11000)
    const persisted = await h.evaluate(`JSON.parse(localStorage.getItem('furniture-configurator:library-v1')).items.length`)
    check(persisted === 1, 'қайта ашқанда жеке кітапхана сақталды')
  })

  await test('Базис кітапханасы: Кухня және Gola санаттары көрінеді', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    check(await h.until(`Boolean(document.querySelector('select[aria-label="Стиль рабочего места"]'))`, 20000),
      'редактор толық жүктелді')
    await h.evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Стиль рабочего места"]')
      if (select?.value !== 'ours') {
        select.value = 'ours'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })()`)
    check(await h.until(`Boolean([...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Библиотека'))`, 10000), 'кітапхана құралы көрінді')
    await h.clickText('Пропустить', 150)
    check(await h.clickText('Библиотека', 350), 'кітапхана ашылды')
    check(await h.until(`Boolean(document.querySelector('[data-testid="tree-dock"] input[placeholder="Найти категорию"]'))`, 10000),
      'категория іздеуі ашылды')
    const categorySearch = await h.evaluate(`(() => {
      const field = document.querySelector('[data-testid="tree-dock"] input[placeholder="Найти категорию"]')
      if (!field) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(field, 'Базис:')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check(categorySearch, 'Базис санаттары сүзілді')
    check(await h.until(`Boolean([...document.querySelectorAll('[data-testid="tree-dock"] select')]
      .find((select) => [...select.options].some((option) => option.value === 'Базис: Кухня')))`, 10000),
      'Базис санаттары жүктелді')
    const categories = await h.evaluate(`(() => {
      const selects = [...document.querySelectorAll('[data-testid="tree-dock"] select')]
      const category = selects.find((select) => [...select.options].some((option) => option.value === 'Базис: Кухня'))
      return category ? [...category.options].map((option) => option.value) : []
    })()`)
    check(categories.includes('Базис: Кухня') && categories.includes('Базис: Gola'), 'екі Basis санаты бар')
    const selected = await h.evaluate(`(() => {
      const category = [...document.querySelectorAll('[data-testid="tree-dock"] select')]
        .find((select) => [...select.options].some((option) => option.value === 'Базис: Кухня'))
      if (!category) return false
      category.value = 'Базис: Кухня'
      category.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    check(selected, 'Кухня сүзгісі таңдалды')
    check(await h.until(`Boolean([...document.querySelectorAll('[data-testid="tree-dock"] button')]
      .find((button) => button.textContent.includes('(H) ×') && button.textContent.includes('(W) ×')))`, 7000),
      'модуль өлшемі H × W × D болып көрінді')
    const materialTab = await h.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[data-testid="tree-dock"] button')]
        .find((button) => button.textContent.trim() === 'Материалы')
      tab?.click()
      return Boolean(tab)
    })()`)
    check(materialTab, 'Базис материалдары ашылды')
    const added = await h.evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-testid="tree-dock"] button')]
        .find((entry) => entry.textContent.trim() === 'Добавить в цех' && !entry.disabled)
      button?.click()
      return Boolean(button)
    })()`)
    check(added, 'материал цех каталогына таңдалды')
    check(await h.until(`Boolean([...document.querySelectorAll('[data-testid="tree-dock"] button')]
      .find((button) => button.textContent.trim() === 'Уже в цехе' && button.disabled))`, 7000),
      'материал қайталап қосылмайды')
  })

  await test('Визуал: PBR, жарық және 360° панорама', async () => {
    await h.closeModals()
    await h.goto('/configurator', 11000)
    check(await h.clickText('Рендер', 500), 'рендер терезесі ашылды')
    const materialTab = await h.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((entry) => entry.textContent.trim() === 'Материал')
      tab?.click(); return Boolean(tab)
    })()`)
    check(materialTab, 'PBR материалының табы ашылды')
    const materialId = await h.evaluate(`document.querySelector('select[aria-label="Материал для PBR"]')?.value ?? ''`)
    const changed = await h.evaluate(`(() => {
      const label = [...document.querySelectorAll('label')]
        .find((entry) => entry.textContent.includes('Шероховатость'))
      const field = label?.querySelector('input')
      if (!field) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(field, '0.34')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check(changed, 'roughness енгізілді')
    await h.wait(150)
    check(await h.clickText('Сохранить вид материала', 400), 'PBR сақталды')
    const lightsTab = await h.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((entry) => entry.textContent.trim() === 'Свет')
      tab?.click(); return Boolean(tab)
    })()`)
    check(lightsTab, 'жарық табы ашылды')
    check(await h.clickText('Добавить Точечный', 300), 'нүктелік жарық қосылды')
    await h.wait(700)
    const savedVisual = await h.evaluate(`(() => {
      const project = JSON.parse(localStorage.getItem('furniture-configurator:project'))
      return { roughness: project.materials.find((entry) => entry.id === ${JSON.stringify(materialId)})?.pbr?.roughness,
        lights: project.lights }
    })()`)
    check(savedVisual.roughness === 0.34, 'PBR v4 жобаға сақталды')
    check(savedVisual.lights?.length === 1 && savedVisual.lights[0].kind === 'point', 'жарық v4 жобаға сақталды')
    const renderTab = await h.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((entry) => entry.textContent.trim() === 'Рендер')
      tab?.click(); return Boolean(tab)
    })()`)
    check(renderTab, 'рендер табы ашылды')
    check(await h.clickText('Панорама 360°', 100), 'панорама сұралды')
    check(await h.until(`Boolean(document.querySelector('a[download="panorama-360.png"]'))`, 30000), 'PNG дайын болды')
    const png = await h.evaluate(`(async () => {
      const link = document.querySelector('a[download="panorama-360.png"]')
      if (!link || !link.href.startsWith('data:image/png;base64,')) return null
      const image = new Image()
      image.src = link.href
      await image.decode()
      return { width: image.naturalWidth, height: image.naturalHeight }
    })()`)
    check(png?.width === 2048 && png?.height === 1024, `нақты 2:1 PNG (${png?.width} × ${png?.height})`)
    await h.closeModals()
    await h.goto('/configurator', 11000)
    const reloaded = await h.evaluate(`(() => {
      const project = JSON.parse(localStorage.getItem('furniture-configurator:project'))
      return { roughness: project.materials.find((entry) => entry.id === ${JSON.stringify(materialId)})?.pbr?.roughness,
        lightCount: project.lights?.length }
    })()`)
    check(reloaded.roughness === 0.34 && reloaded.lightCount === 1, 'қайта ашқанда PBR мен жарық сақталды')
  })

  await test('Импорт докы: қате DXF және өндірістік тақта', async () => {
    await h.closeModals()
    await h.goto('/configurator', 9000)
    await h.clickText('Пропустить', 150)
    check(await h.clickText('Открыть Импорт', 500), 'импорт докы ашылды')
    check(await h.clickText('Деталь / модель', 300), 'деталь импорты ашылды')
    const attach = async (name, data) => h.evaluate(`(() => {
      const input = document.querySelector('[data-dock-panel="import"] input[type=file][accept*=".obj"]')
      if (!input) return false
      const transfer = new DataTransfer()
      transfer.items.add(new File([${JSON.stringify(data)}], ${JSON.stringify(name)}, { type: 'text/plain' }))
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    check(await attach('bad.dxf', 'broken'), 'бұрыс DXF жіберілді')
    check(await h.until(`Boolean(document.querySelector('[data-dock-panel="import"] [role="alert"]'))`, 5000), 'қате файлдың хабарламасы көрсетілді')
    const dxf = readFileSync(new URL('../tests/fixtures/dxf-board-rect.dxf', import.meta.url), 'utf8')
    check(await attach('shelf.dxf', dxf), 'дұрыс DXF жіберілді')
    check(await h.until(`Boolean(document.querySelector('[data-dock-panel="import"] button:not([disabled])') &&
      document.querySelector('[data-dock-panel="import"]').innerText.includes('600 мм × 300 мм'))`, 5000), 'тақта габариті алдын ала көрінді')
    const submit = await h.evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-dock-panel="import"] button')]
        .find((entry) => entry.textContent.trim() === 'Добавить в проект' && !entry.disabled)
      button?.click()
      return Boolean(button)
    })()`)
    check(submit, 'тақта жобаға қосылды')
    check(await h.clickText('Сохранить', 300), 'импортталған жоба сақталды')
    const added = await h.until(`(() => {
      const raw = localStorage.getItem('furniture-configurator:project')
      if (!raw) return false
      const root = JSON.parse(raw).root
      return root?.children?.some((node) => node.kind === 'board' && node.name === 'shelf' && node.board.length === 600)
    })()`, 8000)
    check(added, 'импортталған тақта v4 ағашта сақталды')
  })

  await test('Мобильді раскрой: экспорт тобы ашылып жабылады', async () => {
    await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await h.goto('/cut', 7000)
    check(await h.until("Boolean(document.querySelector('button[aria-controls=\"cut-export-actions\"]'))", 15000), 'экспорт батырмасы бар')
    const state = () => h.evaluate(`(() => {
      const toggle = document.querySelector('button[aria-controls="cut-export-actions"]')
      const actions = document.getElementById('cut-export-actions')
      const basis = [...(actions?.querySelectorAll('button') ?? [])].find((button) => button.textContent.trim() === 'Базис')
      const rect = basis?.getBoundingClientRect()
      return { expanded: toggle?.getAttribute('aria-expanded'), visible: Boolean(actions && getComputedStyle(actions).display !== 'none'),
        reachable: Boolean(rect && rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth + 1),
        pageFits: document.documentElement.scrollWidth <= innerWidth + 1 }
    })()`)
    const initial = await state()
    check(initial.expanded === 'false' && !initial.visible, 'экспорт бастапқыда жиналған')
    await h.evaluate(`document.querySelector('button[aria-controls="cut-export-actions"]')?.click()`)
    check(await h.until("document.querySelector('button[aria-controls=\"cut-export-actions\"]')?.getAttribute('aria-expanded') === 'true'", 5000), 'экспорт ашылды')
    const opened = await state()
    check(opened.visible && opened.reachable && opened.pageFits, 'Базис батырмасы 390 px экранда қолжетімді')
    await h.evaluate(`document.querySelector('button[aria-controls="cut-export-actions"]')?.click()`)
    check(await h.until("document.querySelector('button[aria-controls=\"cut-export-actions\"]')?.getAttribute('aria-expanded') === 'false'", 5000), 'экспорт қайта жиналды')
    check(!(await state()).visible, 'жиналған топ көрінбейді')
    await session.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
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
