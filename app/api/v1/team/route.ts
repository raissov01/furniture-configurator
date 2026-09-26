import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/team/route'

export const GET = observe('/api/v1/team', 'GET', original.GET)
export const POST = observe('/api/v1/team', 'POST', original.POST)
export const DELETE = observe('/api/v1/team', 'DELETE', original.DELETE)
