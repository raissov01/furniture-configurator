import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/projects/[id]/route'

export const GET = observe('/api/v1/projects/[id]', 'GET', original.GET)
export const DELETE = observe('/api/v1/projects/[id]', 'DELETE', original.DELETE)
