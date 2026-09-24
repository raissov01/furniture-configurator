/** Client links never show production dimensions, regardless of editor state. */
export function shouldRenderDimensions(
  active: boolean,
  editorToggle: boolean,
  allowDimensionLabels: boolean,
): boolean {
  return active && editorToggle && allowDimensionLabels
}
