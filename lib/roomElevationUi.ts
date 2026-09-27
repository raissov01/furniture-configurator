export function isCeilingIssue(issues: readonly { cabinetId: string; field: string; message?: string }[], cabinetId: string): boolean {
  return issues.some((issue) => issue.cabinetId === cabinetId && issue.field === 'elevation')
}
