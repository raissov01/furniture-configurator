import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, accountFromToken } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'
import { readPlan, usageOf } from '@/lib/server/plan'
import { planPrice } from '@/lib/plans'
import { billingEnabled } from '@/lib/billing'

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const jar = await cookies()
  const account = accountFromToken(jar.get(SESSION_COOKIE)?.value)
  if (!account) return NextResponse.json({ account: null }, { status: 200 })

  // Тариф пен қолданыс аккаунт терезесінде көрінеді: цех нені шектеп
  // тұрғанын БОЛҒАНҒА ДЕЙІН білуі керек, сақтау сәтінде емес.
  const { plan, until, expired } = readPlan(account.shopId)
  return NextResponse.json({
    account,
    // Тегін кезеңде терезеде тариф КАРТОЧКАСЫ көрсетілмейді: шектеу жоқ
    // жерде «Тариф: Команда» деп тұру адамды шатастырады.
    billing: billingEnabled(),
    plan: {
      id: plan.id,
      name: plan.name,
      note: plan.note,
      projects: plan.projects,
      members: plan.members,
      price: planPrice(plan.id),
      until,
      expired,
    },
    usage: usageOf(account.shopId),
  })
}
