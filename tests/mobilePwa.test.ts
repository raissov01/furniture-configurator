import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('телефон PWA кіру нүктесі', () => {
  it('орнатылған қосымшаны «Тапсырыс» экранынан бастайды', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/manifest.webmanifest'), 'utf8')) as {
      start_url: string; scope: string; display: string; shortcuts: { url: string }[]
    }
    expect(manifest.start_url).toBe('/mobile')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.shortcuts.some((shortcut) => shortcut.url === '/configurator')).toBe(true)
  })
  it('жаңа worker телефон бетін алдын ала кэштеп, API мен IndexedDB-ге тимейді', () => {
    const worker = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')
    expect(worker).toMatch(/cache\.add\(['"]\/mobile['"]\)/)
    expect(worker).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/)
    expect(worker).not.toMatch(/indexedDB\.deleteDatabase|caches\.delete\(['"]tapsyrys/)
  })
})
