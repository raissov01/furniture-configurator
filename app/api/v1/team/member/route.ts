import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/team/member/route'

export const DELETE = observe('/api/v1/team/member', 'DELETE', original.DELETE)
export const PATCH = observe('/api/v1/team/member', 'PATCH', original.PATCH)
