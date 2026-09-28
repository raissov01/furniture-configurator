import type { Lang } from './i18n'

const copy: Record<Lang, { title: string; hint: string; button: string; error: string; alt: string }> = {
  ru: { title: 'Мебель в вашей комнате', hint: 'Наведите камеру на пол и поставьте мебель в комнате', button: 'Смотреть в комнате', error: 'Не удалось загрузить модель', alt: 'Мебель' },
  kk: { title: 'Бөлмеңіздегі жиһаз', hint: 'Камераны еденге бағыттап, жиһазды бөлмеге қойыңыз', button: 'Бөлмеде қарау', error: 'Модель жүктелмеді', alt: 'Жиһаз' },
  en: { title: 'Furniture in your room', hint: 'Point the camera at the floor to place the furniture in your room', button: 'View in room', error: 'Could not load the model', alt: 'Furniture' },
  uz: { title: 'Xonangizdagi mebel', hint: 'Kamerani polga qarating va mebelni xonaga joylashtiring', button: 'Xonada ko‘rish', error: 'Modelni yuklab bo‘lmadi', alt: 'Mebel' },
}

export function arPageLanguage(raw: string | null): Lang {
  return raw === 'kk' || raw === 'en' || raw === 'uz' ? raw : 'ru'
}

export function arPageText(lang: Lang) { return copy[lang] }
