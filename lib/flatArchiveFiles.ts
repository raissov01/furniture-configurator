/** Export IDs are user input; each generated file must remain one ZIP entry basename. */
export function flatArchiveFiles(files: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...files].map(([name, content]) => [encodeURIComponent(name), content]))
}
