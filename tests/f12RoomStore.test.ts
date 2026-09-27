import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'

const original = useConfigurator.getState()
afterEach(() => useConfigurator.setState({ room: original.room, past: [], future: [] }))

describe('room persistence boundary', () => {
  it('rejects direct invalid dimensions without changing the project', () => {
    const before = useConfigurator.getState().room
    for (const width of [0, 499, 20001, 500.5, Number.NaN]) {
      expect(() => useConfigurator.getState().editRoom({ width })).toThrow(/room.width.*500..20000/)
      expect(useConfigurator.getState().room).toEqual(before)
    }
  })
})
