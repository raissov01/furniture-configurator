import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4 } from '../src/core/index'
import type { BoardNode, ProjectFileV4 } from '../src/core/index'
import { PVC2, referenceProject } from './fixtures'

const repo = fileURLToPath(new URL('../', import.meta.url))
const temporary: string[] = []
function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'furniture-cli-v4-'))
  temporary.push(dir)
  return dir
}
function run(entry: 'cutlist' | 'export', file: string, out?: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', `src/cli/${entry}.ts`, file,
    ...(out ? ['--out', out] : [])], { cwd: repo, encoding: 'utf8', timeout: 30000 })
}
function board(): BoardNode {
  return {
    kind: 'board', id: 'free-board', name: 'CLI еркін тақта', transform: IDENTITY_TRANSFORM,
    board: {
      materialId: referenceProject.materials[0]!.id, length: 600, width: 400,
      orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: true,
      edges: { L1: { bandId: PVC2 }, L2: null, W1: null, W2: null },
    },
  }
}
function fixture(dir: string, project: unknown, name = 'project.json') {
  const path = join(dir, name)
  writeFileSync(path, JSON.stringify(project))
  return path
}
function nested(): ProjectFileV4 {
  const project = parseProjectV4(referenceProject)
  project.root.children = [{
    kind: 'group', id: 'nested', name: 'Топ', transform: IDENTITY_TRANSFORM,
    children: [...project.root.children, board(), { ...board(), id: 'hidden', name: 'ЖАСЫРЫН', hidden: true },
      { kind: 'solid', id: 'decor', name: 'ДЕКОР', transform: IDENTITY_TRANSFORM,
        solid: { size: { x: 100, y: 100, z: 100 } } }],
  }]
  return project
}

afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('CLI accepts the canonical saved v4 project', () => {
  it('keeps board DXF filenames inside their export folder without encoding collisions', () => {
    const dir = folder()
    const project = nested()
    const ids = ['../../../escaped', '..%2F..%2F..%2Fescaped']
    project.root.children = ids.map((id) => ({ ...board(), id }))
    const out = join(dir, 'output')
    const result = run('export', fixture(dir, project), out)
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(join(dir, 'escaped.dxf'))).toBe(false)
    for (const id of ids) {
      expect(readdirSync(join(out, encodeURIComponent(id), 'dxf')))
        .toEqual([`${encodeURIComponent(id)}.dxf`])
    }
  })

  it('keeps node ids containing path separators inside the chosen export directory', () => {
    const dir = folder()
    const project = nested()
    project.root.children = [{ ...board(), id: '../escaped' }]
    const result = run('export', fixture(dir, project), join(dir, 'output'))
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(join(dir, 'escaped'))).toBe(false)
    expect(existsSync(join(dir, 'output', '..%2Fescaped', 'cutlist.csv'))).toBe(true)
  })

  it('prints nested cabinet and board cut sizes without hidden nodes or decorative solids', () => {
    const result = run('cutlist', fixture(folder(), nested()))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Деталей: 11')
    expect(result.stdout).toContain('CLI еркін тақта')
    expect(result.stdout).toContain('398')
    expect(result.stdout).not.toContain('ЖАСЫРЫН')
    expect(result.stdout).not.toContain('ДЕКОР')
  })

  it('keeps the reference cabinet cut-list output identical after migration', () => {
    const dir = folder()
    const old = run('cutlist', fixture(dir, referenceProject, 'v3.json'))
    const migrated = run('cutlist', fixture(dir, parseProjectV4(referenceProject), 'v4.json'))
    expect(old.status, old.stderr).toBe(0)
    expect(migrated.status, migrated.stderr).toBe(0)
    expect(migrated.stdout).toBe(old.stdout)
  })

  it('exports identical cabinet CSV and DXF and includes a free board', () => {
    const dir = folder()
    const oldOut = join(dir, 'old')
    const newOut = join(dir, 'tree')
    const old = run('export', fixture(dir, referenceProject, 'v3.json'), oldOut)
    const migrated = run('export', fixture(dir, nested(), 'v4.json'), newOut)
    expect(old.status, old.stderr).toBe(0)
    expect(migrated.status, migrated.stderr).toBe(0)
    const cabinetId = referenceProject.cabinets[0]!.id
    for (const name of ['cutlist.csv', 'drilling.csv', 'cutlist.xlsx']) {
      expect(readFileSync(join(newOut, cabinetId, name))).toEqual(readFileSync(join(oldOut, cabinetId, name)))
    }
    for (const name of readdirSync(join(oldOut, cabinetId, 'dxf'))) {
      expect(readFileSync(join(newOut, cabinetId, 'dxf', name)))
        .toEqual(readFileSync(join(oldOut, cabinetId, 'dxf', name)))
    }
    expect(readFileSync(join(newOut, cabinetId, 'assembly.pdf')).subarray(0, 5).toString()).toBe('%PDF-')
    expect(readFileSync(join(newOut, 'free-board', 'cutlist.csv'), 'utf8')).toContain('398')
    expect(readdirSync(newOut).sort()).toEqual([cabinetId, 'free-board'].sort())
  }, 30000)
})
