import { observe } from '@/lib/server/observability'
import * as original from '@/app/api/mobile/photos/[id]/route'

export const POST = observe('/api/v1/mobile/photos/[id]', 'POST', original.POST)
export const GET = observe('/api/v1/mobile/photos/[id]', 'GET', original.GET)
