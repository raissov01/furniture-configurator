/** Көріністегі қораптың сегіз төбесі; өндірістік өлшемді өзгертпейді. */
export function selectionHandlePositions(size: { x: number; y: number; z: number }, cornerOrigin: boolean): [number, number, number][] {
  const xs = cornerOrigin ? [0, size.x] : [-size.x / 2, size.x / 2]
  const ys = cornerOrigin ? [0, size.y] : [-size.y / 2, size.y / 2]
  const zs = cornerOrigin ? [0, size.z] : [-size.z / 2, size.z / 2]
  return xs.flatMap((x) => ys.flatMap((y) => zs.map((z): [number, number, number] => [x, y, z])))
}
