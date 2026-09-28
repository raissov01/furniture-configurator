import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { classicShopTools } from '../lib/classicShopTools'
import { classicDockTools } from '../lib/classicDockTools'
import { assertUniqueToolbarRows } from '../lib/classicToolbar'
import { ClassicIcon } from '../components/ClassicIcon'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const toolbar = source.slice(source.indexOf('const classicToolRows:'), source.indexOf('  return (', source.indexOf('const classicToolRows:')))

function value(expression: string, field: 'icon' | 'label'): string {
  if (expression.startsWith("'")) return expression.slice(1, -1)
  const match = expression.match(/^classic(Shop|Dock)Tools\.(\w+)\.(icon|label)$/)
  if (!match || match[3] !== field) throw new Error(`Unknown toolbar ${field}: ${expression}`)
  const tools = match[1] === 'Shop' ? classicShopTools : classicDockTools
  return (tools as Record<string, { icon: string; label: string }>)[match[2] ?? '']?.[field] ?? ''
}

function toolbarBindings(): { icon: string; action: string }[] {
  return [...toolbar.matchAll(/\{ icon: ('.*?'|classic(?:Shop|Dock)Tools\.\w+\.icon), label: tr\(('.*?'|classic(?:Shop|Dock)Tools\.\w+\.label)\), action:/g)]
    .map((match) => ({ icon: value(match[1] ?? '', 'icon'), action: value(match[2] ?? '', 'label') }))
}

describe('classic toolbar assignments', () => {
  it('rejects repeated actions and shared icons before hidden filtering', () => {
    expect(() => assertUniqueToolbarRows([[{ icon: 'box', label: 'Тело' }, { icon: 'box', label: 'Декор' }]])).toThrow(/box/)
    expect(() => assertUniqueToolbarRows([[{ icon: 'box', label: 'Тело' }, { icon: 'decor', label: 'Тело' }]])).toThrow(/Тело/)
  })
  it('gives every action one button and every button its own icon', () => {
    const bindings = toolbarBindings()
    expect(bindings.length).toBeGreaterThan(20)
    expect(new Set(bindings.map(({ action }) => action)).size).toBe(bindings.length)
    expect(new Set(bindings.map(({ icon }) => icon)).size).toBe(bindings.length)
  })

  it('keeps action names distinct in every supported locale', () => {
    for (const dictionary of [{}, kk, en, uz] as Record<string, string>[]) {
      const names = toolbarBindings().map(({ action }) => dictionary[action] ?? action)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('uses icons that explain the five formerly ambiguous actions', () => {
    expect(Object.fromEntries(toolbarBindings().map(({ action, icon }) => [action, icon]))).toMatchObject({
      'Свойства': 'properties',
      'Цех: материалы и цены': 'shop',
      'Добавить свободную доску': 'board',
      'Добавить текст': 'text',
      'Тело': 'box',
      'Добавить декоративный блок': 'decor',
      'Дублировать корпус': 'duplicate',
      'Размеры на сцене': 'measure',
      'Рендер': 'render',
    })
  })

  it('draws the four new icons as 18 px currentColor SVGs', () => {
    const drawings = ['properties', 'shop', 'text', 'decor'] as const
    const svgs = drawings.map((name) => renderToStaticMarkup(createElement(ClassicIcon, { name })))
    for (const svg of svgs) {
      expect(svg).toContain('width="18" height="18"')
      expect(svg).toContain('stroke="currentColor"')
      expect(svg).toContain('<path')
    }
    expect(new Set(svgs).size).toBe(drawings.length)
  })
})
