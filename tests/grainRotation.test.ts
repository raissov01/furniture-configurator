/**
 * `grainAlongLength` 3D-де ескерілуі керек — CLAUDE.md §3: 3D панель
 * моделінің САЛДАРЫ, ал раскрой да, 3D да БІР `grainAlongLength`-ті оқуы
 * керек (docs/visual/plan.md §5, docs/visual/texture.md §1.5).
 *
 * Мұнда — ТЕК таза функциялар (`lib/decorTexture.ts`): текстураны рендерлеу
 * емес, тек «қай бұрышқа бұру керек» есебі. Рендерді тестпен ұстау қиын,
 * сол себепті осы екі функция бөлек шығарылған.
 */
import { describe, expect, it } from 'vitest'
import { boxGrainUAxis, grainRotation } from '../lib/decorTexture'
import {
  ORIENT_FACING,
  ORIENT_HORIZONTAL,
  ORIENT_SIDE,
  ORIENT_UPRIGHT,
} from '../src/core/index'

describe('boxGrainUAxis — box-геометрияда U-осі қай локал өске сәйкес келеді', () => {
  // Дәлел: three.js BoxGeometry дереккөзінде әр беттің UV құрылысы қатаң
  // бекітілген (buildPlane шақырулары), қалыңдық осіне қарай:
  //   thickness='x' → бет world z/y-мен салынады, U = world z
  //   thickness='y' → бет world x/z-мен салынады, U = world x
  //   thickness='z' → бет world x/y-мен салынады, U = world x
  it('ORIENT_SIDE (thickness=x, width=z): U ЕНГЕ сәйкес келеді', () => {
    expect(boxGrainUAxis(ORIENT_SIDE)).toBe('width')
  })

  it('ORIENT_HORIZONTAL (thickness=y, length=x): U ҰЗЫНДЫҚҚА сәйкес келеді', () => {
    expect(boxGrainUAxis(ORIENT_HORIZONTAL)).toBe('length')
  })

  it('ORIENT_FACING (thickness=z, width=x): U ЕНГЕ сәйкес келеді', () => {
    expect(boxGrainUAxis(ORIENT_FACING)).toBe('width')
  })

  it('ORIENT_UPRIGHT (thickness=z, length=x): U ҰЗЫНДЫҚҚА сәйкес келеді', () => {
    expect(boxGrainUAxis(ORIENT_UPRIGHT)).toBe('length')
  })
})

describe('grainRotation — grainAlongLength екі мәнінде бұрыш өзгеруі керек', () => {
  it('U ҚАЗІР ҰЗЫНДЫҚҚА сәйкес келсе: grainAlongLength=true → бұрылмайды', () => {
    expect(grainRotation('length', true)).toBe(0)
  })

  it('U ҚАЗІР ҰЗЫНДЫҚҚА сәйкес келсе: grainAlongLength=false → 90°-қа бұрылады', () => {
    expect(grainRotation('length', false)).toBeCloseTo(Math.PI / 2)
  })

  it('U ҚАЗІР ЕНГЕ сәйкес келсе: grainAlongLength=true → 90°-қа бұрылады', () => {
    expect(grainRotation('width', true)).toBeCloseTo(Math.PI / 2)
  })

  it('U ҚАЗІР ЕНГЕ сәйкес келсе: grainAlongLength=false → бұрылмайды', () => {
    expect(grainRotation('width', false)).toBe(0)
  })

  it('НЕГІЗГІ ШАРТ: екі grainAlongLength мәнінде бұрыш ӘРҚАШАН өзгереді', () => {
    // Дәл осы тексерілмей тұрған кез: бұрын 3D-де grainAlongLength мүлде
    // оқылмайтын, сондықтан екі мән де бірдей (өзгермейтін) көрініс беретін.
    for (const uAxis of ['length', 'width'] as const) {
      expect(grainRotation(uAxis, true)).not.toBe(grainRotation(uAxis, false))
    }
  })

  it('box панельде (orientation арқылы) grainAlongLength ауысқанда бұрыш өзгереді', () => {
    const uAxis = boxGrainUAxis(ORIENT_SIDE)
    const forLength = grainRotation(uAxis, true)
    const forWidth = grainRotation(uAxis, false)
    expect(forLength).not.toBe(forWidth)
  })
})
