import { describe, expect, it } from 'vitest'
import { parseCloudOrg, organizeProjects, moveProjectToFolder } from '../src/core/cloudProjectOrganize'

const rows = [
  { id: 'old', name: 'Zeta', updatedAt: 1 },
  { id: 'new', name: 'Alpha', updatedAt: 2 },
]

describe('cloud project organization metadata', () => {
  it('migrates existing projects to the unfiled view', () => {
    const org = parseCloudOrg(null)
    expect(organizeProjects(rows, org, 'unfiled').map((p) => p.id)).toEqual(['new', 'old'])
  })

  it('moves a project without touching its content and sorts by name', () => {
    const org = moveProjectToFolder(parseCloudOrg(null), 'old', 'Wardrobes')
    const byName = { ...org, sort: 'name' as const }
    expect(organizeProjects(rows, byName, 'all').map((p) => p.name)).toEqual(['Alpha', 'Zeta'])
    expect(organizeProjects(rows, byName, 'folder:Wardrobes').map((p) => p.id)).toEqual(['old'])
    expect(rows[0]).toEqual({ id: 'old', name: 'Zeta', updatedAt: 1 })
    expect(parseCloudOrg(JSON.stringify(byName))).toEqual(byName)
  })
})
