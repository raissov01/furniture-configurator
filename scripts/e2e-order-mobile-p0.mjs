/** «Тапсырыс» P0 қабылдау сценарийі. Негізгі Codex 03e/03f соңында ғана іске қосады. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeHelpers } from './e2eHelpers.mjs'

const base = process.argv[2] ?? 'http://localhost:3000'
const port = Number(process.env['ORDER_MOBILE_E2E_CDP_PORT'] ?? 9452)
const profile = mkdtempSync(join(tmpdir(), 'furniture-order-mobile-'))
const chrome = spawn(process.env['CHROME'] ?? 'google-chrome', [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', detached: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
const online = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
const walls = ['Северная стена', 'Восточная стена', 'Южная стена', 'Западная стена']
const obstacles = ['Розетка', 'Труба', 'Батарея', 'Вентиляция', 'Подоконник', 'Толщина плитки']
const room = [
  ['Высота помещения', 2500], ['Северная стена', 3000], ['Восточная стена', 4000],
  ['Южная стена', 3000], ['Западная стена', 4000],
  ['Северо-западный', 90], ['Северо-восточный', 90],
  ['Юго-восточный', 90], ['Юго-западный', 90],
]

async function connect() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((tab) => tab.type === 'page')
      if (!page) throw new Error('Chrome page жоқ')
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
      await send('Network.enable')
      return { ws, send }
    } catch { await wait(500) }
  }
  throw new Error('Chrome CDP қолжетімсіз')
}

// Тек нақты бар data-testid: share-approval және client-approval.
const dbExpression = `new Promise((resolve, reject) => {
  const open = indexedDB.open('tapsyrys-mobile')
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const db = open.result
    const tx = db.transaction(['surveys', 'photos', 'actions'], 'readonly')
    const surveys = tx.objectStore('surveys').getAll()
    const photos = tx.objectStore('photos').count()
    const actions = tx.objectStore('actions').getAll()
    tx.oncomplete = () => {
      resolve({ surveys: surveys.result.map(x => x.id), photos: photos.result,
        actions: actions.result.map(x => ({ entityId: x.record.action.entityId,
          kind: x.record.action.kind, status: x.record.status,
          revision: x.record.acknowledgedRevision })) })
      db.close()
    }
    tx.onerror = () => reject(tx.error)
  }
})`

async function poll(read, accept, description, timeoutMs = 45000) {
  const end = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (accept(value)) return value
    if (Date.now() > end) throw new Error(`${description}: ${JSON.stringify(value)}`)
    await wait(400)
  }
}

async function clickFieldset(h, legend, button) {
  return h.evaluate(`(() => {
    const fieldset = [...document.querySelectorAll('fieldset')]
      .find(x => x.querySelector('legend')?.textContent.trim() === ${JSON.stringify(legend)})
    const control = [...(fieldset?.querySelectorAll('button') ?? [])]
      .find(x => x.textContent.trim() === ${JSON.stringify(button)})
    if (!control || control.disabled) return false
    control.click(); return true
  })()`)
}

async function photoInFieldset(h, legend) {
  return h.evaluate(`(() => {
    const fieldset = [...document.querySelectorAll('fieldset')]
      .find(x => x.querySelector('legend')?.textContent.trim() === ${JSON.stringify(legend)})
    const input = fieldset?.querySelector('input[type=file]')
    if (!input) return false
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='), x => x.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'obstacle.png', { type: 'image/png' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
}

async function checkWidth(h, width, place) {
  const size = await h.evaluate(`({ viewport: innerWidth, page: document.documentElement.scrollWidth })`)
  assert(size.viewport === width && size.page <= width, `${width} px: ${place} көлденең тасып кетті: ${JSON.stringify(size)}`)
}

async function traverseWalls(h, withPhotos, width) {
  for (let index = 0; index < walls.length; index += 1) {
    assert(await h.until(`document.querySelector('h1')?.textContent.includes(${JSON.stringify(walls[index])})`, 8000), `${width} px: ${walls[index]} ашылмады`)
    await checkWidth(h, width, walls[index])
    if (withPhotos) {
      for (const kind of obstacles) {
        assert(await clickFieldset(h, kind, 'Нет'), `${width} px: ${kind} жоқ жауабы жоқ`)
      }
      if (index === 0) {
        await h.clickText('Следующая стена') // батырма disabled болуы да жарайды
        assert(await h.evaluate(`document.querySelector('h1')?.textContent.includes(${JSON.stringify(walls[0])})`),
          'Кедергіге «жоқ» деп жауап беріп, фото қоспай-ақ қабырға аяқталды')
        assert((await h.text()).includes('Добавьте фото'), 'Міндетті фото қатесі көрсетілмеді')
      }
      for (const kind of obstacles) {
        assert(await photoInFieldset(h, kind), `${width} px: ${kind} фото өрісі жоқ`)
        assert(await h.until(`(() => {
          const fieldset = [...document.querySelectorAll('fieldset')]
            .find(x => x.querySelector('legend')?.textContent.trim() === ${JSON.stringify(kind)})
          return fieldset?.textContent.includes('Фото сохранено на этом устройстве')
        })()`, 8000), `${width} px: ${kind} фото сақталмады`)
      }
    }
    assert(await h.clickText(index === walls.length - 1 ? 'Проверить' : 'Следующая стена'),
      `${width} px: келесі қабырғаға өту мүмкін емес`)
  }
  assert(await h.until(`document.querySelector('h1')?.textContent.includes('Проверка замера')`, 8000),
    `${width} px: өлшеу қорытындысы жоқ`)
  await checkWidth(h, width, 'өлшеу қорытындысы')
}

async function pdfCreated(h) {
  await h.evaluate(`(() => {
    window.__orderPdf = null
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      if (blob.type === 'application/pdf') {
        blob.arrayBuffer().then(bytes => {
          const head = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5))
          window.__orderPdf = { size: bytes.byteLength, head }
        })
      }
      return original(blob)
    }
  })()`)
}

async function runWidth(session, h, width, email) {
  await session.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true })
  await h.goto('/mobile', 3500)
  assert(await h.until(`document.querySelector('h1')?.textContent.includes('Сегодня')`, 10000), `${width} px: «Бүгін» жоқ`)
  assert(await h.until(`[...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Новый замер' && !x.disabled)`, 10000),
    `${width} px: өлшеу қоймасы дайын болмады`)
  await checkWidth(h, width, 'Бүгін')
  const before = await h.evaluate(dbExpression)

  await session.send('Network.emulateNetworkConditions', offline)
  assert(await h.until('navigator.onLine === false', 6000), `${width} px: CDP offline күйіне өтпеді`)
  assert(await h.clickText('Новый замер'), `${width} px: өлшеу шебері жоқ`)
  assert(await h.until(`document.querySelector('h1')?.textContent.includes('Помещение и стены')`, 5000),
    `${width} px: бөлме өлшемдері жоқ`)
  for (const [label, value] of room) assert(await h.setNumberByLabel(label, value, 50), `${width} px: ${label} жоқ`)
  assert(await h.clickText('К препятствиям'), `${width} px: кедергілерге өту мүмкін емес`)
  await traverseWalls(h, true, width)
  assert(await h.clickText('Сохранить замер'), `${width} px: өлшеуді сақтау батырмасы жоқ`)
  assert(await h.until(`document.body.innerText.includes('Ожидает отправки')`, 8000),
    `${width} px: «Жіберілуді күтуде» кезегі көрінбейді`)
  const queued = await poll(() => h.evaluate(dbExpression), (db) => db.surveys.length > before.surveys.length &&
    db.actions.some((x) => x.kind === 'measurement.upsert' && x.status === 'pending' && !before.surveys.includes(x.entityId)),
  `${width} px: өлшеу кезекке түспеді`)
  const surveyId = queued.surveys.find((id) => !before.surveys.includes(id))
  assert(surveyId && queued.photos >= before.photos + 24, `${width} px: 24 кедергі фотосы сақталмады`)
  assert(await h.clickText('Назад'), `${width} px: «Бүгін» бетіне оралу мүмкін емес`)
  await session.send('Page.reload', { ignoreCache: true })
  assert(await h.until(`document.querySelector('h1')?.textContent.includes('Сегодня')`, 15000),
    `${width} px: offline өлшеу қайта ашылмады`)
  assert(await h.until(`document.querySelector('[role=status]')?.textContent.includes('Ожидает отправки: 1')`, 8000),
    `${width} px: қайта ашқанда кезек жоғалды`)
  assert((await h.evaluate(dbExpression)).surveys.includes(surveyId), `${width} px: өлшеу IndexedDB-де жоқ`)
  await checkWidth(h, width, 'offline кезек')

  await session.send('Network.emulateNetworkConditions', online)
  assert(await h.until('navigator.onLine === true', 6000), `${width} px: желі қалпына келмеді`)
  const sent = await poll(() => h.evaluate(dbExpression), (db) => db.actions.some((x) =>
    x.entityId === surveyId && x.kind === 'measurement.upsert' && x.status === 'sent' && x.revision?.version >= 1),
  `${width} px: кезек серверге жіберілмеді`, 90000)
  assert(sent.actions.filter((x) => x.entityId === surveyId && x.status === 'sent').length === 1,
    `${width} px: бір өлшеу бірнеше рет жіберілді`)
  assert(await h.until(`document.querySelector('[role=status]')?.textContent.includes('Ожидает отправки: 0')`, 8000),
    `${width} px: жіберілген әрекет кезектен алынбады`)

  assert(await h.clickContains('Замер ·'), `${width} px: сақталған өлшеуді ашу мүмкін емес`)
  assert(await h.clickText('К препятствиям'), `${width} px: сақталған өлшеудің кедергілері жоқ`)
  await traverseWalls(h, false, width)
  assert(await h.clickText('Создать кухню по замеру'), `${width} px: ас үй жобасына өту жоқ`)
  assert(await h.until(`location.pathname === '/configurator' && new URLSearchParams(location.search).get('measurement') === ${JSON.stringify(surveyId)}`, 20000),
    `${width} px: ас үйге өлшеу ID-і берілмеді`)
  assert(await h.until(`document.querySelectorAll('[data-dimension-label]').length === 3`, 20000),
    `${width} px: ас үй жобасы ашылмады`)
  assert((await h.cutListRows()).length > 0, `${width} px: ас үй деталировкасы бос`)
  await checkWidth(h, width, 'ас үй жобасы')

  assert(await h.menu('Проект', 'Смета и раскрой'), `${width} px: КП мәзірі жоқ`)
  await pdfCreated(h)
  assert(await h.clickText('КП'), `${width} px: КП PDF батырмасы жоқ не баға толық емес`)
  await poll(() => h.evaluate('window.__orderPdf'), (pdf) => pdf?.head === '%PDF-' && pdf.size > 500,
    `${width} px: КП PDF жасалмады`)
  assert(await h.clickText('Закрыть'), `${width} px: сметаны жабу мүмкін емес`)

  assert(await h.menu('Проект', 'Код для клиента'), `${width} px: клиент коды мәзірі жоқ`)
  assert(await h.until(`Boolean(document.querySelector('[data-testid="share-approval"]'))`, 15000),
    `${width} px: келісім нұсқасы жоқ`)
  const code = await h.evaluate(`document.querySelector('[data-share-code]')?.textContent.trim()`)
  assert(/^\d{6}$/.test(code), `${width} px: клиент share коды жоқ`)
  assert(await h.clickText('Отправить версию на согласование'), `${width} px: келісімге жіберу жоқ`)
  assert(await h.until(`/^\\d{6}$/.test(document.querySelector('[data-testid="share-approval"] strong')?.textContent.trim() ?? '')`, 15000),
    `${width} px: растау коды жоқ`)
  const otp = await h.evaluate(`document.querySelector('[data-testid="share-approval"] strong').textContent.trim()`)

  // Интернет қажет әрекеттің белгісі offline кезінде сұр әрі әрекет сөндірулі.
  await session.send('Network.emulateNetworkConditions', offline)
  assert(await h.until('navigator.onLine === false', 6000), `${width} px: келісім offline күйі жоқ`)
  const note = await h.evaluate(`(() => {
    const scope = document.querySelector('[data-testid="share-approval"]')
    const p = [...(scope?.querySelectorAll('[role=note]') ?? [])]
      .find(x => x.textContent.includes('Работает через интернет'))
    const button = [...(scope?.querySelectorAll('button') ?? [])]
      .find(x => x.textContent.includes('Отправить версию на согласование'))
    return p && button ? { color: getComputedStyle(p).color, disabled: button.disabled } : null
  })()`)
  assert(note?.disabled && /^rgb\((\d+), (\d+), (\d+)\)$/.test(note.color),
    `${width} px: интернет белгісі offline кезінде жоқ немесе әрекет белсенді`)
  const channels = note.color.match(/\d+/g).map(Number)
  assert(Math.max(...channels) - Math.min(...channels) < 25, `${width} px: интернет белгісі сұр емес: ${note.color}`)
  await session.send('Network.emulateNetworkConditions', online)
  assert(await h.until('navigator.onLine === true', 6000), `${width} px: келісімге желі қайтпады`)

  await session.send('Network.clearBrowserCookies') // клиент шебердің сессиясын пайдаланбайды
  await h.goto(`/view?c=${code}`, 6500)
  assert(await h.until(`Boolean(document.querySelector('[data-testid="client-approval"]'))`, 15000),
    `${width} px: клиент келісімі жоқ`)
  const filled = await h.evaluate(`(() => {
    const input = document.querySelector('[data-testid="client-approval"] input[aria-label="Код подтверждения"]')
    if (!input) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(otp)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  assert(filled, `${width} px: клиент OTP өрісі жоқ`)
  assert(await h.clickText('Подтверждаю эту версию'), `${width} px: клиент мақұлдау батырмасы жоқ`)
  assert(await h.until(`document.querySelector('[data-testid="client-approval"]')?.textContent.includes('Версия согласована')`, 15000),
    `${width} px: клиент нұсқаны мақұлдамады`)
  const seal = await h.evaluate(`fetch('/api/share/${code}/approval?format=pdf', { credentials: 'same-origin' })
    .then(async r => ({ status: r.status, type: r.headers.get('content-type'),
      head: new TextDecoder().decode(new Uint8Array(await r.arrayBuffer()).slice(0, 5)) }))`)
  assert(seal.status === 200 && seal.type?.includes('application/pdf') && seal.head === '%PDF-',
    `${width} px: мөрленген PDF жоқ: ${JSON.stringify(seal)}`)
  await checkWidth(h, width, 'клиент келісімі')

  // 03f UI: QR мен монтажға тек көрінетін сілтеме арқылы барамыз.
  const login = await h.evaluate(`fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ${JSON.stringify(email)}, password: 'password123' }),
  }).then(r => r.status)`)
  assert(login === 200, `${width} px: цехқа қайта кіру мүмкін емес: HTTP ${login}`)
  await h.goto('/mobile', 3500)
  const labelLink = await h.evaluate(`(() => {
    const a = document.querySelector('a[href="/mobile/labels"]')
    if (!a) return false
    a.click(); return true
  })()`)
  assert(labelLink, `${width} px: /mobile/labels жапсырма сілтемесі жоқ (03f UI)`)
  assert(await h.until(`location.pathname === '/mobile/labels'`, 10000), `${width} px: жапсырма беті ашылмады`)
  assert(await h.until(`Boolean(document.querySelector('canvas[aria-label*="QR"], img[alt*="QR"]'))`, 10000),
    `${width} px: жапсырма QR көрінбейді`)
  await checkWidth(h, width, 'QR жапсырма')
  const installationLink = await h.evaluate(`(() => {
    const a = document.querySelector('a[href="/mobile/installation"]')
    if (!a) return false
    a.click(); return true
  })()`)
  assert(installationLink, `${width} px: /mobile/installation монтаж сілтемесі жоқ (03f UI)`)
  assert(await h.until(`location.pathname === '/mobile/installation'`, 10000), `${width} px: монтаж беті ашылмады`)
  assert(await h.until(`document.querySelectorAll('section[aria-label="Монтаж чек-лист"] fieldset').length === 5`, 10000),
    `${width} px: монтаждың бес тармақты чек-листі жоқ`)
  for (let index = 0; index < 5; index += 1) {
    const withoutPhoto = await h.evaluate(`(() => {
      const fieldset = document.querySelectorAll('section[aria-label="Монтаж чек-лист"] fieldset')[${index}]
      const checkbox = fieldset?.querySelector('input[type=checkbox]')
      if (!checkbox) return null
      checkbox.click()
      return checkbox.checked
    })()`)
    assert(withoutPhoto === false, `${width} px: монтаждың ${index + 1}-тармағы фотосыз аяқталды`)
    assert(await h.evaluate(`(() => {
      const fieldset = document.querySelectorAll('section[aria-label="Монтаж чек-лист"] fieldset')[${index}]
      const input = fieldset?.querySelector('input[type=file]')
      if (!input) return false
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='), x => x.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], 'installation.png', { type: 'image/png' }))
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`), `${width} px: монтаждың ${index + 1}-тармағында фото өрісі жоқ`)
    await h.wait(500)
    await h.evaluate(`(() => {
      const fieldset = document.querySelectorAll('section[aria-label="Монтаж чек-лист"] fieldset')[${index}]
      const checkbox = fieldset?.querySelector('input[type=checkbox]')
      if (checkbox && !checkbox.checked) checkbox.click()
    })()`)
    assert(await h.until(`(() => {
      const fieldset = document.querySelectorAll('section[aria-label="Монтаж чек-лист"] fieldset')[${index}]
      return fieldset?.querySelector('input[type=checkbox]')?.checked === true
    })()`, 8000), `${width} px: монтаждың ${index + 1}-тармағы фото қосқанда белгіленбеді`)
  }
  await checkWidth(h, width, 'монтаж чек-листі')
  console.log(`order mobile P0 ${width} px: PASS`)
}

let session
try {
  session = await connect()
  const h = makeHelpers(session, base)
  await h.goto('/mobile', 5000)
  const email = `order-mobile-${Date.now()}@example.kz`
  const registration = await h.evaluate(`fetch('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ${JSON.stringify(email)}, password: 'password123', shopName: 'E2E P0' }),
  }).then(r => r.status)`)
  assert(registration === 200, `Тест аккаунты тіркелмеді: HTTP ${registration}`)
  await h.goto('/mobile', 5000)
  assert(await h.until('Boolean(navigator.serviceWorker?.controller)', 15000), 'PWA service worker басқармайды')
  await h.goto('/configurator', 7000)
  await h.goto('/configurator', 4500)
  for (const width of [360, 390, 414]) await runWidth(session, h, width, email)
  console.log('order mobile P0: PASS')
} catch (error) {
  console.error('order mobile P0: FAIL', error)
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
  if (chrome.exitCode === null) { stop('SIGKILL'); await Promise.race([exited, wait(2000)]) }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
