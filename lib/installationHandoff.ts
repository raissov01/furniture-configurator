import { parseInstallationAction, type InstallationAction } from '@/src/core/installation'

/** A saved cloud project is the only source for a new installation task. */
export function installationCreateAction(projectId: string, taskId: string, actionId: string, now: number): InstallationAction {
  return parseInstallationAction({ id: actionId, kind: 'installation.create', entityId: taskId,
    payload: { projectId }, baseRevision: { version: 0, updatedAt: 0 }, createdAt: now })
}
