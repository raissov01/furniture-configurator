import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/ar/route'

export const POST = observe('/api/v1/ar', 'POST', original.POST)
