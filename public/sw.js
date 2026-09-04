/*
 * Қызметтік жұмысшы (service worker).
 *
 * МАҚСАТЫ ШЕКТЕУЛІ: қосымшаны телефонға орнатуға болатын қылу әрі БАЙЛАНЫС
 * ҮЗІЛГЕНДЕ бет ашылатын күйде қалдыру. Цехта Wi-Fi жиі жоғалады, ал
 * конфигуратордың өзі ТОЛЫҚ БРАУЗЕРДЕ жұмыс істейді — интернет тек бұлтқа
 * сақтауға керек.
 *
 * ⚠ ЕКІ ЕРЕЖЕ, ЕКЕУІ ДЕ ӘДЕЙІ:
 *   1. `/api/**` ЕШҚАШАН кэштелмейді. Жобаны, профильді, тарифті ескі
 *      жауаппен көрсету — деректі жоғалтумен бірдей.
 *   2. Беттің өзі ЖЕЛІДЕН БАСТАП алынады (network-first): жаңа нұсқа шыққанда
 *      адам ескі бетте отырып қалмауы керек. Желі жоқта ғана кэш беріледі.
 */
/*
 * Кэштің аты ҚҰРАСТЫРУДЫҢ белгісінен құралады (`?v=` мекенжайдан).
 * Сол себепті жаңа деплой ескі кэшті МІНДЕТТІ ТҮРДЕ тастайды: 2026-09-04-те
 * тұрақты ат («v1») ескі бетті ұстап қалды да, жаңа нұсқа көрінбей қойды.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') ?? 'dev'
const SHELL = `shell-${VERSION}`

self.addEventListener('install', (event) => {
  // Бірден белсенді болады: ескі жұмысшыны күтудің қажеті жоқ.
  self.skipWaiting()
  /*
   * ⚠ БЕТТІҢ ӨЗІ ОРНАТУ КЕЗІНДЕ КЭШТЕЛМЕЙДІ. Бұрын ол осында жазылатын да,
   * жаңа нұсқа шыққанда ескі HTML қалып қоятын. Енді бет тек СӘТТІ
   * ЖҮКТЕЛГЕННЕН кейін жазылады, ал ол әрқашан желіден бастап алынады.
   */
  event.waitUntil(caches.open(SHELL))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Статикалық қорлар (қаріп, таңбаша, чанк) — кэштен, содан кейін желіден.
  const isAsset = url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/fonts/')
    || url.pathname.endsWith('.png')
  if (isAsset) {
    event.respondWith((async () => {
      const hit = await caches.match(request)
      if (hit) return hit
      const res = await fetch(request)
      if (res.ok) (await caches.open(SHELL)).put(request, res.clone())
      return res
    })())
    return
  }

  // Беттер — желіден бастап.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request)
        if (res.ok) (await caches.open(SHELL)).put(request, res.clone())
        return res
      } catch {
        return (await caches.match(request)) ?? (await caches.match('/configurator')) ?? Response.error()
      }
    })())
  }
})
