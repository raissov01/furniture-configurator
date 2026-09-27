import { describe, expect, it } from 'vitest'
import { ConfigValidationError } from '../src/core/index'
import { shareErrorText } from '../lib/shareLinkError'

describe('F22 бүлінген сілтеме', () => {
  it('өріс аты мен рұқсатты қайталамай, бір локализацияланған сөйлем береді', () => {
    const error = new ConfigValidationError('link', 'неизвестный формат ссылки', 'ссылка создана другой версией конфигуратора')
    expect(shareErrorText(error, (value) => value)).toBe('Ссылка на проект повреждена или устарела. Попросите новую ссылку.')
  })
})
