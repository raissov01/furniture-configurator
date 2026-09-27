/** Walking always uses the Canvas perspective camera; the saved view stays intact. */
export function useOrthographicCamera(projection: 'ortho' | 'perspective', walk: boolean): boolean {
  return projection === 'ortho' && !walk
}

/** A plan preset always starts with parallel projection, regardless of the prior tab. */
export function projectionForPreset(
  preset: string,
  current: 'ortho' | 'perspective',
): 'ortho' | 'perspective' {
  return preset === 'plan' ? 'ortho' : current
}
