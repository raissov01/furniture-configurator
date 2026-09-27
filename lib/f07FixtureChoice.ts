import type { CabinetFixture } from '../src/core/index'

/** Mirrors the core's mutual-exclusion rule for select availability. */
export function fixtureChoiceDisabled(fixtures: readonly CabinetFixture[], choice: 'sink' | 'hob'): boolean {
  return fixtures.some((fixture) => fixture.kind === (choice === 'sink' ? 'hob' : 'sink'))
}
