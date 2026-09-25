import { describe, expect, it } from 'vitest'
import { parseDistoD5Text } from '../src/core/measure/distoD5Text'

describe('Leica DISTO D5 Bluetooth keyboard text mode', () => {
  it('өндіруші жариялаған 1.234m мәтінін бүтін мм-ге аударады', () => {
    expect(parseDistoD5Text('1.234m\r', 1_700_000_000_000)).toEqual({
      distanceMm: 1234,
      accuracyMm: 2,
      deviceModel: 'Leica DISTO D5',
      capturedAt: 1_700_000_000_000,
      source: 'bluetoothKeyboard',
    })
  })

  it('үтірді және 0,1 мм дәлдікпен шыққан мәтінді бүтін мм-ге дөңгелектейді', () => {
    expect(parseDistoD5Text('1,2345m\t', 12).distanceMm).toBe(1235)
    expect(parseDistoD5Text('1.2344m', 12).distanceMm).toBe(1234)
  })

  it.each(['', '1.2', '1.2m2', '1.2m3', '1.2ft', '-1m', 'abc', '1.23456m', '0.0499m', '200.0001m', '1.2m\n2.3m'])('жарамсыз/қате өлшемді қабылдамайды: %j', (payload) => {
    expect(() => parseDistoD5Text(payload, 12)).toThrow()
  })

  it('уақыт белгісі бүтін әрі теріс емес болуы керек', () => {
    expect(() => parseDistoD5Text('1.234m', -1)).toThrow()
    expect(() => parseDistoD5Text('1.234m', 1.5)).toThrow()
  })
})
