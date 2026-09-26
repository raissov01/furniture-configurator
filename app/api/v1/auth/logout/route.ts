import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/auth/logout/route'

export const POST = observe('/api/v1/auth/logout', 'POST', original.POST)
