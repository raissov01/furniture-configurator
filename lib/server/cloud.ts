import { NextResponse } from 'next/server'
import { cloudEnabled } from '@/lib/cloud'

/**
 * Бұлт сөндірулі болса — маршрут дерекқорға МҮЛДЕ тимейді.
 * Әйтпесе жазуға келмейтін дискіде база ашылып, 500 қатесі шығар еді.
 */
export function cloudOff(): Response | null {
  if (cloudEnabled) return null
  return NextResponse.json(
    { error: 'Облако выключено в этой сборке: проекты хранятся в браузере.' },
    { status: 503 },
  )
}
