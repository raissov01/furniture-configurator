import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IDENTITY_TRANSFORM } from '../src/core/tree'
import type { GroupNode } from '../src/core/index'
import { StructureTreeView } from '../components/panels/StructurePanel'
import { buildCanonicalRows } from '../components/panels/canonicalTreeRows'

const root: GroupNode = {
  kind: 'group', id: 'root', name: 'Project', transform: IDENTITY_TRANSFORM,
  children: [{ kind: 'solid', id: 'sink', name: 'Sink', transform: IDENTITY_TRANSFORM, solid: { size: { x: 100, y: 100, z: 100 } } }],
}

describe('StructureTreeView markup', () => {
  it('renders one accessible tree with real node IDs and controls', () => {
    const rows = buildCanonicalRows(root, { nodes: [], solids: [] }, [{ id: 'default', name: 'Default', color: '#999999', visible: true, locked: false }])
    const html = renderToStaticMarkup(createElement(StructureTreeView, {
      root, rows, activeId: 'sink', selected: null,
      onSelectNode: vi.fn(), onSelectPart: vi.fn(), onRename: vi.fn(),
      onHidden: vi.fn(), onLocked: vi.fn(), onGroup: vi.fn(), onUngroup: vi.fn(), onReparent: vi.fn(), onArray: vi.fn(), onArrange: vi.fn(), onAutoJoint: vi.fn(),
    }))
    expect(html).toContain('data-testid="arrange-tools"')
    expect(html).toContain('data-testid="property-tools"')
    expect(html).toContain('data-testid="scale-tools"')
    expect(html).toContain('aria-label="Ось масштабирования"')
    expect(html).toContain('data-testid="snap-tools"')
    expect(html).toContain('arrange-distribute')
    expect(html).toContain('Массив')
    expect(html).toContain('role="tree"')
    expect(html).toContain('data-tree-node="sink"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('Sink')
    expect(html).toContain('aria-label="Скрыть"')
    expect(html).toContain('aria-label="Заблокировать"')
  })
})
