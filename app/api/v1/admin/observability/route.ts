import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/admin/observability/route'

export const GET = observe('/api/v1/admin/observability', 'GET', original.GET)
