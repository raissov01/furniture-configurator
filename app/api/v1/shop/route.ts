import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/shop/route'

export const GET = observe('/api/v1/shop', 'GET', original.GET)
export const PUT = observe('/api/v1/shop', 'PUT', original.PUT)
