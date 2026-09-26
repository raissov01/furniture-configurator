import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/mobile/measure/sync/route'

export const POST = observe('/api/v1/mobile/measure/sync', 'POST', original.POST)
