/** Native tooltip for a classic command, built from its visible localized label. */
export function classicMenuItemTitle(label: string, hint?: string): string {
  return hint ? `${label} · ${hint}` : label
}
