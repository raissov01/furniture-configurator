/** A text node needs visible content and the serialized limit is 500 characters. */
export function validAnnotationText(value: string): boolean {
  return value.trim().length > 0 && value.length <= 500
}
