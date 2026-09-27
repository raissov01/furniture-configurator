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
