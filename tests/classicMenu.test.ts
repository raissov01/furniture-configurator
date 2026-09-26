/**
 * Классикалық мәзір (P0-1): әр пункт әрекетті ТІКЕЛЕЙ шақырады, жасырын
 * header батырмасын `.click()` етпейді. Классикалық режимде ол header
 * `display:none`, сондықтан «Файл → Экспорт для цеха» ештеңе ашпайтын.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classicMenus, type ClassicMenuState, type ClassicMenuEntry, type ClassicCommand } from '../lib/classicMenu'
import { projectFileName, parseProjectFileText } from '../lib/projectFile'
import { runShopExport, shopExportFileName } from '../lib/shopExport'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const base: ClassicMenuState = {
  canUndo: true, canRedo: false, activeEditable: true, editableBoard: false, canRemoveCabinet: true,
  canExport: true, canExportPdf: true, productionError: false,
  cameraPreset: 'front', viewMode: 'solid', showFronts: true, projection: 'perspective', showDimensions: false,
  showDrilling: false, showFittings: false, silhouetteOn: false, open: false, assembly: false,
  theme: 'system', quality: 'high', lang: 'ru', price: null, cloud: false, classic: true,
}

const items = (state: ClassicMenuState = base) => classicMenus(state).flatMap((menu) => menu.items.map((item) => ({ menu: menu.id, item })))
const commands = (entries: { item: ClassicMenuEntry }[]) => entries.flatMap(({ item }) => item.kind === 'item' ? [item.command] : [])
const find = (id: string, state?: ClassicMenuState) => {
  const found = items(state).find(({ item }) => item.kind === 'item' && item.id === id)?.item
  if (!found || found.kind !== 'item') throw new Error(`menu item ${id} missing`)
  return found
}

describe('classic menu', () => {
  it('keeps the PRO100 order of top menus', () => {
    expect(classicMenus(base).map((menu) => menu.label).slice(0, 5)).toEqual(['Файл', 'Правка', 'Вид', 'Элемент', 'Инструменты'])
    expect(classicMenus(base).at(-1)?.label).toBe('Справка')
  })

  it('exports every shop format straight from «Файл», without the hidden header', () => {
    const file = classicMenus(base).find((menu) => menu.id === 'file')!
    const exports = file.items.flatMap((item) => item.kind === 'item' && item.command.type === 'export' ? [item.command.format] : [])
    expect(exports).toEqual(['xlsx', 'csv', 'dxf', 'pdf'])
    expect(find('file.export.xlsx').disabled).toBe(false)
    expect(find('file.export.xlsx', { ...base, canExport: false }).disabled).toBe(true)
    expect(find('file.export.pdf', { ...base, canExportPdf: false }).disabled).toBe(true)
  })

  it('opens and saves the project file with its own commands', () => {
    expect(find('file.save').command).toEqual({ type: 'saveProject' } satisfies ClassicCommand)
    expect(find('file.open').command).toEqual({ type: 'openProject' } satisfies ClassicCommand)
  })

  it('gives every entry a unique id and a command object (no DOM selectors)', () => {
    const ids = items().flatMap(({ item }) => item.kind === 'separator' ? [] : [item.id])
    expect(new Set(ids).size).toBe(ids.length)
    for (const command of commands(items())) {
      expect(typeof command.type).toBe('string')
      expect(JSON.stringify(command)).not.toMatch(/\[data-|#project-open-input|querySelector/)
    }
  })

  it('mirrors availability of undo/redo and cabinet actions', () => {
    expect(find('edit.undo').disabled).toBe(false)
    expect(find('edit.redo').disabled).toBe(true)
    expect(find('element.remove', { ...base, canRemoveCabinet: false }).disabled).toBe(true)
    expect(find('tools.quote', { ...base, productionError: true }).disabled).toBe(true)
  })

  it('Workspace never clicks a hidden DOM button from a menu or toolbar', () => {
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/(querySelector|getElementById)\b[^\n]*\?\.click\(\)/)
  })
})

describe('classic menu: settings hidden in the old header (P0-5)', () => {
  const menu = (id: string, state: ClassicMenuState = base) => classicMenus(state).find((entry) => entry.id === id)!
  const itemsOf = (id: string, state?: ClassicMenuState) => menu(id, state).items.flatMap((item) => item.kind === 'item' ? [item] : [])

  it('Вид offers theme and 3D quality, marking the current ones', () => {
    const view = itemsOf('view', { ...base, theme: 'dark', quality: 'low' })
    const themes = view.filter((item) => item.command.type === 'theme')
    expect(themes.map((item) => item.command)).toEqual([
      { type: 'theme', theme: 'system' }, { type: 'theme', theme: 'light' }, { type: 'theme', theme: 'dark' },
    ])
    expect(themes.filter((item) => item.active).map((item) => item.id)).toEqual(['view.theme.dark'])
    const qualities = view.filter((item) => item.command.type === 'quality')
    expect(qualities.map((item) => item.command)).toEqual([
      { type: 'quality', quality: 'high' }, { type: 'quality', quality: 'medium' }, { type: 'quality', quality: 'low' },
    ])
    expect(qualities.filter((item) => item.active).map((item) => item.id)).toEqual(['view.quality.low'])
  })

  it('Сервис sits before Справка and switches language with native names', () => {
    expect(classicMenus(base).map((entry) => entry.id).slice(-2)).toEqual(['service', 'help'])
    const langs = itemsOf('service', { ...base, lang: 'kk' }).filter((item) => item.command.type === 'lang')
    expect(langs.map((item) => item.command)).toEqual([
      { type: 'lang', lang: 'ru' }, { type: 'lang', lang: 'kk' }, { type: 'lang', lang: 'uz' }, { type: 'lang', lang: 'en' },
    ])
    expect(langs.every((item) => item.raw)).toBe(true)
    expect(langs.find((item) => item.active)?.label).toBe('Қазақша')
  })

  it('Сервис shows the live price (opens the quote) or asks for prices (opens the shop)', () => {
    expect(itemsOf('service').some((item) => item.id === 'service.price')).toBe(false)
    const priced = itemsOf('service', { ...base, price: { total: '763 490 ₸' } }).find((item) => item.id === 'service.price')!
    expect(priced.detail).toBe('763 490 ₸')
    expect(priced.command).toEqual({ type: 'open', panel: 'quote' })
    const missing = itemsOf('service', { ...base, price: { missing: true } }).find((item) => item.id === 'service.price')!
    expect(missing.label).toBe('Цены не заданы')
    expect(missing.command).toEqual({ type: 'open', panel: 'shop' })
  })

  it('Сервис has «Аккаунт» only when the cloud is on, and the workplace style switch', () => {
    expect(itemsOf('service').some((item) => item.id === 'service.account')).toBe(false)
    expect(itemsOf('service', { ...base, cloud: true }).find((item) => item.id === 'service.account')?.command)
      .toEqual({ type: 'open', panel: 'account' })
    const styles = itemsOf('service').filter((item) => item.command.type === 'workspaceStyle')
    expect(styles.map((item) => [item.command, item.active])).toEqual([
      [{ type: 'workspaceStyle', classic: true }, true], [{ type: 'workspaceStyle', classic: false }, false],
    ])
  })

  it('Workspace wires the new commands and shows the price in the classic status bar', () => {
    const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/case 'theme':[^\n]*chooseTheme\(command\.theme\)/)
    expect(source).toMatch(/case 'quality':[^\n]*saveQuality\(command\.quality\)/)
    expect(source).toMatch(/case 'lang':[^\n]*setLang\(command\.lang\)/)
    expect(source).toMatch(/case 'workspaceStyle':[^\n]*changeStyle\(command\.classic\)/)
    expect(source).toContain('data-testid="p100-status-price"')
  })
})

describe('project file helpers', () => {
  it('names the download after the project', () => {
    expect(projectFileName({ name: 'Кухня' })).toBe('Кухня.json')
    expect(projectFileName({ name: '' })).toBe('проект.json')
  })

  it('parses a saved project and rejects garbage with a readable error', () => {
    const text = JSON.stringify(useConfigurator.getState().exportProject())
    expect(parseProjectFileText(text).schemaVersion).toBe(4)
    expect(() => parseProjectFileText('{nope')).toThrow()
  })
})

describe('shop export', () => {
  it('builds stable file names per format', () => {
    expect(shopExportFileName('k1', 'xlsx')).toBe('k1-cutlist.xlsx')
    expect(shopExportFileName('k1', 'csv')).toBe('k1-cutlist.csv')
    expect(shopExportFileName('k1', 'dxf')).toBe('k1-dxf.zip')
    expect(shopExportFileName('k1', 'pdf')).toBe('k1-assembly.pdf')
  })

  it('writes the CSV through the given saver (no hidden menu needed)', async () => {
    useConfigurator.getState().loadProject(referenceProject)
    const state = useConfigurator.getState()
    const cabinet = state.cabinets.find((entry) => entry.id === state.activeId)!
    const { generateCabinet } = await import('../src/core/index')
    const panels = generateCabinet(cabinet, state.catalog, state.projectSettings ?? state.shop.settings)
    const saved: { name: string; mime: string; size: number }[] = []
    await runShopExport('csv', { cabinet, panels, catalog: state.catalog, settings: state.projectSettings ?? state.shop.settings, projectInfo: state.projectInfo },
      (name, data, mime) => { saved.push({ name, mime, size: typeof data === 'string' ? data.length : data.byteLength }) })
    expect(saved).toHaveLength(1)
    expect(saved[0]!.name).toBe(`${cabinet.id}-cutlist.csv`)
    expect(saved[0]!.mime).toContain('text/csv')
    expect(saved[0]!.size).toBeGreaterThan(20)
  })
})
