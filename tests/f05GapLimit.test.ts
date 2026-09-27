import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import { catalog, oneSection, withCabinet } from './fixtures'

describe('F05 фасадтың нақты саңылауы', () => {
  it('дөңгелектеу сол сыртқы саңылауды 51 мм етсе, 50 мм шектен өткізбейді', () => {
    const config = withCabinet({
      width: 600,
      sections: oneSection({
        fronts: { count: 2, mount: 'overlay', gaps: { left: 50, between: 0, right: 3 } },
      }),
    })
    expect(() => generateCabinet(config, catalog)).toThrow(/fronts\.gaps\.left.*0\.\.50/)
  })

  it('шекке жетпейтін дөңгелектеу әдеттегідей орналасады', () => {
    const config = withCabinet({
      width: 600,
      sections: oneSection({
        fronts: { count: 2, mount: 'overlay', gaps: { left: 49, between: 0, right: 3 } },
      }),
    })
    const fronts = generateCabinet(config, catalog).filter((panel) => panel.role === 'front')
    expect(fronts[0]!.position.x).toBeLessThanOrEqual(50)
    expect(fronts[0]!.finishedWidth).toBe(fronts[1]!.finishedWidth)
  })
})
