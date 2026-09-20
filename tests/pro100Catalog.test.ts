/**
 * PRO100 номенклатурасы талдағышының тесті (docs/pro100/ui-design.md §2,
 * «Библиотека» панелі тапсырмасы).
 *
 * Кіріс жолдардың БӘРІ — `~/Downloads/PRO100 v7.08.rar`-дан `unrar lb`
 * арқылы алынған НАҚТЫ `.meb` файл аттары (ойдан шығарылмаған, тексерілді:
 * `grep -Fx "<жол>" ...`). Мақсат — талдау ЕРЕЖЕЛЕРІН қорғау, генерацияны
 * емес: `pro100Catalog.ts`-тегі `parseCabinetName` осы файлдан бөлек,
 * React/JSON-сыз таза функция.
 */
import { describe, expect, it } from 'vitest'
import {
  parseCabinetName,
  PRO100_CABINET_ITEMS,
  PRO100_LIBRARY,
  pro100ParseStats,
} from '../src/core/data/pro100Catalog'

describe('parseCabinetName — нақты .meb аттары', () => {
  it('«В - 300 1дв»: үстіңгі, 1 есік, ені 300', () => {
    expect(parseCabinetName('В - 300 1дв')).toEqual({
      position: 'upper',
      doorCount: 1,
      widthMm: 300,
    })
  })

  it('«Н 2дв Мойка 600»: төменгі, 2 есік, мойка, ені 600', () => {
    expect(parseCabinetName('Н 2дв Мойка 600')).toEqual({
      position: 'lower',
      doorCount: 2,
      hasSink: true,
      widthMm: 600,
    })
  })

  it('«Н В3 700»: позиция бірінші токеннен, тип коды екіншіден', () => {
    expect(parseCabinetName('Н В3 700')).toEqual({
      position: 'lower',
      variant: 'В3',
      widthMm: 700,
    })
  })

  it('«Н В3(1000)»: жақшамен жабысқан тип+сан бөлек токенге бөлінеді', () => {
    expect(parseCabinetName('Н В3(1000)')).toEqual({
      position: 'lower',
      variant: 'В3',
      widthMm: 1000,
    })
  })

  it('«НВ2 +1 ящик 900»: біріккен позиция (combined), ящик саны, ені', () => {
    expect(parseCabinetName('НВ2 +1 ящик 900')).toEqual({
      position: 'combined',
      variant: 'НВ2',
      drawerCount: 1,
      widthMm: 900,
    })
  })

  it('«Посудамойка Bosch 450»: «мойка» СӨЗДІҢ ІШІНДЕ — hasSink ЖОҚ, тек ені оқылады', () => {
    const result = parseCabinetName('Посудамойка Bosch 450')
    expect(result.hasSink).toBeUndefined()
    expect(result.position).toBeUndefined()
    expect(result.widthMm).toBe(450)
  })

  it('«Угловой 780 (400)»: екі сан кандидаты — ені белгісіз, undefined', () => {
    const result = parseCabinetName('Угловой 780 (400)')
    expect(result.widthMm).toBeUndefined()
  })

  it('«Трапеция 650х650»: «х» арқылы жабысқан бірдей екі сан — бір ені', () => {
    expect(parseCabinetName('Трапеция 650х650').widthMm).toBe(650)
  })

  it('«Н мойка угловая 1000»: дербес «мойка» токені — hasSink бар', () => {
    const result = parseCabinetName('Н мойка угловая 1000')
    expect(result.position).toBe('lower')
    expect(result.hasSink).toBe(true)
    expect(result.widthMm).toBe(1000)
  })

  it('«Без фасада 350»: позиция жоқ атауда тек ені оқылады', () => {
    expect(parseCabinetName('Без фасада 350')).toEqual({ widthMm: 350 })
  })

  it('таза сипаттама сөздерінде (позиция/сан жоқ) бос объект қайтарады', () => {
    expect(parseCabinetName('Зонтик')).toEqual({})
    expect(parseCabinetName('Радиусный без фас')).toEqual({})
  })

  it('латын гомоглиф: «B»/«H» позиция ретінде де танылады (қорғаныс тест)', () => {
    // Нақты корпуста бүгін ЖОҚ, бірақ Kronospan-дағы латын «K» гочасы
    // ертең .meb атауларында да кездесуі мүмкін — regex алдын ала дайын.
    expect(parseCabinetName('B 2dv 800').position).toBe('upper')
    expect(parseCabinetName('H 1dv 400').position).toBe('lower')
  })

  it('ені диапазоннан тыс сандарды (SKU, тесік диаметрі) кандидат қылмайды', () => {
    // «RT.01.596.9005» — нүктелі SKU коды, бір таза сан токені жоқ.
    expect(parseCabinetName('RT.01.596.9005').widthMm).toBeUndefined()
    // «01 -  Пенал духовка 2выдвиж Firmax» — 01 диапазоннан тыс (<100).
    expect(parseCabinetName('01 -  Пенал духовка 2выдвиж Firmax')).toEqual({ drawerCount: 2 })
  })
})

describe('PRO100_LIBRARY — толық каталог', () => {
  it('нақты 5094 жол бар (тапсырмада көрсетілген сан)', () => {
    expect(PRO100_LIBRARY.length).toBe(5094)
  })

  it('id бәрі бірегей', () => {
    expect(new Set(PRO100_LIBRARY.map((i) => i.id)).size).toBe(PRO100_LIBRARY.length)
  })

  it('әр жазбаның path[0] === "Мебель"', () => {
    expect(PRO100_LIBRARY.every((i) => i.path[0] === 'Мебель')).toBe(true)
  })

  it('accessory топта parsed бос объект (шкаф өрістері талданбайды)', () => {
    const accessories = PRO100_LIBRARY.filter((i) => i.group === 'accessory')
    expect(accessories.length).toBeGreaterThan(0)
    expect(accessories.every((i) => Object.keys(i.parsed).length === 0)).toBe(true)
  })

  it('cabinet топ бос емес', () => {
    expect(PRO100_CABINET_ITEMS.length).toBeGreaterThan(0)
  })
})

describe('pro100ParseStats — талдау пайызы (ЕСЕПКЕ керек, 100% БОЛМАУЫ КЕРЕК)', () => {
  it('ені шамамен жартысында оқылады, БӘРІНДЕ ЕМЕС', () => {
    const stats = pro100ParseStats()
    // Дәл пайызды бекітпейміз (корпус аздап өзгеруі мүмкін), тек ауқымды:
    // талдау шынайы, толық емес екенін қорғаймыз.
    expect(stats.widthMmPct).toBeGreaterThan(30)
    expect(stats.widthMmPct).toBeLessThan(80)
    expect(stats.anyFieldPct).toBeGreaterThan(30)
    expect(stats.anyFieldPct).toBeLessThan(100)
  })
})
