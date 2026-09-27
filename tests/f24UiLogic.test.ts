import { describe, expect, it } from 'vitest'
import { canCreateFolder, cloudCopyProject, cloudSaveOutcome, cloudSavePayload, deleteFolder, renameFolder, revisionDecision, historySummary, nextHistoryId, parseCloudSelection, shouldMigrateCloudOrg } from '../lib/f24UiLogic'
import { parseCloudOrg } from '../src/core/cloudProjectOrganize'

describe('F24 UI decisions', () => {
  it('updates an opened cloud project and makes a separate copy', () => {
    const project = { name: 'Шкаф' }
    expect(cloudSavePayload(project, { id: 'p1', revision: 3 }, false)).toEqual({ project, id: 'p1', baseRevision: 3 })
    expect(cloudSavePayload(project, { id: 'p1', revision: 3 }, true)).toEqual({ project })
    expect(parseCloudSelection('{"id":"p1","revision":3}')).toEqual({ id: 'p1', revision: 3 })
    expect(parseCloudSelection('{"id":"p1","revision":-1}')).toBeNull()
    expect(cloudCopyProject(project)).toEqual({ name: 'Шкаф (копия)' })
    expect(cloudSaveOutcome(200, { id: 'p1', revision: 4 }, { id: 'p1', revision: 3 })).toEqual({ kind: 'saved', selection: { id: 'p1', revision: 4 } })
    expect(cloudSaveOutcome(409, { revision: 4 }, { id: 'p1', revision: 3 })).toEqual({ kind: 'conflict', id: 'p1', revision: 4 })
    expect(cloudSaveOutcome(409, { error: 'Лимит' }, null)).toEqual({ kind: 'error', message: 'Лимит' })
  })

  it('does not silently overwrite another tab revision', () => {
    expect(revisionDecision({ revision: 2, tabId: 'other' }, { revision: 1, tabId: 'mine' })).toBe('conflict')
    expect(revisionDecision({ revision: 2, tabId: 'mine' }, { revision: 1, tabId: 'mine' })).toBe('save')
  })

  it('renames and removes a folder without losing project assignments', () => {
    const org = { ...parseCloudOrg(null), folders: ['A', 'B'], projectFolders: { p1: 'A' } }
    expect(renameFolder(org, 'A', 'C')).toEqual({ ...org, folders: ['C', 'B'], projectFolders: { p1: 'C' } })
    expect(deleteFolder(org, 'A')).toEqual({ ...org, folders: ['B'], projectFolders: {} })
    expect(() => renameFolder(org, 'A', '')).toThrow(/1–80/)
    expect(canCreateFolder('  ')).toBe(false)
    expect(canCreateFolder('Жаңа')).toBe(true)
    expect(shouldMigrateCloudOrg(parseCloudOrg(null), JSON.stringify(org))).toBe(true)
    expect(shouldMigrateCloudOrg(org, JSON.stringify(org))).toBe(false)
  })

  it('distinguishes same-name history entries by tree contents', () => {
    const root = { kind: 'group', children: [{ kind: 'cabinet' }, { kind: 'cabinet' }, { kind: 'board' }] }
    expect(historySummary(JSON.stringify({ root }))).toEqual({ cabinets: 2, boards: 1 })
    expect(nextHistoryId(100, 100)).toBe(101)
  })
})
