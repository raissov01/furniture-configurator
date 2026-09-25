/**
 * PRO100 номенклатурасында расталған шкаф түрлері. Каталогқа қосылуы
 * `templates.ts` ішінде жасалады; мұнда тек генератор түсінетін конфиг бар.
 */
import type { CabinetTemplate } from './templates'

const material = {
  carcassMaterialId: 'ldsp16-h1145',
  frontMaterialId: 'ldsp16-h1145',
  backMaterialId: 'hdf3-white',
} as const

const shelf = (id: string, count: number, front: boolean) => ({
  id,
  widthMode: 'flex' as const,
  contents: [{ kind: 'shelves' as const, count, shelfKind: 'adjustable' as const }],
  fronts: front ? { count: 1, mount: 'overlay' as const } : null,
})

export const WARDROBE_EXPANSION_TEMPLATES: CabinetTemplate[] = [
  {
    id: 'wardrobe-sliding-4-2400',
    name: 'Шкаф-купе, четыре двери',
    category: 'wardrobe',
    // Есік түрі PRO100 «Четыре двери» тобында расталады. Габарит — бұрыннан
    // бар үш есікті seed-тің өңделетін бастапқы өлшемі, өндірістік стандарт емес.
    description: 'Четыре двери-купе; размер корпуса можно изменить. Слева и справа штанги, в центре полки.',
    height: 2400, width: 2400, depth: 600,
    range: { height: { min: 1800, max: 2700 }, width: { min: 1800, max: 3200 }, depth: { min: 500, max: 750 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sliding: { count: 4 },
    sections: [
      { id: 's1', widthMode: 'flex', contents: [{ kind: 'rod' }], fronts: null },
      shelf('s2', 5, false),
      shelf('s3', 5, false),
      { id: 's4', widthMode: 'flex', contents: [{ kind: 'rod' }], fronts: null },
    ],
  },
  {
    id: 'wardrobe-hinged-4-1864',
    name: 'Шкаф четырёхдверный',
    category: 'wardrobe',
    // PRO100 MM IMPERIAL: «01 Шкаф Л Л Л Л 1864 х 618 х 2096».
    description: 'Четыре распашных фасада ЛДСП; четыре отдельные секции.',
    height: 2096, width: 1864, depth: 618,
    range: { height: { min: 2096, max: 2096 }, width: { min: 1864, max: 1864 }, depth: { min: 618, max: 618 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [shelf('s1', 4, true), shelf('s2', 4, true), shelf('s3', 4, true), shelf('s4', 4, true)],
  },
  {
    id: 'wardrobe-antresol-300',
    name: 'Антресоль однодверная 300',
    category: 'wardrobe',
    // PRO100 «В Д1 300 антресоль»: ені 300. H/D бар antresol-600 seed-тен.
    description: 'Узкая надстройка с одной распашной дверью; глубина и высота редактируются.',
    height: 400, width: 300, depth: 450,
    range: { height: { min: 250, max: 700 }, width: { min: 300, max: 600 }, depth: { min: 300, max: 700 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }], fronts: { count: 1, mount: 'overlay' } }],
  },
  {
    id: 'wardrobe-pantograph-1000',
    name: 'Гардеробная секция с пантографом',
    category: 'wardrobe',
    // PRO100 гардероб толтыруы: пантограф. Габарит rod-1000 seed-тен.
    description: 'Покупной пантограф в отдельной секции; корпус и фасады включены в деталировку.',
    height: 2200, width: 1000, depth: 600,
    range: { height: { min: 1600, max: 2700 }, width: { min: 600, max: 1400 }, depth: { min: 450, max: 700 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'shelves', count: 1, shelfKind: 'fixed', height: 400 },
        { kind: 'empty' }, { kind: 'filling', filling: 'pantograph' }],
      fronts: { count: 2, mount: 'overlay' },
    }],
  },
  {
    id: 'hallway-open-1000',
    name: 'Прихожая: открытая секция',
    category: 'entry',
    // PRO100 «Прихожая» және «вешалка» түрлері; нақты өлшем берілмейді.
    // Өңделетін бастапқы өлшем wardrobe-rod-1000 seed-інен алынды.
    description: 'Открытая прихожая: штанга для одежды и отдельные полки для обуви.',
    height: 2200, width: 1000, depth: 600,
    range: { height: { min: 1600, max: 2700 }, width: { min: 500, max: 1400 }, depth: { min: 450, max: 700 } },
    construction: 'sidesOverlay', back: 'overlay', ...material,
    sections: [
      { id: 's1', widthMode: 'flex', contents: [{ kind: 'rod' }], fronts: null },
      shelf('s2', 5, false),
    ],
  },
]
