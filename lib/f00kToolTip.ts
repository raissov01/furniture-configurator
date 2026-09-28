export function classicToolTip(label: string, disabled: boolean | undefined, reason?: string): string {
  return disabled && reason ? `${label}: ${reason}` : label
}
