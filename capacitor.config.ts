import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Гибрид қосымша: WebView сервердегі толық мобайл нұсқаны ашады, ал желі жоқта
 * Capacitor `errorPath` арқылы ішке салынған офлайн өлшеу бетін көрсетеді.
 *
 * Сервер мекенжайы — бір ғана build-time айнымалы `AISMEBEL_APP_URL`
 * (прод: `AISMEBEL_APP_URL=https://mebel.balu-fit.com npm run cap:sync`).
 * Толық негіздеме: docs/mobile/hybrid.md.
 *
 * Бұл файл сыртқы модуль импорттамайды: Capacitor CLI оны Node-тың өз
 * type-stripping жүктегішімен ашады, онда кеңейтімсіз салыстырмалы импорт жүрмейді.
 */
export const DEFAULT_APP_URL = 'https://mebel-test.85.137.91.47.sslip.io'
/** Сервер бетінің жолымен қақтығыспайтын, тек қосымша ішінде қызмет ететін файл. */
export const OFFLINE_PAGE = 'aismebel-offline.html'
const DEFAULT_START_PATH = '/mobile'

export type HybridTarget = { origin: string; hostname: string; startUrl: string; offlineUrl: string }

export function resolveHybridTarget(raw: string | undefined): HybridTarget {
  const text = raw?.trim() || DEFAULT_APP_URL
  let url: URL
  try { url = new URL(text) } catch { throw new Error(`AISMEBEL_APP_URL: URL емес: ${text}`) }
  if (url.protocol !== 'https:') throw new Error(`AISMEBEL_APP_URL: тек https (cookie Secure, камера): ${text}`)
  if (url.username || url.password) throw new Error('AISMEBEL_APP_URL: логин/құпиясөз URL-да болмауы керек')
  const path = url.pathname === '/' ? DEFAULT_START_PATH : url.pathname
  return {
    origin: url.origin,
    hostname: url.hostname,
    startUrl: `${url.origin}${path}${url.search}`,
    offlineUrl: `${url.origin}/${OFFLINE_PAGE}`,
  }
}

const target = resolveHybridTarget(process.env['AISMEBEL_APP_URL'])

const config: CapacitorConfig = {
  appId: 'kz.aismebel.app',
  appName: 'AisMebel',
  webDir: 'native-dist',
  server: {
    url: target.startUrl,
    // Офлайн бет сервердің ӨЗ origin-інде ашылады (https://<хост>/aismebel-offline.html):
    // cookie, localStorage және IndexedDB `tapsyrys-mobile` толық нұсқамен ортақ.
    hostname: target.hostname,
    androidScheme: 'https',
    errorPath: OFFLINE_PAGE,
    // Тек өз хостымыз WebView ішінде; Kaspi, WhatsApp т.б. жүйелік браузерде/қосымшада ашылады.
    allowNavigation: [target.hostname],
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
