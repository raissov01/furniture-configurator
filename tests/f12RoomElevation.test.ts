import { describe, expect, it } from 'vitest'
import { isCeilingIssue } from '../lib/roomElevationUi'
import { readFileSync } from 'node:fs'

describe('F12 cabinet elevation field', () => {
  it('marks only the active cabinet ceiling issue', () => {
    expect(isCeilingIssue([{ cabinetId: 'a', field: 'elevation', message: 'ceiling' }], 'a')).toBe(true)
    expect(isCeilingIssue([{ cabinetId: 'a', field: 'elevation', message: 'ceiling' }], 'b')).toBe(false)
    expect(isCeilingIssue([{ cabinetId: 'a', field: 'width', message: 'wall' }], 'a')).toBe(false)
  })
  it('connects ceiling issues to the elevation input', () => {
    const source = readFileSync(new URL('../components/RoomPlan.tsx', import.meta.url), 'utf8')
    expect(source).toContain('invalid={isCeilingIssue(issues, active.id)}')
  })
})
