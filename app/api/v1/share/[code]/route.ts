import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/share/[code]/route'

export const GET = observe('/api/v1/share/[code]', 'GET', original.GET)
export const PUT = observe('/api/v1/share/[code]', 'PUT', original.PUT)
