/** Ашылған реті — модал қабаттарының жалғыз өлшемі. */
export function openModal(stack: readonly string[], id: string): string[] {
  return [...stack.filter((entry) => entry !== id), id]
}

export function closeModal(stack: readonly string[], id: string): string[] {
  return stack.filter((entry) => entry !== id)
}

export function modalZIndex(stack: readonly string[], id: string): number {
  return 80 + Math.max(0, stack.indexOf(id)) * 10
}

export function modalBlocksHotkeys(stack: readonly string[]): boolean {
  return stack.length > 0
}

export function shouldCloseModalKey(key: string, isTop: boolean): boolean {
  return key === 'Escape' && isTop
}

export function tourZIndex(stack: readonly string[]): number {
  const top = stack.at(-1)
  if (!top) return 60
  return modalZIndex(stack, top) - (top === 'help' ? 5 : -5)
}
