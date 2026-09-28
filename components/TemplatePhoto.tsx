'use client'

/**
 * Шаблон/жиынтық карточкасының 3D превьюі.
 *
 * Сурет build-time-да біздің өз генераторымыз бен R3F сахнасынан түсіріледі
 * (`scripts/renderTemplateThumbs.mjs`), сондықтан жүктегеннен кейінгі 3D-мен
 * бірдей. Сурет жоқ болса не жүктелмесе — `fallback` (фас сызбасы).
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { TEMPLATE_THUMBS } from '@/lib/templateThumbs.generated'

/** Студия фонымен бірдей (`components/ThumbStage.tsx` → `THUMB_BACKGROUND`). */
const PHOTO_BACKGROUND = '#f4f3f0'

export function templateThumbUrl(id: string): string | null {
  const hash = TEMPLATE_THUMBS[id]
  return hash ? `/templates/thumbs/${encodeURIComponent(id)}.webp?v=${hash}` : null
}

export function TemplatePhoto({ id, alt, fallback, className }: {
  id: string
  alt: string
  fallback: ReactNode
  /** Мыс. жиынтық карточкасында сурет өз өлшемінен (320 px) үлкейіп бұлдырамасын. */
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = templateThumbUrl(id)
  return (
    <div
      className={`relative flex aspect-[4/3] w-full items-end justify-center overflow-hidden border border-neutral-200 dark:border-neutral-700 ${className ?? ''}`}
      style={{ background: PHOTO_BACKGROUND }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          width={320}
          height={240}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-end justify-center p-2">{fallback}</div>
      )}
    </div>
  )
}
