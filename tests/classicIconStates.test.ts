/**
 * Белгішелер (P0-4): disabled пен enabled пиксельге дейін бірдей еді —
 * SVG-дегі түсті stroke/fill `color`-ды елемейді. Disabled күйде белгіше
 * сұр әрі бозғылт, ал «Удалить» қызылы — нақты қызыл (#E4B8B9 антиалиас пиксель емес).
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassicIcon } from '../components/ClassicIcon'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
const rgb = (hex: string) => hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16))
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\n|,)\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('classic icon states', () => {
  it('greys out and fades every colored icon in a disabled button', () => {
    const disabled = rule('.p100-icon-button:disabled svg')
    expect(disabled).toMatch(/filter:\s*grayscale\(1\)/)
    const opacity = Number(disabled.match(/opacity:\s*([\d.]+)/)?.[1])
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThanOrEqual(0.5)
  })

  it('keeps enabled icons at full color (no filter on the enabled rule)', () => {
    expect(rule('.p100-icon-button svg')).not.toMatch(/grayscale|opacity/)
  })

  it('uses a real, saturated red for Delete', () => {
    const red = token('p100-icon-red')
    expect(red).toBeDefined()
    expect(red!.toLowerCase()).not.toBe('#e4b8b9')
    const [r, g, b] = rgb(red!)
    expect(r!).toBeGreaterThan(170)
    expect(Math.max(g!, b!)).toBeLessThan(80)
  })

  it('draws plain strokes with currentColor so the disabled text color applies', () => {
    const html = renderToString(createElement(ClassicIcon, { name: 'copy' }))
    expect(html).toContain('stroke="currentColor"')
    expect(renderToString(createElement(ClassicIcon, { name: 'delete' }))).toContain('var(--p100-icon-red)')
  })
})
