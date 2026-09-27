/** Walking always uses the Canvas perspective camera; the saved view stays intact. */
export function useOrthographicCamera(projection: 'ortho' | 'perspective', walk: boolean): boolean {
  return projection === 'ortho' && !walk
}
