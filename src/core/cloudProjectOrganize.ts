import { z } from 'zod'

const CloudOrgSchema = z.object({
  version: z.literal(1),
  folders: z.array(z.string().min(1).max(80)),
  projectFolders: z.record(z.string(), z.string()),
  sort: z.enum(['date', 'name']),
}).strict()

export type CloudOrg = z.infer<typeof CloudOrgSchema>
export type CloudProjectRow = { id: string; name: string; updatedAt: number }

export function parseCloudOrg(raw: string | null): CloudOrg {
  if (raw === null) return { version: 1, folders: [], projectFolders: {}, sort: 'date' }
  return CloudOrgSchema.parse(JSON.parse(raw) as unknown)
}

export function addCloudFolder(org: CloudOrg, name: string): CloudOrg {
  const folder = name.trim()
  if (!folder || folder.length > 80) throw new Error('folder name: 1–80 characters')
  if (org.folders.includes(folder)) return org
  return { ...org, folders: [...org.folders, folder] }
}

export function moveProjectToFolder(org: CloudOrg, id: string, folder: string | null): CloudOrg {
  if (folder !== null && !org.folders.includes(folder)) {
    org = addCloudFolder(org, folder)
  }
  const projectFolders = { ...org.projectFolders }
  if (folder === null) delete projectFolders[id]
  else projectFolders[id] = folder
  return { ...org, projectFolders }
}

export function organizeProjects<T extends CloudProjectRow>(
  rows: readonly T[], org: CloudOrg, folder: 'all' | 'unfiled' | `folder:${string}`,
): T[] {
  const filtered = rows.filter((row) => {
    const assigned = org.projectFolders[row.id] ?? null
    return folder === 'all' || (folder === 'unfiled' ? assigned === null : assigned === folder.slice(7))
  })
  return filtered.sort((a, b) => org.sort === 'name'
    ? a.name.localeCompare(b.name) || b.updatedAt - a.updatedAt
    : b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
}
