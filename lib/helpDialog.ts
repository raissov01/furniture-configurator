export function helpDialogKeyAction(key: string, open: boolean): 'close' | null {
  return open && key === 'Escape' ? 'close' : null
}
