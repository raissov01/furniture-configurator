/**
 * ЕДЕННІҢ процедуралық текстурасы: тақтай (ламинат/паркет) не плитка.
 *
 * `grainTexture` сияқты: ақшыл, түсті бұзбайтын негіз — материалдың
 * `color`-ына көбейтіледі, сондықтан бір тақтай текстурасы дуб та, жаңғақ
 * та бола алады. Негізі бір рет салынады; бөлменің өлшеміне қарай тек
 * ҚАЙТАЛАНУЫ (`repeat`) өзгереді, сол үшін әр бөлмеге клон беріледі.
 *
 * ⚠ Тек браузерде (canvas керек).
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import type { FloorKind } from '@/src/core/types'

export type FloorPattern = 'planks' | 'tiles'

// Кэш кілті ТЕК `pattern` болса, әртүрлі ағаш кэшті бөліседі: `oak` мен
// `walnut` екеуі де `pattern: 'planks'`, сондықтан бір текстураға түседі де,
// тек `material.color` арқылы реңкі ғана өзгереді — талшық өрнегі бірдей
// болып қалады. Сол үшін кілт `pattern:kind` болып құрылады.
const cache = new Map<string, Texture>()

/** Канвастың бір данасы еденде қанша мм алады: 8 тақтай × 150 мм, 2 плитка × 600 мм. */
const SPAN_MM = 1200

function paint(pattern: FloorPattern, kind: FloorKind): Texture | null {
  const key = `${pattern}:${kind}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (pattern === 'planks') {
    // Ағаш түріне қарай ӨЗ талшық өрнегі — тек түс емес: дуб жіңішке
    // тақтайлы, ашық әрі жиі талшықты (тік құрылым), жаңғақ кең тақтайлы,
    // сирек әрі толқынды талшықты (майда-шұйке текстура). Түс материалдың
    // өзінде (`FLOOR_LOOK`), мұнда тек ӨРНЕК ерекшеленеді.
    const isWalnut = kind === 'walnut'
    const rows = isWalnut ? 6 : 8
    const h = size / rows
    const linesPerRow = isWalnut ? 10 : 16
    const waveAmp = isWalnut ? 2.4 : 1.2
    for (let r = 0; r < rows; r += 1) {
      // Әр тақтайдың өз реңкі: бірдей реңк ламинат емес, пластик болып көрінеді.
      const tone = 226 + Math.round((Math.random() - 0.5) * 34)
      ctx.fillStyle = `rgb(${tone}, ${tone - 6}, ${tone - 14})`
      ctx.fillRect(0, r * h, size, h)
      for (let i = 0; i < linesPerRow; i += 1) {
        const y = r * h + 3 + Math.random() * (h - 6)
        ctx.strokeStyle = `rgba(110, 84, 54, ${0.04 + Math.random() * 0.08})`
        ctx.lineWidth = isWalnut ? 1.2 + Math.random() * 2 : 0.6 + Math.random() * 1.2
        ctx.beginPath()
        ctx.moveTo(0, y)
        for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x / 40 + i) * waveAmp)
        ctx.stroke()
      }
      // Тақтайдың ұшы — әр қатарда өз жерінде (кірпіш тәрізді төсеу).
      ctx.fillStyle = 'rgba(70, 54, 38, 0.35)'
      ctx.fillRect(Math.random() * size, r * h, 2, h)
      // Қатарлардың арасындағы жік.
      ctx.fillStyle = 'rgba(60, 44, 30, 0.45)'
      ctx.fillRect(0, r * h, size, 2)
    }
  } else {
    ctx.fillStyle = '#f2f1ee'
    ctx.fillRect(0, 0, size, size)
    const noise = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < noise.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 8
      noise.data[i] = Math.max(0, Math.min(255, noise.data[i]! + n))
      noise.data[i + 1] = Math.max(0, Math.min(255, noise.data[i + 1]! + n))
      noise.data[i + 2] = Math.max(0, Math.min(255, noise.data[i + 2]! + n))
    }
    ctx.putImageData(noise, 0, 0)
    // Фуга: 2 × 2 плитка.
    ctx.fillStyle = 'rgba(95, 95, 95, 0.55)'
    for (const k of [0, size / 2]) {
      ctx.fillRect(k, 0, 3, size)
      ctx.fillRect(0, k, size, 3)
    }
  }

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  cache.set(key, tex)
  return tex
}

/** Бөлменің өлшеміне сай қайталанатын еден текстурасы. */
export function floorTexture(pattern: FloorPattern, kind: FloorKind, widthMm: number, depthMm: number): Texture | null {
  const base = paint(pattern, kind)
  if (!base) return null
  const tex = base.clone()
  tex.repeat.set(widthMm / SPAN_MM, depthMm / SPAN_MM)
  tex.needsUpdate = true
  return tex
}
