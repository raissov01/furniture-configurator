import type { ClassicIconName } from '@/components/ClassicIcon'

/** Classic toolbar labels and pictures must describe their actual destination. */
export const classicShopTools: Record<'quote' | 'nesting', { icon: ClassicIconName; label: string }> = {
  quote: { icon: 'quote', label: 'Смета и раскрой' },
  nesting: { icon: 'cut', label: 'Раскрой' },
}
