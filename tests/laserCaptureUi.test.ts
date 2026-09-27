import { describe, expect, it } from 'vitest'
import { applyDistoText, emptySurvey } from '../components/mobile/measurementModel'

describe('Leica DISTO D5 text capture into a survey', () => {
  it('records an integer millimetre value, source and capture time for the selected wall', () => {
    const survey = emptySurvey('survey-1', 1000)
    const updated = applyDistoText(survey, 'walls.north.length', '1.234m\n', 1234)
    expect(updated.walls.north.length).toEqual({ value: 1234, source: 'laser', capturedAt: 1234 })
    expect(survey.walls.north.length.value).toBe(0)
  })

  it('rejects unlabelled numbers and angle targets without changing the survey', () => {
    const survey = emptySurvey('survey-2', 1000)
    expect(() => applyDistoText(survey, 'height', '1.234', 1234)).toThrow(/Text Mode/)
    expect(() => applyDistoText(survey, 'corners.northWest', '1.234m', 1234)).toThrow(/field/)
    expect(survey.height.value).toBe(0)
  })
})
