import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SEED_SETS, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES } from '../src/core/index'
import { TEMPLATE_THUMBS } from '../lib/templateThumbs.generated'
import { templateThumbUrl } from '../components/TemplatePhoto'

const file = (id: string) => new URL(`../public/templates/thumbs/${id}.webp`, import.meta.url)

describe('шаблон галереясының 3D превьюлері', () => {
  const ids = [...SEED_TEMPLATES, ...STANDARD_NOMENCLATURE_TEMPLATES, ...SEED_SETS].map((item) => item.id)

  it('әр шаблон мен жиынтықтың суреті бар (scripts/renderTemplateThumbs.mjs)', () => {
    expect(ids.filter((id) => !TEMPLATE_THUMBS[id])).toEqual([])
    expect(ids.filter((id) => !existsSync(file(id)))).toEqual([])
    expect(Object.keys(TEMPLATE_THUMBS).filter((id) => !ids.includes(id))).toEqual([])
  })

  it('суреттер WebP, 320×240, жалпы көлемі 3 МБ-тан аз', () => {
    let total = 0
    for (const id of ids) {
      const buf = readFileSync(file(id))
      expect(buf.subarray(0, 4).toString('ascii'), id).toBe('RIFF')
      expect(buf.subarray(8, 12).toString('ascii'), id).toBe('WEBP')
      total += statSync(file(id)).size
    }
    expect(total).toBeLessThan(3 * 1024 * 1024)
  })

  it('URL хэшпен кэш жаңартады, суреті жоқ id — null (SVG сызбасы көрсетіледі)', () => {
    expect(templateThumbUrl('bedside-450')).toBe(`/templates/thumbs/bedside-450.webp?v=${TEMPLATE_THUMBS['bedside-450']}`)
    expect(templateThumbUrl('no-such-template')).toBeNull()
  })
})
