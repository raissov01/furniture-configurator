/**
 * Сайттың мәтіндік тұрақтылары.
 *
 * АТАУЫ — AisMebel (иесінің шешімі, 2026-09-26; `src/core/brand.ts`).
 * БАҒАСЫ — ОРЫНБАСАР: тарифті ауыстыру — үш сан.
 */
import { BRAND } from '@/src/core/brand'

export const SITE = {
  name: BRAND.name,
  email: 'hello@example.kz',
}

export type Tariff = {
  id: string
  name: string
  price: string
  note: string
  features: string[]
  highlighted?: boolean
}

/** Сандар — ОРЫНБАСАР. Нақты тарифті иесі қояды. */
export const TARIFFS: Tariff[] = [
  {
    id: 'master',
    name: 'Мастер',
    price: '9 900 ₸ / мес',
    note: 'один пользователь',
    features: [
      'Проекты и корпуса без ограничений',
      'Деталировка, раскрой, DXF и PDF',
      'Свои материалы, цены и правила сборки',
      '30 запросов к чат-боту в месяц',
    ],
  },
  {
    id: 'shop',
    name: 'Цех',
    price: '24 900 ₸ / мес',
    note: 'до 5 пользователей',
    features: [
      'Всё из тарифа «Мастер»',
      'Коммерческое предложение с вашими реквизитами',
      'Общая библиотека шаблонов цеха',
      '300 запросов к чат-боту в месяц',
    ],
    highlighted: true,
  },
  {
    id: 'network',
    name: 'Сеть',
    price: 'по договорённости',
    note: 'несколько цехов',
    features: [
      'Всё из тарифа «Цех»',
      'Отдельные профили под каждый цех',
      'Перенос ваших типовых изделий в шаблоны',
      'Обучение мастеров',
    ],
  },
]
