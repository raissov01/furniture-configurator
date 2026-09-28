import { describe, expect, it } from 'vitest'
import { deleteAction, resetDecision } from '../lib/workspaceActions'
import { matchHotkey } from '../lib/hotkeys'

const key = (key: string, ctrlKey = false, shiftKey = false) =>
  ({ key, ctrlKey, metaKey: false, shiftKey, altKey: false }) as KeyboardEvent

describe('workspace keys and guarded actions', () => {
  it('maps Delete and Ctrl+Y without stealing bare Y or shifted Y', () => {
    expect(matchHotkey(key('Delete'))?.action).toEqual({ kind: 'delete' })
    expect(matchHotkey(key('y', true))?.action).toEqual({ kind: 'redo' })
    expect(matchHotkey(key('y'))).toBeUndefined()
    expect(matchHotkey(key('y', true, true))).toBeUndefined()
  })

  it('deletes only an editable supported node and preserves the final cabinet', () => {
    expect(deleteAction('board', true, 1, false)).toBe('board')
    expect(deleteAction('board', true, 1, true)).toBeNull()
    expect(deleteAction('cabinet', true, 2, false)).toBe('cabinet')
    // PRO100: соңғы корпус та өшеді — бос бөлме қалады.
    expect(deleteAction('cabinet', true, 1, false)).toBe('cabinet')
    expect(deleteAction('cabinet', true, 0, false)).toBeNull()
    expect(deleteAction('annotation', true, 1, false)).toBe('annotation')
    expect(deleteAction('solid', true, 2, false)).toBeNull()
    expect(deleteAction('board', false, 2, false)).toBeNull()
  })

  it('only resets after confirmation', () => {
    expect(resetDecision(false)).toBe('keep')
    expect(resetDecision(true)).toBe('reset')
  })
})
