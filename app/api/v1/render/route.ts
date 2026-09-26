import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/render/route'

export const POST = observe('/api/v1/render', 'POST', original.POST)
