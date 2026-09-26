'use client'

import { t } from '@/lib/i18n'
import { offlineCapability, type OfflineFeature } from '@/src/core/sync/capabilities'

export function InternetRequirement({ feature, online, dark = false }: { feature: OfflineFeature; online: boolean; dark?: boolean }) {
  if (!offlineCapability(feature).requiresInternet) return null
  return <p className={`mt-1 text-xs ${dark ? 'text-[#d4d4d4]' : 'text-[#525252] dark:text-[#d4d4d4]'}`} role="note">
    {t('Работает через интернет')}{online ? '' : ` · ${t('Подключитесь к сети, чтобы продолжить.')}`}
  </p>
}
