/** Validation runs on every render; presentation waits for an edit or submit. */
export function showIssue(field: string, touched: Readonly<Record<string, boolean>>, submitted: boolean): boolean {
  return submitted || touched[field] === true
}

export function visibleErrors<K extends string>(errors: Partial<Record<K, string>>,
  touched: Readonly<Record<string, boolean>>, submitted: boolean): Partial<Record<K, string>> {
  const visible: Partial<Record<K, string>> = {}
  for (const [field, message] of Object.entries(errors) as [K, string | undefined][]) {
    if (message && showIssue(field, touched, submitted)) visible[field] = message
  }
  return visible
}
