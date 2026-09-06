/**
 * Процедуралық ТАҚТА түйіршігі (ағаш/ЛДСП беті).
 *
 * Неге процедуралық: 523 декордың суреті жоқ, ал жалпақ бір түс «пластик»
 * болып көрінеді. Мұнда canvas-та ақшыл фонға ЖҰМСАҚ көлденең түйіршік
 * (тамырлар) мен майда шу салынады. Материалда ол `map` болып түске
 * КӨБЕЙТІЛЕДІ — сондықтан кез келген декордың үстінен «тақта» әсерін береді,
 * бірақ түсін өзгертпейді (орташа реңкі ≈ ақ).
 *
 * ⚠ Тек браузерде (canvas керек). Бір рет жасалады да, барлық панель бір
 * текстураны бөліседі — жады да, GPU да үнемделеді.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

let cached: Texture | null = null

export function grainTexture(): Texture | null {
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Ақшыл фон (орташа реңк ≈ ақ, түсті бұзбау үшін).
  ctx.fillStyle = '#f4f2ee'
  ctx.fillRect(0, 0, size, size)

  // Көлденең түйіршік: жіңішке, әр түрлі мөлдірліктегі сызықтар.
  for (let i = 0; i < 220; i += 1) {
    const y = Math.random() * size
    const alpha = 0.02 + Math.random() * 0.06
    ctx.strokeStyle = `rgba(120, 96, 64, ${alpha})`
    ctx.lineWidth = 0.5 + Math.random() * 1.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    // Сәл толқынды — түзу сызық жасанды көрінеді.
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 + i) * (1 + Math.random()))
    }
    ctx.stroke()
  }

  // Майда шу — беті тым «таза» болмасын.
  const noise = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < noise.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10
    noise.data[i] = Math.max(0, Math.min(255, noise.data[i]! + n))
    noise.data[i + 1] = Math.max(0, Math.min(255, noise.data[i + 1]! + n))
    noise.data[i + 2] = Math.max(0, Math.min(255, noise.data[i + 2]! + n))
  }
  ctx.putImageData(noise, 0, 0)

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(2, 2)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cached = tex
  return tex
}
