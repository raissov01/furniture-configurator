import { describe, expect, it } from 'vitest'
import { classicClickSelection, classicDoubleClickTarget } from '@/lib/classicPick'

describe('PRO100 таңдау: алдымен бүкіл модуль, сосын деталь', () => {
  it('таңдалмаған модульдің детальін басу — бүкіл модульді таңдайды', () => {
    expect(classicClickSelection(null, 'side-left', 'cab-1')).toBe('cab-1')
    expect(classicClickSelection('cab-2', 'side-left', 'cab-1')).toBe('cab-1')
  })
  it('таңдалған модульді қайта басу — сол детальге кіреді', () => {
    expect(classicClickSelection('cab-1', 'front-1', 'cab-1')).toBe('front-1')
  })
  it('басқа детальге ауысу модуль ішінде қалады', () => {
    expect(classicClickSelection('front-1', 'side-left', 'cab-1', ['front-1', 'side-left'])).toBe('side-left')
  })
  it('таңдалған детальді қайта басу — модульге қайтады', () => {
    expect(classicClickSelection('front-1', 'front-1', 'cab-1', ['front-1'])).toBe('cab-1')
  })
  it('бөтен модульдің детальі таңдалып тұрса, жаңа модуль тұтас таңдалады', () => {
    expect(classicClickSelection('front-9', 'front-1', 'cab-1', ['front-1'])).toBe('cab-1')
  })
})

describe('PRO100 қос шерту: Свойства', () => {
  it('бос күйден қос шерту — модульдің Свойства', () => {
    expect(classicDoubleClickTarget(null, 'front-1')).toBe('cabinet')
  })
  it('модуль таңдалып тұрса да — модульдің Свойства', () => {
    expect(classicDoubleClickTarget('cab-1', 'front-1')).toBe('cabinet')
  })
  it('сол деталь алдын ала таңдалған болса — детальдің Свойства', () => {
    expect(classicDoubleClickTarget('front-1', 'front-1')).toBe('part')
  })
})
