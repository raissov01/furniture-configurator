import { expect, it } from 'vitest'
import { numberedCabinetLabels } from '../components/panels/canonicalTreeRows'
import type { CanonicalTreeRow } from '../components/panels/canonicalTreeRows'

const row = (id: string, kind: CanonicalTreeRow['kind'], label: string) => ({ id, kind, label }) as CanonicalTreeRow

it('тек модуль жолдарына 01, 02 нөмірін береді; атау дерегін өзгертпейді', () => {
  const rows = [row('root', 'group', 'Жоба'), row('a', 'cabinet', 'Модуль 1'),
    row('p', 'part', 'Боковина'), row('b', 'cabinet', 'Модуль 2')]
  const labels = numberedCabinetLabels(rows)
  expect(labels.get('a')).toBe('01. Модуль 1')
  expect(labels.get('b')).toBe('02. Модуль 2')
  expect(labels.has('p')).toBe(false)
  expect(rows[1]!.label).toBe('Модуль 1')
})
