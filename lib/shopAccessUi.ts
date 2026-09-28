import { can, type Role } from './permissions'

/** null — бұлтқа кірмеген жергілікті конфигуратор. */
export function shopEditAccess(role: Role | null): { canRead: boolean; canEdit: boolean } {
  return role === null
    ? { canRead: true, canEdit: true }
    : { canRead: can(role, 'readInternalPrice'), canEdit: can(role, 'manageShop') }
}
