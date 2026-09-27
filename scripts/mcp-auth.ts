import { accountFromToken } from '../lib/server/auth'
import type { Account } from '../lib/server/auth'

/** MCP accepts a bearer token only; cookie and URL tokens are ignored. */
export function accountFromMcpAuthorization(authorization: string | undefined): Account | null {
  const token = authorization?.match(/^Bearer ([0-9a-f]{64})$/i)?.[1]
  return accountFromToken(token)
}
