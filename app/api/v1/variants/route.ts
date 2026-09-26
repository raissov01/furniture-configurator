import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/variants/route'

export const POST = observe('/api/v1/variants', 'POST', original.POST)
