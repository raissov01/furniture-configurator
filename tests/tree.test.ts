/**
 * ТҮЙІНДЕР АҒАШЫ — еркін редактордың өзегі.
 *
 * Поза құрамасының бағыты `room.ts`-тегі `placementCorners`-пен БІРДЕЙ
 * болуы керек: world.x = pos.x + lx·cos + lz·sin, world.z = pos.z − lx·sin + lz·cos.
 * Басқаша болса, ескі жоба ағашқа көшкенде шкаф басқа жерге тұрады.
 */
import { describe, expect, it } from 'vitest'
import { ConfigValidationError, ORIGIN_POSE, composePose, findNode, walkTree } from '../src/core/index'
import type { GroupNode, Pose, SceneNode, Transform } from '../src/core/index'

const tr = (x: number, y: number, z: number, rotY = 0): Transform =>
  ({ pos: { x, y, z }, rot: { x: 0, y: rotY, z: 0 } })

const group = (id: string, transform: Transform, children: SceneNode[]): GroupNode =>
  ({ kind: 'group', id, name: id, transform, children })

const solid = (id: string, transform: Transform): SceneNode =>
  ({ kind: 'solid', id, name: id, transform, solid: { size: { x: 100, y: 100, z: 100 } } })

describe('composePose', () => {
  it('бұрылыссыз — орындар жай қосылады', () => {
    const pose = composePose(ORIGIN_POSE, tr(100, 200, 300))
    expect(pose.position).toEqual({ x: 100, y: 200, z: 300 })
    expect(pose.rotationY).toBe(0)
  })

  it('90° бұрылыста x → −z (room.ts келісімі)', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 90 }
    const pose = composePose(parent, tr(100, 0, 0))
    // cos90 = 0, sin90 = 1 → x = 0 + 100·0 + 0·1 = 0; z = 0 − 100·1 + 0·0 = −100
    expect(pose.position.x).toBe(0)
    expect(pose.position.z).toBe(-100)
  })

  it('90°-қа еселі бұрышта «құйрық» қалмайды', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 180 }
    const pose = composePose(parent, tr(450, 0, 0))
    expect(pose.position.x).toBe(-450)
    expect(pose.position.z).toBe(0)
  })

  it('бұрыштар қосылады', () => {
    const parent: Pose = { position: { x: 0, y: 0, z: 0 }, rotationY: 90 }
    expect(composePose(parent, tr(0, 0, 0, 45)).rotationY).toBe(135)
  })

  it('ата позасы ДА, бұрыш ТА нөл емес болғанда формула толық жұмыс істейді', () => {
    // Бар тесттердің бәрінде я ата позасы {0,0,0}, я бұрыш 0 — сондықтан
    // формуладағы parent.position мүшелері мен child.pos.z·sin мүшесі
    // ешқашан бірге тексерілмеген. Мұнда екеуі де нөл емес.
    const parent: Pose = { position: { x: 1000, y: 200, z: 500 }, rotationY: 90 }
    const child: Transform = { pos: { x: 300, y: 150, z: 400 }, rot: { x: 0, y: 0, z: 0 } }
    const pose = composePose(parent, child)
    // cos90 = 0, sin90 = 1 (snapTrig дәл 0/1-ге дөңгелейді):
    //   x = parent.x + child.x·cos + child.z·sin = 1000 + 300·0 + 400·1 = 1400
    //   y = parent.y + child.y                    = 200 + 150            = 350
    //   z = parent.z − child.x·sin + child.z·cos  = 500 − 300·1 + 400·0  = 200
    expect(pose.position).toEqual({ x: 1400, y: 350, z: 200 })
    expect(pose.rotationY).toBe(90)
  })

  it('X немесе Z бойынша бұрылыс — қате', () => {
    expect(() => composePose(ORIGIN_POSE, { pos: { x: 0, y: 0, z: 0 }, rot: { x: 10, y: 0, z: 0 } }))
      .toThrow(ConfigValidationError)
    expect(() => composePose(ORIGIN_POSE, { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 10 } }))
      .toThrow(ConfigValidationError)
  })
})

describe('walkTree', () => {
  it('ұя ішіндегі түйінге АТА позасы қосылып келеді', () => {
    const root = group('root', tr(0, 0, 0), [
      group('g1', tr(1000, 0, 0), [solid('s1', tr(500, 0, 0))]),
    ])
    const seen = new Map<string, Pose>()
    walkTree(root, (node, pose) => { seen.set(node.id, pose) })
    expect(seen.get('g1')!.position.x).toBe(1000)
    expect(seen.get('s1')!.position.x).toBe(1500)
  })

  it('түбірдің өзі де кіреді', () => {
    const root = group('root', tr(7, 0, 0), [])
    const ids: string[] = []
    walkTree(root, (node) => { ids.push(node.id) })
    expect(ids).toEqual(['root'])
  })
})

describe('findNode', () => {
  it('ұяның түбінен табады', () => {
    const root = group('root', tr(0, 0, 0), [group('g1', tr(0, 0, 0), [solid('s1', tr(0, 0, 0))])])
    expect(findNode(root, 's1')!.id).toBe('s1')
  })

  it('жоқ id — undefined', () => {
    expect(findNode(group('root', tr(0, 0, 0), []), 'yoq')).toBeUndefined()
  })
})
