import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/own-catalog/route'

export const GET = observe('/api/v1/own-catalog', 'GET', original.GET)
export const POST = observe('/api/v1/own-catalog', 'POST', original.POST)
export const DELETE = observe('/api/v1/own-catalog', 'DELETE', original.DELETE)
