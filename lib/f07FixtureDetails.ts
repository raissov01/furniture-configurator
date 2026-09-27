import type { CabinetFixture } from '../src/core/index'

export function updateFixtureAt(
  fixtures: readonly CabinetFixture[], index: number, replacement: CabinetFixture,
): CabinetFixture[] {
  if (index < 0 || fixtures[index]?.kind !== replacement.kind) return [...fixtures]
  return fixtures.map((fixture, i) => i === index ? replacement : fixture)
}
