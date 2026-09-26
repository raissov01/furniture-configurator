import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/installation/route'

export const GET = observe('/api/v1/installation', 'GET', original.GET)
