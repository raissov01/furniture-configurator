import type { Lang } from './i18n'

const copy = {
  ru: { title: 'Мебель в вашей комнате — AR · AisMebel', hint: 'Наведите камеру на пол и поставьте мебель в комнате', alt: 'Мебель', action: 'Смотреть в комнате', error: 'Не удалось загрузить модель', notFound: 'Не найдено' },
  kk: { title: 'Бөлмеңіздегі жиһаз — AR · AisMebel', hint: 'Камераны еденге бағыттап, жиһазды бөлмеге қойыңыз', alt: 'Жиһаз', action: 'Бөлмеде көру', error: 'Модель жүктелмеді', notFound: 'Табылмады' },
  en: { title: 'Furniture in your room — AR · AisMebel', hint: 'Point the camera at the floor to place the furniture in your room', alt: 'Furniture', action: 'View in room', error: 'Could not load model', notFound: 'Not found' },
  uz: { title: 'Xonangizdagi mebel — AR · AisMebel', hint: 'Kamerani polga qarating va mebelni xonaga joylashtiring', alt: 'Mebel', action: 'Xonada ko‘rish', error: 'Model yuklanmadi', notFound: 'Topilmadi' },
} satisfies Record<Lang, Record<'title' | 'hint' | 'alt' | 'action' | 'error' | 'notFound', string>>

export function arPageLang(value: string | null): Lang {
  return value === 'kk' || value === 'en' || value === 'uz' ? value : 'ru'
}

export function arPageCopy(lang: Lang): typeof copy[Lang] {
  return copy[lang]
}
