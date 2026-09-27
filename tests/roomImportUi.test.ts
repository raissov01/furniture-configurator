import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { canApplyRoomImport, parseRoomImport } from '../lib/roomImportUi'

const svg = readFileSync(new URL('./fixtures/svg-room-l-shape-mm.svg', import.meta.url), 'utf8')

it('SVG импортында контурды таңдағанда басқа бөлменің өлшемі шығады', () => {
  const room = parseRoomImport('plan.svg', svg)
  expect(room.format).toBe('svg')
  expect(room.result.bounds).toEqual({ width: 5000, depth: 4000 })
  expect(room.shapes.map((shape) => shape.label)).toEqual(['#room', '#sofa'])
  const sofa = parseRoomImport('plan.svg', svg, { elementId: 'sofa' })
  expect(sofa.result.bounds).toEqual({ width: 2000, depth: 900 })
  expect(canApplyRoomImport(room.result)).toBe(false)
  expect(canApplyRoomImport(sofa.result)).toBe(true)
})

it('бірліксіз SVG масштабсыз өтпейді, мм/бірлік берілсе өтеді', () => {
  const unitless = readFileSync(new URL('./fixtures/svg-room-unitless.svg', import.meta.url), 'utf8')
  expect(() => parseRoomImport('plan.svg', unitless)).toThrow(/mmPerUnit/)
  expect(parseRoomImport('plan.svg', unitless, { mmPerUnit: 10 }).result.bounds).not.toBeNull()
})

it('файл түрін кеңейтіммен дәл ажыратады', () => {
  expect(() => parseRoomImport('plan.txt', svg)).toThrow(/plan.txt/)
})
