import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/installation/[id]/route'

export const GET = observe('/api/v1/installation/[id]', 'GET', original.GET)
