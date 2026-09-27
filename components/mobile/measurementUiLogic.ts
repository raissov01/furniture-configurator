/** UI input rules; the core still validates the persisted measurement. */
export function parseWholeInput(raw: string | undefined, minimum: number): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= minimum ? value : null
}

export function toleranceIssue(wallMm: string, cornerDeg: string): 'wallMm' | 'cornerDeg' | null {
  if (parseWholeInput(wallMm, 0) === null) return 'wallMm'
  if (parseWholeInput(cornerDeg, 0) === null) return 'cornerDeg'
  return null
}

type Location = { offset: number; width: number; elevation: number; height: number }
export function locationIssue(location: Location, wallLength: number, roomHeight: number):
  { axis: 'wall' | 'height'; actual: number; limit: number } | null {
  const wallEnd = location.offset + location.width
  if (wallEnd > wallLength) return { axis: 'wall', actual: wallEnd, limit: wallLength }
  const heightEnd = location.elevation + location.height
  if (heightEnd > roomHeight) return { axis: 'height', actual: heightEnd, limit: roomHeight }
  return null
}

export function nextNetworkMessage(current: string, online: boolean,
  unavailable = 'Сервер недоступен', offline = 'Нет сети'): string {
  const networkError = current === 'Failed to fetch' || current === unavailable || current === offline
  if (!online && networkError) return offline
  if (online && networkError) return ''
  return current
}
