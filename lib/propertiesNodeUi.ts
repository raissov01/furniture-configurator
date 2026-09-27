/** Node kinds with an editor in the classic Properties dialog. */
export function propertiesNodeSupported(kind: string | undefined): boolean {
  return kind === 'cabinet' || kind === 'board' || kind === 'solid' || kind === 'annotation'
}
