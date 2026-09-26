import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/projects/route'

export const GET = observe('/api/v1/projects', 'GET', original.GET)
export const POST = observe('/api/v1/projects', 'POST', original.POST)
