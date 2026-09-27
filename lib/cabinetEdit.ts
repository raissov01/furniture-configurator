/** An edit with identical values has no effect on the canonical tree or undo stack. */
export function changesCabinet<T extends object>(cabinet: T | undefined, patch: Partial<T>): boolean {
  return cabinet !== undefined && Object.entries(patch).some(([key, value]) =>
    !Object.is(cabinet[key as keyof T], value))
}
