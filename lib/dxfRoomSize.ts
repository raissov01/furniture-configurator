import type { DxfImportResult } from '@/src/core/import/dxf'

/** The room model has four straight, axis-aligned walls. Reject other plans instead of losing geometry. */
export function dxfRoomSize(result: DxfImportResult): { width: number; depth: number } {
  if (result.walls.length !== 4 || result.circles.length > 0 || result.arcs.length > 0) {
    throw new Error('Можно импортировать только прямоугольный план из четырёх стен')
  }
  const xs = result.walls.flatMap((wall) => [wall.start.x, wall.end.x])
  const zs = result.walls.flatMap((wall) => [wall.start.z, wall.end.z])
  if (![...xs, ...zs].every(Number.isInteger)) {
    throw new Error('Координаты DXF должны быть целыми миллиметрами')
  }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = maxX - minX
  const depth = maxZ - minZ
  if (width <= 0 || depth <= 0) throw new Error('Размеры комнаты должны быть больше нуля')

  const edge = (ax: number, az: number, bx: number, bz: number): string => {
    const a = `${ax},${az}`
    const b = `${bx},${bz}`
    return a < b ? `${a}|${b}` : `${b}|${a}`
  }
  const expected = new Set([
    edge(minX, minZ, maxX, minZ),
    edge(maxX, minZ, maxX, maxZ),
    edge(minX, maxZ, maxX, maxZ),
    edge(minX, minZ, minX, maxZ),
  ])
  for (const wall of result.walls) {
    const key = edge(wall.start.x, wall.start.z, wall.end.x, wall.end.z)
    if (!expected.delete(key)) {
      throw new Error('Можно импортировать только прямоугольный план из четырёх стен')
    }
  }
  if (expected.size > 0) throw new Error('Можно импортировать только прямоугольный план из четырёх стен')
  return { width, depth }
}
