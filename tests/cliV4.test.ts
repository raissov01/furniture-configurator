/**
 * CLI (`npm run cutlist` / `npm run export`) қосымша сақтайтын v4 файлын да,
 * ескі v1–v3 файлын да оқуы керек. Бұрын v4 файл «Белгісіз schemaVersion: 4»
 * деп stack trace-пен құлайтын.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { parseProjectV4, productionCabinets } from '../src/core/index'
import type { GroupNode } from '../src/core/index'
import { referenceProject } from './fixtures'

const dir = mkdtempSync(join(tmpdir(), 'cli-v4-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('CLI v4 файлын оқиды', () => {
  it('cutlist v4 жобаны басып шығарады', () => {
    const file = join(dir, 'project-v4.json')
    writeFileSync(file, JSON.stringify(parseProjectV4(referenceProject)))
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/cutlist.ts', file], { encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    expect(run.stdout).toContain(referenceProject.cabinets[0]!.name)
  }, 60_000)
})

describe('productionCabinets', () => {
  it('жасырын түйін, жасырын топ пен жасырын қабаттағы шкафты алмайды, ретін сақтайды', () => {
    const project = parseProjectV4(referenceProject)
    const cabinet = project.root.children[0]!
    const at = (id: string, extra: object = {}) => ({ ...cabinet, id, name: id, ...extra })
    project.root = { ...project.root, children: [
      at('a'),
      at('hidden', { hidden: true }),
      { kind: 'group', id: 'g', name: 'g', transform: cabinet.transform, children: [at('inGroup')] },
      { kind: 'group', id: 'gh', name: 'gh', transform: cabinet.transform, hidden: true, children: [at('inHiddenGroup')] },
      at('offLayer', { layerId: 'off' }),
    ] } as GroupNode
    project.layers = [{ id: 'off', name: 'off', visible: false, locked: false, color: '#000000' }]
    expect(productionCabinets(project).map((c) => c.id)).toEqual(['a', 'inGroup'])
  })
})
