/**
 * Адамның силуэті — масштабтың өлшемі.
 *
 * Ол деталировкаға да, раскройға да, сметаға да КІРМЕЙДІ, сондықтан
 * тексерілетіні аз: сурет дұрыс өлшемде шыға ма әрі кез келген жерде
 * (браузер, PDF) оқылатын түрде ме.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SILHOUETTE_HEIGHT, silhouetteDataUri, silhouetteSize, silhouetteSvg,
} from '../src/core/index'

describe('силуэт', () => {
  it('SVG сұралған бойға сәйкес өлшемде шығады', () => {
    const svg = silhouetteSvg(1800)
    expect(svg).toContain('height="1800"')
    expect(svg).toContain('width="468"') // 1800 × 0.26
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it('әдепкі бой — ересек адамның орташасы', () => {
    expect(DEFAULT_SILHOUETTE_HEIGHT).toBe(1700)
    expect(silhouetteSvg()).toContain('height="1700"')
  })

  it('түсі берілмесе де контур ТҰТАС бір жол болып қалады', () => {
    const svg = silhouetteSvg(1700, '#123456')
    expect(svg).toContain('fill="#123456"')
    expect(svg.match(/<path/g)).toHaveLength(1)
  })

  it('data-URI браузерге де, PDF-ке де жарайды: кодталған, тырнақшасыз', () => {
    const uri = silhouetteDataUri(1700)
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(uri).not.toContain('"')
    expect(uri).not.toContain('<')
    expect(decodeURIComponent(uri.split(',')[1]!)).toContain('<svg')
  })

  it('3D өлшемі МЕТРмен қайтады (three.js метрмен жүреді)', () => {
    expect(silhouetteSize(1700)).toEqual({ width: 0.442, height: 1.7 })
  })
})
