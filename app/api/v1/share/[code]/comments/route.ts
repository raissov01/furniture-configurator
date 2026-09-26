import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/share/[code]/comments/route'

export const GET = observe('/api/v1/share/[code]/comments', 'GET', original.GET)
export const POST = observe('/api/v1/share/[code]/comments', 'POST', original.POST)
