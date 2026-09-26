import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/share/route'

export const POST = observe('/api/v1/share', 'POST', original.POST)
