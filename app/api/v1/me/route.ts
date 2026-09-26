import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/me/route'

export const GET = observe('/api/v1/me', 'GET', original.GET)
