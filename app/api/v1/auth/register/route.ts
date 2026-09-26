import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/auth/register/route'

export const POST = observe('/api/v1/auth/register', 'POST', original.POST)
