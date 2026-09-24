/** A permission is granted only when it appears in the role's row. */
export type Role = 'owner' | 'designer' | 'shop' | 'client'
export type Action =
  | 'editProject' | 'readProduction' | 'readInternalPrice'
  | 'manageTeam' | 'manageShop' | 'readProject' | 'comment' | 'reply'

const grants: Record<Role, ReadonlySet<Action>> = {
  owner: new Set(['editProject', 'readProduction', 'readInternalPrice', 'manageTeam', 'manageShop', 'readProject', 'comment', 'reply']),
  designer: new Set(['editProject', 'readProduction', 'readInternalPrice', 'readProject', 'comment', 'reply']),
  shop: new Set(['readProduction', 'readProject']),
  client: new Set(['comment']),
}

export function can(role: Role, action: Action): boolean {
  return grants[role].has(action)
}
