/** Follow the selected decor's generated label only until the user edits that label. */
export function updateCatalogMaterialName(
  name: string, autoName: string | null, oldThickness: number, newThickness: number,
): { name: string; autoName: string | null } {
  const suffix = `${oldThickness} мм`
  if (autoName === null || name !== autoName || !autoName.endsWith(suffix)) return { name, autoName: null }
  const next = `${autoName.slice(0, -suffix.length)}${newThickness} мм`
  return { name: next, autoName: next }
}
