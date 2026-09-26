import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/library/route'

export const GET = observe('/api/v1/library', 'GET', original.GET)
export const POST = observe('/api/v1/library', 'POST', original.POST)
export const DELETE = observe('/api/v1/library', 'DELETE', original.DELETE)
