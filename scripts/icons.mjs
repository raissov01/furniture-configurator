/**
 * Қосымшаның таңбашалары (PWA icons) — `npm run icons`.
 *
 * НЕГЕ СКРИПТ, СУРЕТ ЕМЕС. PNG репода жатса, оны кім, қашан, немен
 * жасағаны белгісіз болады да, түсін өзгерту үшін графикалық редактор
 * керек. Мұнда таңбаша КОДТАН шығады: түсі жобаның палитрасынан
 * (`globals.css`), ал пішіні — екі есікті корпустың силуэті.
 *
 * Сыртқы тәуелділік ЖОҚ: PNG қолмен жиналады (zlib — Node-тың өзінікі).
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'public'
const INK = [23, 25, 30]        // --ink
const OAK = [201, 162, 39]      // --oak
const PAPER = [247, 245, 240]   // --paper

/** Бір суреттің пиксельдері: RGBA, жол басында фильтр байты (PNG талабы). */
function raster(size, { padding }) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
  }
  const rect = (x0, y0, w, h, color) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) set(x, y, color)
  }

  rect(0, 0, size, size, INK)

  // Корпус: сыртқы контур, ішінде екі фасад пен төменгі цоколь.
  const p = Math.round(size * padding)
  const w = size - 2 * p
  const h = size - 2 * p
  rect(p, p, w, h, OAK)

  const t = Math.max(2, Math.round(size * 0.045))     // «панельдің қалыңдығы»
  rect(p + t, p + t, w - 2 * t, h - 2 * t, INK)       // ішкі бос орын

  const gap = Math.max(2, Math.round(size * 0.02))
  const doorW = Math.round((w - 2 * t - gap) / 2)
  const doorH = h - 2 * t - Math.round(size * 0.12)
  rect(p + t, p + t, doorW, doorH, PAPER)
  rect(p + t + doorW + gap, p + t, w - 2 * t - doorW - gap, doorH, PAPER)

  // Тұтқалар — екі қысқа сызық: таңбаша кішкене өлшемде де жиһаз болып оқылады.
  const hy = p + t + Math.round(doorH * 0.45)
  const hh = Math.max(2, Math.round(size * 0.09))
  rect(p + t + doorW - Math.round(size * 0.045), hy, Math.max(1, Math.round(size * 0.018)), hh, INK)
  rect(p + t + doorW + gap + Math.round(size * 0.028), hy, Math.max(1, Math.round(size * 0.018)), hh, INK)

  return px
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, px) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8      // бит/арна
  ihdr[9] = 6      // RGBA
  // Әр жолдың алдында фильтр байты (0 — фильтрсіз).
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    rows[y * (size * 4 + 1)] = 0
    px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
const files = [
  // Кәдімгі таңбаша: шеті аз.
  ['icon-192.png', 192, 0.12],
  ['icon-512.png', 512, 0.12],
  // Maskable: Android оның ШЕТІН КЕСЕДІ, сондықтан жиегі кең болуы керек.
  ['icon-maskable-512.png', 512, 0.22],
  ['apple-touch-icon.png', 180, 0.12],
]
for (const [name, size, padding] of files) {
  writeFileSync(join(OUT, name), png(size, raster(size, { padding })))
  console.log(`✓ ${name} (${size}×${size})`)
}
