import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/auth/login/route'

export const POST = observe('/api/v1/auth/login', 'POST', original.POST)
