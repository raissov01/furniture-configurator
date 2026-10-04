import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { parseProjectV4 } from '../src/core/projectV4'
import { referenceProject } from './fixtures'

it.each(['cutlist', 'export'])('%s preflights the entire project before any manufacturing output', entry => {
  const directory = mkdtempSync(join(tmpdir(), 'cli-manufacturing-'))
  try {
    const project = parseProjectV4(referenceProject)
    // The valid cabinet is deliberately first: no prefix may be exported before refusal.
    project.root.children.push({ kind: 'board', id: 'blocked', name: 'Incomplete import',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      board: { length: 100, width: 100, materialId: project.materials[0]!.id,
        orientation: { length: 'x', width: 'z', thickness: 'y' },
        edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false,
        role: 'custom', manufacturingBlockReason: 'groove-unsupported: incomplete import' } })
    const input = join(directory, 'input.json'), output = join(directory, 'output')
    writeFileSync(input, JSON.stringify(project))
    const result = spawnSync(process.execPath, ['--import', 'tsx', `src/cli/${entry}.ts`, input, '--out', output],
      { cwd: process.cwd(), encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('groove-unsupported')
    expect(result.stderr).not.toContain('at main')
    expect(result.stdout).not.toContain('РЕЗ · цех')
    expect(existsSync(output)).toBe(false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}, 20_000)
