import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { classicMenus, type ClassicMenuState } from '../lib/classicMenu'
import { classicWorkspaceStyle, canToggleSelectedDoor } from '../lib/classicWorkspaceUi'
import { parseSilhouetteHeight } from '../lib/silhouetteInput'

const source = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
const mesh = readFileSync(new URL('../components/PanelMesh.tsx', import.meta.url), 'utf8')

const state: ClassicMenuState = {
  canUndo: false, canRedo: false, activeEditable: true, editableBoard: false, canRemoveCabinet: false,
  canExport: false, canExportPdf: false, productionError: false, cameraPreset: 'front', viewMode: 'solid',
  showFronts: true, projection: 'perspective', showDimensions: false, showDrilling: false, showFittings: false,
  silhouetteOn: true, open: false, assembly: false, theme: 'system', quality: 'high', lang: 'ru', price: null,
  cloud: false,
}

describe('F00c classic desktop parity', () => {
  it('keeps AR, VR, the person height input and the view actions reachable', () => {
    expect(source).toContain('data-testid="classic-ar"')
    expect(source).toContain('data-testid="classic-vr"')
    expect(source).toContain('data-testid="classic-silhouette-height"')
    expect(classicMenus(state).find((menu) => menu.id === 'view')?.items.some((entry) => entry.kind === 'silhouetteHeight')).toBe(true)
    expect(parseSilhouetteHeight('').value).toBeUndefined()
    expect(parseSilhouetteHeight('1700.5').value).toBeUndefined()
    expect(parseSilhouetteHeight('1700').value).toBe(1700)
  })

  it('opens only an actual selected door or drawer through the Element action', () => {
    expect(canToggleSelectedDoor(undefined)).toBe(false)
    expect(canToggleSelectedDoor({ opening: false })).toBe(false)
    expect(canToggleSelectedDoor({ opening: true })).toBe(true)
    const element = classicMenus(state).find((menu) => menu.id === 'element')!
    expect(element.items.some((entry) => entry.kind === 'item' && entry.id === 'element.selectedDoor')).toBe(true)
    const openItem = classicMenus({ ...state, selectedDoor: true, selectedDoorOpen: true })
      .find((menu) => menu.id === 'element')?.items.find((entry) => entry.kind === 'item' && entry.id === 'element.selectedDoor')
    expect(openItem && openItem.kind === 'item' ? openItem.label : null).toBe('Закрыть дверцу')
    expect(source).toContain("id: 'door'")
    expect(mesh).toContain('onContextMenu=')
    expect(mesh).toContain('openProperties()')
  })

  it('shows project title and direct toolbar actions', () => {
    expect(source).toContain('data-testid="classic-project-title"')
    for (const id of ['walk', 'open-all', 'ghost', 'find', 'replace'])
      expect(source).toContain(`id: '${id}'`)
  })

  it('migrates the old desktop choice and retains compact controls below 1024 px', () => {
    expect(classicWorkspaceStyle('ours')).toBe('classic')
    expect(classicWorkspaceStyle('classic')).toBe('classic')
    expect(classicWorkspaceStyle(null)).toBe('classic')
    expect(source).not.toContain('value="ours"')
    expect(source).not.toContain('changeStyle(')
    expect(source).toContain('data-testid="mobile-tree-dock"')
    expect(source).toContain('lg:hidden')
  })
})
