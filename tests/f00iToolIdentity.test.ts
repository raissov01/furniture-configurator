import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassicIcon } from '@/components/ClassicIcon'

describe('classic tools', () => {
  it('uses distinct drawings for selection, perspective, layers and assembly', () => {
    const draw = (name: 'select' | 'view' | 'layers' | 'assembly') =>
      renderToStaticMarkup(createElement(ClassicIcon, { name }))
    expect(new Set((['select', 'view', 'layers', 'assembly'] as const).map(draw)).size).toBe(4)
    const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
    expect(workspace).toContain('<ClassicTool icon="select" label={tr(\'Выбор\')}')
  })

  it('mounts Find only in the tree dock', () => {
    const tree = readFileSync(new URL('../components/panels/TreeDock.tsx', import.meta.url), 'utf8')
    const dock = readFileSync(new URL('../components/dock/WorkspaceDock.tsx', import.meta.url), 'utf8')
    expect(tree).toContain('<FindPanel />')
    expect(dock).not.toContain('<FindPanel />')
  })
})
