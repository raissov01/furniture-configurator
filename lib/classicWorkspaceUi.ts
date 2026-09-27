/** Desktop has one workspace. Reading an old preference always migrates it. */
export function classicWorkspaceStyle(_stored: string | null): 'classic' {
  return 'classic'
}

export function canToggleSelectedDoor(panel: { opening?: unknown } | undefined): boolean {
  return Boolean(panel?.opening)
}
