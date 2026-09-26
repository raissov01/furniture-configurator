import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/comments/route'

export const GET = observe('/api/v1/comments', 'GET', original.GET)
export const POST = observe('/api/v1/comments', 'POST', original.POST)
