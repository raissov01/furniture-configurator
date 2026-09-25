/** Ас үйдің тек тікбұрышты генератор толық жасайтын қосымша модульдері. */
import type { CabinetTemplate } from './templates'
import type { Section } from './types'

const material = {
  carcassMaterialId: 'ldsp16-w980',
  frontMaterialId: 'ldsp16-w980',
  backMaterialId: 'hdf3-white',
} as const

const drawerSection = (count: number): Section => ({
  id: 's1', widthMode: 'flex',
  contents: [{ kind: 'drawers', count }], fronts: null,
})

export const KITCHEN_EXPANSION_TEMPLATES: CabinetTemplate[] = [
  // Базис ШВ: 1080 (H), 600 (W), 300 (D) — жоғарғы қатарда жиі кездеседі.
  {
    id: 'kitchen-wall-high-1080',
    name: 'Кухня: верхний высокий 1080',
    category: 'kitchen',
    description: 'Высокий навесной модуль с двумя фасадами и полками.',
    height: 1080, width: 600, depth: 300,
    range: { height: { min: 1080, max: 1080 }, width: { min: 300, max: 900 }, depth: { min: 300, max: 300 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'shelves', count: 2, shelfKind: 'adjustable' }], fronts: { count: 2, mount: 'overlay' } }],
  },
  // Базис: ШН 720 (H) × 600 (W) × 550 (D) қатары; 2БГ және 4ящ токендері.
  ...([2, 4] as const).map((count): CabinetTemplate => ({
    id: `kitchen-base-drawers-${count}-600`,
    name: `Кухня: нижний с ${count} ящиками`,
    category: 'kitchen',
    description: `${count} выдвижных ящика, отдельные фасады и коробки.`,
    height: 720, width: 600, depth: 550,
    range: { height: { min: 720, max: 720 }, width: { min: count === 2 ? 400 : 300, max: 900 }, depth: { min: 520, max: 550 } },
    recommendedWidths: count === 2 ? [400, 500, 600, 700, 800, 900] : [300, 400, 500, 600, 700, 800, 900],
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [drawerSection(count)],
  })),
  // Базис: ең жиі ашық сөрелі түр; осы ен мен корпус қатары ШН-де бар.
  {
    id: 'kitchen-base-open-600',
    name: 'Кухня: нижний открытый 600',
    category: 'kitchen',
    description: 'Открытый нижний модуль с двумя полками, без фасада.',
    height: 720, width: 600, depth: 550,
    range: { height: { min: 720, max: 720 }, width: { min: 300, max: 900 }, depth: { min: 520, max: 550 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'shelves', count: 2, shelfKind: 'adjustable' }], fronts: null }],
  },
  // Базис: ШП 2180 (H) × 600 (W) × 550 (D); жай Шкаф, техника ұясы жоқ.
  {
    id: 'kitchen-tall-pantry-2180',
    name: 'Кухня: пенал для хранения 2180',
    category: 'kitchen',
    description: 'Высокий шкаф для хранения с пятью полками и двумя фасадами.',
    height: 2180, width: 600, depth: 550,
    range: { height: { min: 2180, max: 2540 }, width: { min: 400, max: 900 }, depth: { min: 550, max: 550 } },
    recommendedWidths: [400, 500, 600, 700, 800, 900],
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'shelves', count: 5, shelfKind: 'adjustable' }], fronts: { count: 2, mount: 'overlay' } }],
  },
]
