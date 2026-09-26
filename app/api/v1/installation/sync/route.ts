import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/installation/sync/route'

export const POST = observe('/api/v1/installation/sync', 'POST', original.POST)
