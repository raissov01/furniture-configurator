import { describe, expect, it } from 'vitest'
import { routeMetadata } from '../lib/routeMetadata'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'

describe('маршрут metadata аудармасы', () => {
  it('басты бет пен раскройдың атауы тілге байланысты', () => {
    expect(routeMetadata('/', (key) => kk[key] ?? key)?.title).toContain('Жиһаз')
    expect(routeMetadata('/cut', (key) => en[key] ?? key)?.title).toContain('Nesting')
    expect(routeMetadata('/configurator', (key) => kk[key] ?? key)).toBeNull()
  })
})
