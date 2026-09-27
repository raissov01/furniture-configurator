import { projectFingerprint } from '@/src/core/approval'
import { parseProjectV4 } from '@/src/core/projectV4'

export const CLOUD_PROJECT_BINDING_KEY = 'aismebel:cloud-project-binding'
export type CloudProjectBinding = { id: string; fingerprint: string }

export function parseCloudProjectBinding(raw: string | null): CloudProjectBinding | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !('id' in value) || !('fingerprint' in value) ||
      typeof value.id !== 'string' || !value.id.trim() || typeof value.fingerprint !== 'string' || !value.fingerprint.trim()) return null
    return { id: value.id, fingerprint: value.fingerprint }
  } catch { return null }
}

export function activeCloudProjectId(fingerprint: string, binding: CloudProjectBinding | null): string | null {
  return binding?.fingerprint === fingerprint ? binding.id : null
}

export async function bindCloudProject(id: string, project: unknown): Promise<void> {
  if (!id.trim()) throw new Error('Сақталған жоба ID-і бос')
  const fingerprint = await projectFingerprint(parseProjectV4(project))
  window.localStorage.setItem(CLOUD_PROJECT_BINDING_KEY, JSON.stringify({ id, fingerprint } satisfies CloudProjectBinding))
}

export async function currentCloudProjectId(project: unknown, rawBinding: string | null): Promise<string | null> {
  const fingerprint = await projectFingerprint(parseProjectV4(project))
  return activeCloudProjectId(fingerprint, parseCloudProjectBinding(rawBinding))
}
