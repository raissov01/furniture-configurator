/**
 * Клиентке жіберілетін сілтеме: жоба URL-дің ӨЗІНДЕ жүреді.
 *
 * НЕГЕ СЕРВЕР ЕМЕС. Цех клиентке сілтеме жібергенде, ол сілтеме бірден
 * ашылуы керек — тіркелусіз, күтусіз, дерекқорсыз. Жобаны URL-дің хеш
 * бөлігіне қойсақ, ол СЕРВЕРГЕ МҮЛДЕ ЖІБЕРІЛМЕЙДІ (браузердің ережесі):
 * цехтың бағасы да, клиенттің аты да ешқандай журналға түспейді.
 *
 * ПІШІМІ: `v1.<base64url(deflate(JSON))>`. Нұсқа префиксі әдейі: пішім
 * өзгерсе, ескі сілтемені ТАНЫП, түсінікті қате беруге болады — әйтпесе
 * клиент «бет ашылмады» дегеннен басқа ештеңе көрмейді.
 *
 * base64url (`-`/`_`, толтырғышсыз) таңдалды: қарапайым base64-тегі `+`
 * пен `/` URL-де қашып жазылады да, сілтеме екі есе ұзарады.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { ConfigValidationError } from './errors'
import { parseProject } from './schema'
import { parseProjectV4 } from './projectV4'
import type { ProjectFile } from './types'
import type { ProjectFileV4 } from './projectV4'

const PREFIX = 'v1.'

/**
 * Сілтеменің ақылға қонымды шегі, таңба.
 *
 * Браузерлер хештің ұзындығын шектемейді, бірақ мессенджерлер сілтемені
 * үзіп жібереді. Шектен асса — қате емес, ЕСКЕРТУ: цех оның орнына файл
 * жіберуі керек екенін білуі керек.
 */
export const SHARE_LINK_WARN_LENGTH = 8000

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b === undefined) break
    out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c === undefined) break
    out += B64[c & 63]
  }
  return out
}

function fromBase64Url(text: string): Uint8Array {
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of text) {
    const value = B64.indexOf(ch)
    if (value < 0) throw new ConfigValidationError('link', 'ссылка повреждена', 'проверьте, что она скопирована целиком')
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

/** Жобаны сілтемеге сыятын жолға айналдыру. */
export function encodeProject(project: ProjectFile | ProjectFileV4): string {
  const json = JSON.stringify(project)
  // Деңгей 9: сілтеме бір рет жасалады да, ұзақ жүреді — уақыттан гөрі
  // ұзындығы маңызды.
  return PREFIX + toBase64Url(deflateSync(strToU8(json), { level: 9 }))
}

/**
 * Сілтемедегі жолды жобаға қайтару.
 *
 * Кез келген бүлінген кірісте ТҮСІНІКТІ қате беріледі: клиент «бет ашылмады»
 * емес, «сілтеме бүлінген» дегенді көруі керек.
 */
function decodeRawProject(token: string): unknown {
  const clean = token.trim().replace(/^#/, '')
  if (!clean.startsWith(PREFIX)) {
    throw new ConfigValidationError(
      'link', 'неизвестный формат ссылки',
      'ссылка создана другой версией конфигуратора',
    )
  }
  let json: string
  try {
    json = strFromU8(inflateSync(fromBase64Url(clean.slice(PREFIX.length))))
  } catch {
    throw new ConfigValidationError(
      'link', 'ссылка повреждена', 'проверьте, что она скопирована целиком',
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new ConfigValidationError('link', 'ссылка повреждена', 'не удалось прочитать проект')
  }
  return raw
}

/** Ескі v1–v3 share callers үшін сақталған декодер. */
export function decodeProject(token: string): ProjectFile {
  return parseProject(decodeRawProject(token))
}

/** Ағымдағы редактор мен client view: ескі сілтеме де v4 ағашына көтеріледі. */
export function decodeProjectV4(token: string): ProjectFileV4 {
  return parseProjectV4(decodeRawProject(token))
}

/** Толық сілтеме. `origin` сыртта беріледі: ядро браузерге тәуелді емес. */
export function shareLink(origin: string, project: ProjectFile | ProjectFileV4): string {
  return `${origin.replace(/\/$/, '')}/view#${encodeProject(project)}`
}
