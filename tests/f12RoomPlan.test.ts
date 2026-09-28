import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const roomPlan = readFileSync(new URL('../components/RoomPlan.tsx', import.meta.url), 'utf8')

describe('F12 room dialog wiring', () => {
  it('shows opening errors beside editable fields and preserves the data for repair', () => {
    expect(roomPlan).toContain('const openingIssues = useMemo(() => validateOpenings(room)')
    expect(roomPlan).toContain('<OpeningEditor room={room} issues={openingIssues}')
    expect(roomPlan).toContain('onChange={(openings) => editRoom({ openings })}')
    expect(roomPlan).toContain("label={tr('Положение проёма')}")
  })

  it('lets room fields work despite a locked cabinet and flags its ceiling issue', () => {
    expect(roomPlan).toContain('<fieldset className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-3">')
    expect(roomPlan).not.toContain('disabled={!roomEditable}')
    expect(roomPlan).toContain('invalid={isCeilingIssue(issues, active.id)}')
  })

  it('fits the plan and dimensions into a narrow screen and supports Escape', () => {
    expect(roomPlan).toContain('max-w-[420px] min-w-0')
    expect(roomPlan).toContain('lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]')
    expect(roomPlan).toContain('grid grid-cols-1 gap-2 min-[460px]:grid-cols-3')
    expect(roomPlan).toContain('role="dialog"')
    expect(roomPlan).toContain("useModalLayer(open, 'room', () => setOpen(false))")
    expect(roomPlan).toContain('trigger?.focus()')
  })
})
