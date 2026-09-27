import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DockHost } from '../components/dock/DockHost'
import { createDockState } from '../components/dock/layout'
import { loadDockState } from '../components/dock/persist'
import { importDxfRoomPlan } from '../src/core/import/dxf'
import { dxfRoomSize } from '../lib/dxfRoomSize'

const fixture = (name: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf-8')

describe('Workspace док панельдері', () => {
  it('алғашқы ашылуда панельдер жабық және ашу мәзірі қолжетімді', () => {
    const html = renderToString(createElement(DockHost, {
      panels: [{ id: 'find', title: 'Найти', content: createElement('span', null, 'find content') }],
      initiallyClosed: ['find'],
      storageKey: 'workspace-test',
    }))
    expect(html).toContain('data-dock-panel="find"')
    expect(html).toContain('data-dock-hidden="true"')
    expect(html).toMatch(/Открыть[\s\S]*Найти<\/button>/)
  })

  it('жеке сақтау кілті жоқ болса, берілген жабық күйді алады', () => {
    const fallback = createDockState(['find'])
    fallback.panels.find = { ...fallback.panels.find!, visible: false }
    expect(loadDockState(['find'], 'workspace-test', fallback).panels.find?.visible).toBe(false)
  })
})

describe('DXF бөлме жоспарын енгізу', () => {
  it('төрт тікбұрыш қабырғасын бүтін W/D бөлме өлшеміне аударады', () => {
    const plan = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'))
    expect(dxfRoomSize(plan)).toEqual({ width: 4000, depth: 3000 })
  })

  it('бір қабырға қиғаш болса, габарит қана алып геометрияны жоғалтпайды', () => {
    const plan = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'))
    plan.walls[0]!.end.x -= 100
    expect(() => dxfRoomSize(plan)).toThrow(/прямоугольный/)
  })

  it('бүтін емес координатты қабылдамайды', () => {
    const plan = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'))
    plan.walls[0]!.start.x += 0.5
    expect(() => dxfRoomSize(plan)).toThrow(/целыми миллиметрами/)
  })
})
