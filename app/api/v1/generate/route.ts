import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/generate/route'

export const POST = observe('/api/v1/generate', 'POST', original.POST)
