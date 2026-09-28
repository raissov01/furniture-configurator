import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mobileViewLabel } from '../lib/mobileViewTabs'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

describe('F00n көрініс қойындылары', () => {
  it('әр тілде қысқа, толық оқылатын атау береді', () => {
    expect(mobileViewLabel('perspective', 'ru', 'Перспектива')).toBe('Персп.')
    expect(mobileViewLabel('axo', 'ru', 'Аксонометрия')).toBe('Аксон.')
    expect(mobileViewLabel('perspective', 'kk', 'Перспектива')).toBe('Персп.')
    expect(mobileViewLabel('axo', 'uz', 'Aksonometriya')).toBe('Akson.')
    expect(mobileViewLabel('perspective', 'en', 'Perspective')).toBe('Persp.')
    expect(mobileViewLabel('plan', 'en', 'Plan')).toBe('Plan')
  })

  it('толық атауды aria белгісінде сақтап, телефон атауын кеспейді', () => {
    expect(workspace).toContain('mobileViewLabel(v.key, getLang(), tr(v.ruLabel))')
    expect(workspace).toContain('aria-label={tr(v.ruLabel)}')
    expect(workspace).toContain('data-testid="mobile-module-name"')
    expect(workspace).toContain('shrink-0 whitespace-nowrap')
  })
})
