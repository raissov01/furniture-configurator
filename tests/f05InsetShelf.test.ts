import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import { catalog, oneSection, withCabinet } from './fixtures'

const inset = (shelfSetback: number) => withCabinet({
  settings: { shelfSetback },
  sections: oneSection({ fronts: { count: 2, mount: 'inset' } }),
})

describe('F05 вкладной фасад пен сөре', () => {
  it('әдеттегі 0 мм сөре шегінісінде көлем қиылысын өткізбейді', () => {
    expect(() => generateCabinet(inset(0), catalog)).toThrow(/fronts\.mount.*сөре.*қиылысады/)
  })

  it('цех өзі берген жеткілікті шегіністе сөре мен есік бөлек тұрады', () => {
    const panels = generateCabinet(inset(20), catalog)
    const front = panels.find((panel) => panel.role === 'front')!
    const shelf = panels.find((panel) => panel.role === 'shelf')!
    expect(shelf.position.z).toBeGreaterThanOrEqual(front.position.z + 16)
  })
})
