/**
 * Генератор/шебер бір бұрышқа тығылмауы керек: галерея басында (кез келген
 * қойындыда), классикалық құрал жолағында, ықшам «Создать» мәзірінде.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassicIcon } from '../components/ClassicIcon'
import { TemplateGallery } from '../components/TemplateGallery'
import { KitchenWizardHost } from '../components/KitchenWizard'
import { useConfigurator } from '../store/configurator'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'

const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')

function withInitial<T>(patch: Record<string, unknown>, run: () => T): T {
  const initial = useConfigurator.getInitialState() as unknown as Record<string, unknown>
  const saved = Object.fromEntries(Object.keys(patch).map((key) => [key, initial[key]]))
  Object.assign(initial, patch)
  try { return run() } finally { Object.assign(initial, saved) }
}

describe('generator entry points', () => {
  it('keeps the wizard open state in the store and opens the quick generator with the gallery', () => {
    const store = useConfigurator
    const before = store.getState()
    try {
      store.getState().setWizardOpen(true)
      expect(store.getState().wizardOpen).toBe(true)
      store.getState().openKitchenGenerator()
      expect(store.getState()).toMatchObject({ galleryOpen: true, kitchenGeneratorOpen: true })
    } finally {
      store.setState({ wizardOpen: before.wizardOpen, galleryOpen: before.galleryOpen, kitchenGeneratorOpen: before.kitchenGeneratorOpen })
    }
  })

  it('shows the generator card at the top of the gallery on the default tab, collapsed until asked', () => {
    const collapsed = withInitial({ galleryOpen: true }, () => renderToString(createElement(TemplateGallery)))
    expect(collapsed).toContain('data-testid="gallery-generator"')
    expect(collapsed).toContain('data-testid="gallery-open-wizard"')
    expect(collapsed).not.toContain('data-testid="gallery-generator-form"')
    expect(collapsed.indexOf('gallery-generator')).toBeLessThan(collapsed.indexOf('template-results'))
    const expanded = withInitial({ galleryOpen: true, kitchenGeneratorOpen: true }, () => renderToString(createElement(TemplateGallery)))
    expect(expanded).toContain('data-testid="gallery-generator-form"')
  })

  it('offers the wizard on the first-run screen', () => {
    const html = withInitial({ galleryOpen: true, firstRun: true }, () => renderToString(createElement(TemplateGallery)))
    expect(html).toContain('data-testid="gallery-open-wizard"')
    expect(html.indexOf('gallery-open-wizard')).toBeLessThan(html.indexOf('first-run-categories'))
  })

  it('mounts the wizard from the store, independent of the gallery', () => {
    expect(withInitial({ wizardOpen: false }, () => renderToString(createElement(KitchenWizardHost)))).toBe('')
    expect(withInitial({ wizardOpen: true }, () => renderToString(createElement(KitchenWizardHost)))).toContain('data-testid="stage-builder-dialog"')
    expect(workspace).toContain('<KitchenWizardHost />')
  })

  it('has a toolbar button with its own icon and a compact «Создать» entry', () => {
    expect(workspace).toContain("{ icon: 'wizard', label: tr('Мастер мебели'), action: () => setWizardOpen(true)")
    const createMenu = workspace.slice(workspace.indexOf("<Menu label={tr('Создать')}"), workspace.indexOf("<Menu label={tr('Проект')}"))
    expect(createMenu).toContain("{tr('Мастер мебели (5 шагов)')}")
    expect(createMenu).toContain("{tr('Генератор кухни')}")
    const svg = renderToStaticMarkup(createElement(ClassicIcon, { name: 'wizard' }))
    expect(svg).toContain('width="18" height="18"')
    for (const other of ['new', 'magnet', 'light'] as const) expect(renderToStaticMarkup(createElement(ClassicIcon, { name: other }))).not.toBe(svg)
    for (const dictionary of [kk, en, uz] as Record<string, string>[]) expect(dictionary['Мастер мебели']).toBeTruthy()
  })
})
