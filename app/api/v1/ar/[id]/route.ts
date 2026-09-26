import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/ar/[id]/route'

export const GET = observe('/api/v1/ar/[id]', 'GET', original.GET)
