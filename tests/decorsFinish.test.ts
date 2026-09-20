/**
 * `DecorEntry.finish` (кітапхана, `src/core/decors.ts`) — 09-20 тапсырмасы:
 * атаудан ШЫҒАРЫЛҒАН, ойдан шығарылмаған (CLAUDE.md §10 «ойдан константа
 * ойлап табу — қате мебель»).
 *
 * ⚠ Кириллица гочасы: JS-тің `\b`/`\w` кириллицаны әріп деп танымайды,
 * сондықтан сөз шекарасына сүйенетін regex үнсіз ЕШТЕҢЕ таппай қалады
 * (бүгін басқа агент дәл осыдан жаңылған). Мұнда тексеру — САНМЕН: әр
 * `finish`-тің дәл қанша декорға қойылғанын нақты санмен растайды, сол
 * себепті регресс те, «үнсіз нөл» де байқалады.
 */
import { describe, expect, it } from 'vitest'
import { DECOR_LIBRARY, findDecor, type DecorFinish } from '../src/core/index'

const VALID_FINISH: readonly DecorFinish[] = ['matte', 'satin', 'gloss', 'stone', 'metal']

describe('DECOR_LIBRARY — finish атаудан дәлелмен қойылған', () => {
  it('қойылған finish-тердің бәрі жарамды DecorFinish мәні', () => {
    for (const d of DECOR_LIBRARY) {
      if (d.finish !== undefined) {
        expect(VALID_FINISH, d.id).toContain(d.finish)
      }
    }
  })

  it('САНЫ: тас (камень/мрамор/кварц/тас) — дәл 14 декор', () => {
    const stone = DECOR_LIBRARY.filter((d) => d.finish === 'stone')
    expect(stone.length).toBe(14)
  })

  it('САНЫ: металл (металл/алюминий/хром) — дәл 6 декор', () => {
    const metal = DECOR_LIBRARY.filter((d) => d.finish === 'metal')
    expect(metal.length).toBe(6)
  })

  it('САНЫ: мат (матовый) — дәл 1 декор', () => {
    const matte = DECOR_LIBRARY.filter((d) => d.finish === 'matte')
    expect(matte.length).toBe(1)
  })

  it('САНЫ: жылтыр (глянец/gloss/супермат/soft touch) — 0 декор (кітапханада ондай атау жоқ)', () => {
    const gloss = DECOR_LIBRARY.filter((d) => d.finish === 'gloss')
    expect(gloss.length).toBe(0)
  })

  it('САНЫ: жиыны — 21 декорда ғана finish бар, қалғаны undefined (qazirgi qauypsyz mínez)', () => {
    const withFinish = DECOR_LIBRARY.filter((d) => d.finish !== undefined)
    expect(withFinish.length).toBe(21)
    expect(withFinish.length).toBeLessThan(DECOR_LIBRARY.length / 10)
  })

  it('KRONOSPAN-дың латын "K" әрпімен жазылған "Kамень" де тас деп танылды (гоча)', () => {
    // src/core/decors.ts-те K350..K353 атауында Кириллица «К»-ның орнына
    // латын «K» тұр («Kамень») — дәйекті regex осыны да табуы керек.
    for (const id of ['kronospan-k353', 'kronospan-k352', 'kronospan-k351', 'kronospan-k350', 'kronospan-k349']) {
      expect(findDecor(id)?.finish, id).toBe('stone')
    }
  })

  it('нақты мысалдар: мрамор, кварц, қазақша "тас" — stone', () => {
    expect(findDecor('egger-f243')?.finish).toBe('stone') // Мрамор Кандела
    expect(findDecor('-15')?.finish).toBe('stone') // Розовый кварц
    expect(findDecor('-98')?.finish).toBe('stone') // тас
    expect(findDecor('-99')?.finish).toBe('stone') // тас
  })

  it('нақты мысалдар: алюминий, металл, хромикс — metal', () => {
    expect(findDecor('kronospan-0881')?.finish).toBe('metal') // Алюминий
    expect(findDecor('egger-f528')?.finish).toBe('metal') // Металл брашированный
    expect(findDecor('egger-f637')?.finish).toBe('metal') // Хромикс
  })

  it('нақты мысал: Серебристый матовый — matte', () => {
    expect(findDecor('egger-f765')?.finish).toBe('matte')
  })

  it('КҮМӘНДІ жағдайлар толтырылмаған: "Дуб" (ағаш), "Белый" (жай түс) finish алмаған', () => {
    // Ағаш декорлар (мысалы дуб) glossy/matte/stone/metal ешбірі емес —
    // finishToMaterial(undefined) → matte, қазіргі мінез, өзгертпеу керек.
    const oak = DECOR_LIBRARY.filter((d) => /дуб/i.test(d.name))
    expect(oak.length).toBeGreaterThan(20)
    expect(oak.every((d) => d.finish === undefined)).toBe(true)
  })

  it('"ДСП столещница" (жалпы ДСП, тас емес) finish алмаған — сенімсіз жағдайда толтырылмайды', () => {
    const generic = DECOR_LIBRARY.find((d) => /столещниц/i.test(d.name))
    expect(generic).toBeDefined()
    expect(generic?.finish).toBeUndefined()
  })
})
