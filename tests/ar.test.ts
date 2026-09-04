/**
 * AR сілтемесі.
 *
 * Экспорттың өзі браузерде жүреді (three), сондықтан мұнда СІЛТЕМЕНІҢ
 * пішіні мен телефонды тану тексеріледі — солар қате болса, батырма үнсіз
 * ештеңе істемейді.
 */
import { describe, expect, it } from 'vitest'
import { isAndroid, isIos, sceneViewerUrl } from '../lib/ar'

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

describe('телефонды тану', () => {
  it('Android — иә, iPhone пен компьютер — жоқ', () => {
    expect(isAndroid(ANDROID)).toBe(true)
    expect(isAndroid(IPHONE)).toBe(false)
    expect(isAndroid(DESKTOP)).toBe(false)
  })

  it('iPhone бөлек танылады: онда AR басқа формат талап етеді', () => {
    expect(isIos(IPHONE)).toBe(true)
    expect(isIos(ANDROID)).toBe(false)
  })
})

describe('Scene Viewer сілтемесі', () => {
  const url = sceneViewerUrl('https://mebel.example.kz/api/ar/abc', 'Шкаф-пенал')

  it('Android-тың intent сілтемесі болып құралады', () => {
    expect(url.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true)
    expect(url).toContain('scheme=https')
    expect(url).toContain('package=com.google.ar.core')
  })

  it('AR жоқ телефонда да БОС ҚАЛМАЙДЫ: қор сілтемесі бар', () => {
    expect(url).toContain('S.browser_fallback_url=')
    expect(decodeURIComponent(url)).toContain('https://mebel.example.kz/api/ar/abc')
  })

  it('жиһаз ЕДЕНГЕ қойылады әрі өлшемі өзгертілмейді', () => {
    expect(url).toContain('mode=ar_preferred')
    expect(url).toContain('resizable=false')
  })
})
