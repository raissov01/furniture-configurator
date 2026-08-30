/** Сұраныстағы сессия. Барлық қорғалған маршрут осыдан басталады. */

import { cookies } from 'next/headers'
import { SESSION_COOKIE, accountFromToken } from './auth'
import type { Account } from './auth'

export async function currentAccount(): Promise<Account | null> {
  const jar = await cookies()
  return accountFromToken(jar.get(SESSION_COOKIE)?.value)
}
