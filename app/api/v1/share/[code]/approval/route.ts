import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/share/[code]/approval/route'

export const POST = observe('/api/v1/share/[code]/approval', 'POST', original.POST)
export const PUT = observe('/api/v1/share/[code]/approval', 'PUT', original.PUT)
export const GET = observe('/api/v1/share/[code]/approval', 'GET', original.GET)
