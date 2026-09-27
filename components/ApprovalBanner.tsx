'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'

type ApprovalInfo = { version: number; status: 'approved' | 'pending' | 'changed'; latestApprovedVersion: number | null }

function parseApprovalInfo(raw: unknown): ApprovalInfo | null {
  if (!raw || typeof raw !== 'object' || !('version' in raw) || !('status' in raw) || !('latestApprovedVersion' in raw)) return null
  if (typeof raw.version !== 'number' || !Number.isSafeInteger(raw.version) ||
      (raw.status !== 'approved' && raw.status !== 'pending' && raw.status !== 'changed') ||
      (raw.latestApprovedVersion !== null &&
       (typeof raw.latestApprovedVersion !== 'number' || !Number.isSafeInteger(raw.latestApprovedVersion)))) return null
  return { version: raw.version, status: raw.status, latestApprovedVersion: raw.latestApprovedVersion }
}

export function ApprovalBannerContent({ code, info }: { code: string; info: ApprovalInfo }) {
  const approved = info.latestApprovedVersion
  if (approved === null) return null
  const current = info.status === 'approved' && info.version === approved
  const pdfUrl = `/api/share/${encodeURIComponent(code)}/approval?version=${approved}&format=pdf`
  return <aside data-testid="approved-version-banner" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#98895c] bg-[#fff3d5] px-3 py-2 text-sm text-black">
    <strong>{t('Клиент согласовал версию')} {approved}</strong>
    {!current && <span>{t('Текущий проект изменён после согласования')}</span>}
    <a className="underline" href={pdfUrl} target="_blank" rel="noopener noreferrer">{t('Скачать подписанный PDF')}</a>
  </aside>
}

export function ApprovalBanner({ code }: { code: string | null }) {
  const [info, setInfo] = useState<ApprovalInfo | null>(null)

  useEffect(() => {
    setInfo(null)
    if (!code) return undefined
    let active = true
    const poll = async () => {
      try {
        const response = await fetch(`/api/share/${encodeURIComponent(code)}/approval`, { cache: 'no-store' })
        if (!response.ok) return
        const parsed = parseApprovalInfo(await response.json() as unknown)
        if (active && parsed) setInfo(parsed)
      } catch (cause) {
        // Offline болғанда бұрынғы мөрге сілтеме қалады; келесі poll жаңартады.
        console.warn('Келісім күйі уақытша оқылмады', cause)
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 5_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [code])

  return code && info ? <ApprovalBannerContent code={code} info={info} /> : null
}
