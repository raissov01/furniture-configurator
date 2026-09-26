import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { TemplateGallery } from '../components/TemplateGallery'
import { TreeDock } from '../components/panels/TreeDock'
import { useConfigurator } from '../store/configurator'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const gallerySource = readFileSync(new URL('../components/TemplateGallery.tsx', import.meta.url), 'utf8')

function colorOf(value: string): string | undefined {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  const token = value.match(/^var\((--p100-[\w-]+)\)$/)?.[1]
  return token ? css.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] : undefined
}

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

describe('classic gallery and structure palette', () => {
  it('uses the PRO100 palette for modal, structure panel, controls and muted text with AA contrast', () => {
    for (const selector of ['.p100-gallery', '.p100-tree-dock', '.p100-gallery button', '.p100-tree-dock button', '.p100-gallery .p100-muted', '.fixed.inset-0 > .bg-white', '.fixed.inset-0 .bg-neutral-50']) {
      const rule = css.match(new RegExp(`\\.p100-workspace ${selector.replaceAll('.', '\\.') }\\s*\\{([^}]+)\\}`))?.[1]
      expect(rule, selector).toBeDefined()
      const foreground = colorOf(rule!.match(/(?:^|;)\s*color:\s*([^;]+)/i)?.[1]?.trim() ?? '')
      const background = colorOf(rule!.match(/background(?:-color)?:\s*([^;]+)/i)?.[1]?.trim() ?? '')
      expect(foreground, selector).toBeDefined()
      expect(background, selector).toBeDefined()
      expect(contrast(foreground!, background!), selector).toBeGreaterThanOrEqual(4.5)
    }
    expect(css).toContain('background: var(--p100-dialog)')
    expect(css).toContain('background: var(--p100-dialog-content)')
    expect(css).toContain('.p100-workspace .fixed.inset-0 { backdrop-filter: none; }')
  })

  it('marks the mounted gallery and structure dock for classic styling', () => {
    const initial = useConfigurator.getInitialState()
    const original = initial.galleryOpen
    Object.assign(initial, { galleryOpen: true })
    try {
      expect(renderToString(createElement(TemplateGallery))).toContain('p100-gallery')
      expect(renderToString(createElement(TreeDock))).toContain('p100-tree-dock')
    } finally { Object.assign(initial, { galleryOpen: original }) }
  })

  it('keeps the first-run cards in one column through 414 px and confines chips', () => {
    const initial = useConfigurator.getInitialState()
    const originalOpen = initial.galleryOpen
    const originalFirst = initial.firstRun
    Object.assign(initial, { galleryOpen: true, firstRun: true })
    try {
      const html = renderToString(createElement(TemplateGallery))
      expect(html).toMatch(/data-testid="first-run-categories"[^>]*grid-cols-1[^>]*min-\[420px\]:grid-cols-2/)
      expect(gallerySource).toMatch(/aria-label=\{tr\('Подкатегории'\)\}[^>]*max-w-full[^>]*overflow-x-auto/)
      expect(html).toContain('data-testid="template-gallery-dialog"')
      expect(html).toContain('min-w-0')
    } finally {
      Object.assign(initial, { galleryOpen: originalOpen, firstRun: originalFirst })
    }
  })
})
