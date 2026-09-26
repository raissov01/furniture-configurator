import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/health/route'

export const GET = observe('/api/v1/health', 'GET', original.GET)
