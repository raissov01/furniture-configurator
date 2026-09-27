import { expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, templateToCabinet, generateCabinet } from '../src/core/index'
import { RenderRequestSchema } from '../src/core/render/prompt'
import { buildRenderRequest } from '../lib/renderPanelUi'

it('рендер сұрауы нақты панель декорын, модуль түрін және камера фотосын жібереді', () => {
  const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
  const panels = generateCabinet(cabinet, SEED_CATALOG)
  const request = buildRenderRequest({
    image: 'data:image/png;base64,iVBORw0KGgo=',
    reference: 'data:image/jpeg;base64,/9j/4AAQ',
    aspect: '16:9', style: 'modern', hint: 'Жылы жарық',
    panels, cabinets: [cabinet], catalog: SEED_CATALOG, projectId: 'root-1',
  })
  expect(RenderRequestSchema.safeParse(request).success).toBe(true)
  expect(request.referenceMode).toBe('cameraReference')
  expect(request.materials).toEqual(expect.arrayContaining([expect.objectContaining({ materialId: cabinet.carcassMaterialId })]))
  expect(request.staging).toHaveLength(1)
  expect(request.projectId).toBe('root-1')
})

it('фотосыз сұрау scene режиміне түседі', () => {
  const request = buildRenderRequest({ image: 'data:image/png;base64,iVBORw0KGgo=', reference: null,
    aspect: '1:1', style: 'classic', hint: '', panels: [], cabinets: [], catalog: SEED_CATALOG,
    projectId: 'root-2' })
  expect(request.referenceMode).toBe('scene')
  expect(request.reference).toBeUndefined()
})
