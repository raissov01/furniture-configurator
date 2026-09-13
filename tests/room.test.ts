/**
 * Бөлме мен орналастыру (C фаза).
 *
 * Басты талап: шкаф қай қабырғада тұрса да, оның АРТЫ дәл сол қабырғаға
 * тиіп тұруы керек, ал денесі бөлменің ІШІНДЕ қалуы керек. Бұл тек бұрумен
 * (айнасыз) шығуы керек — әйтпесе оң жақ бүйір сол жаққа ауысып, присадка
 * қате жаққа түседі.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOM,
  SEED_CATALOG,
  findTemplate,
  nextFreeOffset,
  placementFootprint,
  placementPose,
  placementSpan,
  roomWalls,
  templateToCabinet,
  validatePlacements,
  wallById,
} from '../src/core/index'
import type { CabinetConfig, Placement, Room, Vec3, WallId } from '../src/core/index'

const room: Room = DEFAULT_ROOM
const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
const WALLS: WallId[] = ['north', 'east', 'south', 'west']

/** Локал нүктені әлемге аудару — Scene дәл осылай істейді (бұру + жылжыту). */
function toWorld(local: Vec3, pose: { position: Vec3; rotationY: number }): Vec3 {
  const a = (pose.rotationY * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return {
    x: pose.position.x + local.x * cos + local.z * sin,
    y: pose.position.y + local.y,
    z: pose.position.z - local.x * sin + local.z * cos,
  }
}

function corners(c: CabinetConfig): Vec3[] {
  const out: Vec3[] = []
  for (const x of [0, c.width]) for (const y of [0, c.height]) for (const z of [0, c.depth]) out.push({ x, y, z })
  return out
}

describe('бөлме мен қабырғалар', () => {
  it('төрт қабырға, ұзындықтары бөлменің қабырғаларына тең', () => {
    const walls = roomWalls(room)
    expect(walls.map((w) => w.id)).toEqual(['north', 'east', 'south', 'west'])
    expect(wallById(room, 'north').length).toBe(room.width)
    expect(wallById(room, 'south').length).toBe(room.width)
    expect(wallById(room, 'east').length).toBe(room.depth)
    expect(wallById(room, 'west').length).toBe(room.depth)
  })

  it('бағыт пен нормаль бірлік әрі өзара перпендикуляр', () => {
    for (const w of roomWalls(room)) {
      const dLen = Math.hypot(w.direction.x, w.direction.z)
      const nLen = Math.hypot(w.inward.x, w.inward.z)
      expect(dLen).toBeCloseTo(1)
      expect(nLen).toBeCloseTo(1)
      expect(w.direction.x * w.inward.x + w.direction.z * w.inward.z).toBeCloseTo(0)
    }
  })

  it.each(WALLS)('%s қабырғасында: арты қабырғаға тиеді, денесі бөлменің ішінде', (wall) => {
    const placement: Placement = { cabinetId: cabinet.id, wall, offset: 300 }
    const pose = placementPose(room, cabinet, placement)
    const world = corners(cabinet).map((c) => toWorld(c, pose))

    for (const p of world) {
      expect(p.x).toBeGreaterThanOrEqual(-0.001)
      expect(p.x).toBeLessThanOrEqual(room.width + 0.001)
      expect(p.z).toBeGreaterThanOrEqual(-0.001)
      expect(p.z).toBeLessThanOrEqual(room.depth + 0.001)
      expect(p.y).toBeGreaterThanOrEqual(0)
    }

    // Артқы беттің (локал z = D) төрт нүктесі қабырға жазықтығында тұр.
    const w = wallById(room, wall)
    const back = corners(cabinet)
      .filter((c) => c.z === cabinet.depth)
      .map((c) => toWorld(c, pose))
    for (const p of back) {
      const onPlane =
        wall === 'north' ? p.z : wall === 'south' ? room.depth - p.z : wall === 'west' ? p.x : room.width - p.x
      expect(onPlane, `${w.id}`).toBeCloseTo(0)
    }
  })

  it('айна емес, тек бұру: бұрыш 90-ға еселі', () => {
    for (const w of roomWalls(room)) {
      expect(w.rotationY % 90).toBe(0)
    }
  })

  it('offset шкафты қабырға бойымен жылжытады', () => {
    const a = placementPose(room, cabinet, { cabinetId: cabinet.id, wall: 'south', offset: 0 })
    const b = placementPose(room, cabinet, { cabinetId: cabinet.id, wall: 'south', offset: 500 })
    expect(b.position.x - a.position.x).toBe(500)
    expect(b.position.z).toBe(a.position.z)
  })
})

describe('жоспарды тексеру', () => {
  const entry = (id: string, wall: WallId, offset: number, width = 600) => ({
    cabinet: { ...cabinet, id, name: id, width },
    placement: { cabinetId: id, wall, offset },
  })

  it('дұрыс жоспарда мәселе жоқ', () => {
    expect(validatePlacements(room, [entry('a', 'south', 0), entry('b', 'south', 600)])).toEqual([])
  })

  it('қабаттасуды табады және қаншаға екенін айтады', () => {
    const issues = validatePlacements(room, [entry('a', 'south', 0), entry('b', 'south', 400)])
    expect(issues).toHaveLength(1)
    expect(issues[0]!.field).toBe('overlap')
    expect(issues[0]!.message).toContain('200')
  })

  it('әр түрлі қабырғадағы шкафтар қабаттаспайды', () => {
    expect(validatePlacements(room, [entry('a', 'south', 0), entry('b', 'north', 0)])).toEqual([])
  })

  /*
   * БҰРЫШ (09-13): бұрын тек бір қабырға тексерілетін, сондықтан көрші
   * қабырғадағы шкафқа кіріп тұрған модуль «қате жоқ» деп өтетін.
   */
  it('бұрыштағы қабаттасуды табады, ал жанасуды — жоқ', () => {
    const deep = (id: string, wall: WallId, offset: number, depth: number) => ({
      cabinet: { ...cabinet, id, name: id, width: 600, depth },
      placement: { cabinetId: id, wall, offset },
    })
    // Солтүстік offset 0 — солтүстік-шығыс бұрышы; шығыс қатардың бұрыштағы
    // модулі (offset = depth − q − width) дәл одан кейін басталады.
    const eastAt = (q: number) => room.depth - q - 600
    // Пенал 560 тереңдікте, көршісі 500-ден басталса — 60 мм кіреді.
    const hit = validatePlacements(room, [deep('pen', 'north', 0, 560), deep('base', 'east', eastAt(500), 500)])
    expect(hit.some((i) => i.field === 'overlap' && i.message.includes('в углу'))).toBe(true)
    // Көршісі тура 560-тан басталса — тек жанасады, қате емес.
    expect(validatePlacements(room, [deep('pen', 'north', 0, 560), deep('base', 'east', eastAt(560), 500)])).toEqual([])
  })

  it('қабырғадан асып кетсе айтады', () => {
    const issues = validatePlacements(room, [entry('a', 'south', 3800, 600)])
    expect(issues.some((i) => i.field === 'width')).toBe(true)
  })

  it('тереңдігі бөлмеден асса айтады', () => {
    const deep = { cabinet: { ...cabinet, id: 'd', depth: 3500 }, placement: { cabinetId: 'd', wall: 'south' as WallId, offset: 0 } }
    expect(validatePlacements(room, [deep]).some((i) => i.field === 'depth')).toBe(true)
  })

  it('теріс offset-ті ұстайды', () => {
    expect(validatePlacements(room, [entry('a', 'south', -50)]).some((i) => i.field === 'offset')).toBe(true)
  })

  it('келесі бос орын соңғы шкафтың артынан басталады', () => {
    const entries = [entry('a', 'south', 0), entry('b', 'south', 600)]
    expect(nextFreeOffset(room, 'south', entries)).toBe(1200)
    expect(nextFreeOffset(room, 'north', entries)).toBe(0)
  })

  it('аралық ені шкафтың енімен бірдей', () => {
    expect(placementSpan(cabinet, { cabinetId: cabinet.id, wall: 'south', offset: 250 }))
      .toEqual({ start: 250, end: 250 + cabinet.width })
  })
})

describe('жоспардағы төртбұрыш', () => {
  it.each(WALLS)('%s: төртбұрыш бөлменің ішінде әрі қабырғаға тиіп тұр', (wall) => {
    const fp = placementFootprint(room, cabinet, { cabinetId: cabinet.id, wall, offset: 200 })
    expect(fp.x).toBeGreaterThanOrEqual(0)
    expect(fp.z).toBeGreaterThanOrEqual(0)
    expect(fp.x + fp.width).toBeLessThanOrEqual(room.width)
    expect(fp.z + fp.depth).toBeLessThanOrEqual(room.depth)

    const touching =
      wall === 'north' ? fp.z : wall === 'south' ? room.depth - (fp.z + fp.depth)
      : wall === 'west' ? fp.x : room.width - (fp.x + fp.width)
    expect(touching).toBeCloseTo(0)
  })

  it('солтүстік пен оңтүстікте ені X бойымен, шығыс пен батыста Z бойымен', () => {
    const south = placementFootprint(room, cabinet, { cabinetId: cabinet.id, wall: 'south', offset: 0 })
    expect(south.width).toBe(cabinet.width)
    expect(south.depth).toBe(cabinet.depth)
    const west = placementFootprint(room, cabinet, { cabinetId: cabinet.id, wall: 'west', offset: 0 })
    expect(west.width).toBe(cabinet.depth)
    expect(west.depth).toBe(cabinet.width)
  })
})
