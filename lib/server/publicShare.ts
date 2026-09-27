import { ConfigValidationError } from '@/src/core/errors'
import type { ProjectFileV4 } from '@/src/core/projectV4'
import { toPricedPublicProject, toPublicProject } from '@/src/core/publicProject'
import { parseShopProfile } from '@/src/core/shop'
import { readShopProfile } from './store'

/** Share-ге тек соңғы сату бағасын жазады; жолдық жеңілдікті цех бағасымен есептейді. */
export function publicProjectForShare(project: ProjectFileV4, shopId?: string): ProjectFileV4 {
  if (Object.keys(project.priceOverrides?.lineDiscounts ?? {}).length === 0) return toPublicProject(project)
  if (!shopId) {
    throw new ConfigValidationError('priceOverrides.lineDiscounts',
      'позициялық жеңілдік үшін цехқа кіру керек')
  }
  const rawShop = readShopProfile(shopId)
  if (!rawShop) {
    throw new ConfigValidationError('priceOverrides.lineDiscounts',
      'цехтың баға профилі табылмады')
  }
  return toPricedPublicProject(project, parseShopProfile(rawShop))
}
