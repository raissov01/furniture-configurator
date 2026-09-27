import type { CloudOrg } from '@/src/core/cloudProjectOrganize'
import { nextCopyName } from '@/src/core/copyName'

export type CloudSelection = { id: string; revision: number }
export const CLOUD_SELECTION_KEY = 'furniture-configurator:cloud-selection'
export function parseCloudSelection(raw: string | null): CloudSelection | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const entry = value as Partial<CloudSelection>
    return typeof entry.id === 'string' && entry.id.length > 0 && Number.isSafeInteger(entry.revision) && entry.revision! >= 0
      ? { id: entry.id, revision: entry.revision! } : null
  } catch { return null }
}
export type LocalRevision = { revision: number; tabId: string }

export function cloudSavePayload(project: unknown, selected: CloudSelection | null, copy: boolean) {
  return selected && !copy
    ? { project, id: selected.id, baseRevision: selected.revision }
    : { project }
}

export function cloudCopyProject<T extends { name: string }>(project: T, existingNames: Iterable<string> = []): T {
  return { ...project, name: nextCopyName(project.name, existingNames) }
}

export function cloudSaveOutcome(status: number, data: { id?: unknown; revision?: unknown; error?: unknown }, selected: CloudSelection | null):
  | { kind: 'saved'; selection: CloudSelection }
  | { kind: 'conflict'; id: string; revision: number }
  | { kind: 'error'; message: string } {
  const revision = Number.isSafeInteger(data.revision) && (data.revision as number) >= 0 ? data.revision as number : null
  if (status === 409 && selected && revision !== null) return { kind: 'conflict', id: selected.id, revision }
  if (status >= 200 && status < 300 && typeof data.id === 'string' && data.id && revision !== null) {
    return { kind: 'saved', selection: { id: data.id, revision } }
  }
  return { kind: 'error', message: typeof data.error === 'string' ? data.error : 'Проект не сохранился' }
}

export function canCreateFolder(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 80
}

export function revisionDecision(stored: LocalRevision | null, own: LocalRevision | null): 'save' | 'conflict' {
  return stored && (!own || (stored.tabId !== own.tabId && stored.revision !== own.revision)) ? 'conflict' : 'save'
}

function validFolder(name: string): string {
  const value = name.trim()
  if (!value || value.length > 80) throw new Error('Папка атауы: 1–80 таңба')
  return value
}

export function renameFolder(org: CloudOrg, oldName: string, newName: string): CloudOrg {
  const name = validFolder(newName)
  if (!org.folders.includes(oldName)) throw new Error('Папка табылмады')
  if (name !== oldName && org.folders.includes(name)) throw new Error('Папка атауы қайталанды')
  const projectFolders = Object.fromEntries(Object.entries(org.projectFolders).map(([id, folder]) => [id, folder === oldName ? name : folder]))
  return { ...org, folders: org.folders.map((folder) => folder === oldName ? name : folder), projectFolders }
}

export function deleteFolder(org: CloudOrg, name: string): CloudOrg {
  const projectFolders = Object.fromEntries(Object.entries(org.projectFolders).filter(([, folder]) => folder !== name))
  return { ...org, folders: org.folders.filter((folder) => folder !== name), projectFolders }
}

export function shouldMigrateCloudOrg(server: CloudOrg, legacy: string | null): boolean {
  return legacy !== null && server.folders.length === 0 && Object.keys(server.projectFolders).length === 0 && server.sort === 'date'
}

export function historySummary(json: string): { cabinets: number; boards: number } {
  const value: unknown = JSON.parse(json)
  let cabinets = 0
  let boards = 0
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const item = node as { kind?: unknown; children?: unknown }
    if (item.kind === 'cabinet') cabinets++
    if (item.kind === 'board') boards++
    if (Array.isArray(item.children)) item.children.forEach(visit)
  }
  if (value && typeof value === 'object') visit((value as { root?: unknown }).root)
  return { cabinets, boards }
}

export function nextHistoryId(now: number, previous: number | undefined): number {
  return Math.max(now, (previous ?? -1) + 1)
}
