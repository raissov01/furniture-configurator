import { describe, expect, it } from 'vitest'
import { visibleMaterialNames, visibleNetworkMessage, measurementCaption } from '../lib/f00kDisplay'

describe('қайталанатын көрініс мәтіні', () => {
  it('бір материал атауын бір рет көрсетеді, екі түрлісін сақтайды', () => {
    expect(visibleMaterialNames('ЛДСП дуб', 'ЛДСП дуб')).toEqual(['ЛДСП дуб'])
    expect(visibleMaterialNames('ЛДСП дуб', 'ЛДСП белый')).toEqual(['ЛДСП дуб', 'ЛДСП белый'])
  })
  it('желі қатесі статуспен қайталанбайды', () => {
    expect(visibleNetworkMessage('Сервер недоступен', 'Сервер недоступен')).toBeNull()
    expect(visibleNetworkMessage('Нет сети', 'Сервер недоступен')).toBeNull()
    expect(visibleNetworkMessage('В сети', 'Ошибка сохранения')).toBe('Ошибка сохранения')
  })
  it('өлшеу хэшінің орнына күнін береді', () => {
    const caption = measurementCaption('Замер', Date.UTC(2026, 8, 27, 14, 30))
    expect(caption).toContain('27.09.2026')
    expect(caption).not.toMatch(/[a-f0-9]{8}/)
  })
})
