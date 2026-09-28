import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('F00h бренд беттері', () => {
  it('карта мен корпус нобайында бір бренд амбері бар', () => {
    for (const path of ['CutPage', 'QuoteView', 'CabinetThumb']) {
      const component = source(`components/${path}.tsx`)
      expect(component, path).not.toMatch(/#(?:e3c76a|b8862a|bd9520)/i)
      expect(component, path).toContain('var(--brand-amber)')
    }
  })

  it('көпшілік беттерде графит фон мен логотип көрінеді', () => {
    for (const path of ['components/CodeEntryPage.tsx', 'components/ViewerPage.tsx', 'app/not-found.tsx', 'app/privacy/page.tsx']) {
      const page = source(path)
      expect(page, path).toMatch(/var\(--brand-graphite\)|className="site /)
      expect(page, path).toContain('/brand/aismebel-mark.svg')
    }
  })

  it('мобильді батырма мен таңдау бренд түсіне көшкен', () => {
    const mobile = source('app/mobile/page.tsx') + source('components/mobile/MeasurementWizard.tsx')
    expect(mobile).not.toMatch(/#(?:005a9e|dceeff)/i)
    expect(mobile).toContain('var(--brand-graphite)')
    expect(mobile).toContain('var(--brand-amber)')
  })
})
