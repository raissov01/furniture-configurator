import { describe, expect, it } from 'vitest'
import { emptySurvey, updateMeasure } from '../components/mobile/measurementModel'
import { measurementImpactView } from '../lib/mobile/measurementImpactView'
import { useConfigurator } from '../store/configurator'

describe('measurement impact in the mobile review', () => {
  it('links a changed height to placed cabinets and the project quote/order reference', () => {
    const before = emptySurvey('survey-1', 1000)
    const after = updateMeasure(before, 'height', 2500, 'laser', 2000)
    const project = { ...useConfigurator.getState().exportProject(), info: { orderNo: 'КП-27' } }
    const impact = measurementImpactView(before, after, project)
    expect(impact.changedPaths).toEqual(['height'])
    expect(impact.cabinets.length).toBeGreaterThan(0)
    expect(impact.quoteReferences).toEqual(['КП-27'])
  })

  it('does not claim a quote when the project has no order reference', () => {
    const before = emptySurvey('survey-2', 1000)
    const after = updateMeasure(before, 'walls.north.length', 3000, 'manual', 2000)
    const project = { ...useConfigurator.getState().exportProject(), info: undefined }
    expect(measurementImpactView(before, after, project).quoteReferences).toEqual([])
  })
})
