import { describe, expect, it } from 'vitest'
import { can, type Role } from '../lib/permissions'

describe('рөл рұқсаты', () => {
  const roles: Role[] = ['owner', 'designer', 'shop', 'client']
  it('матрица әр рөлдің шекарасын нақты ажыратады', () => {
    expect(roles.map((role) => [
      role,
      can(role, 'editProject'),
      can(role, 'readProduction'),
      can(role, 'readInternalPrice'),
      can(role, 'manageTeam'),
      can(role, 'readTeam'),
      can(role, 'manageShop'),
      can(role, 'readProject'),
      can(role, 'comment'),
      can(role, 'reply'),
    ])).toEqual([
      ['owner', true, true, true, true, true, true, true, true, true],
      ['designer', true, true, true, false, true, false, true, true, true],
      ['shop', false, true, false, false, true, false, true, false, false],
      ['client', false, false, false, false, false, false, false, true, false],
    ])
  })
})
