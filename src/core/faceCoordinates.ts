import type { Drill, Panel } from './types'

/**
 * Panel.drilling әрқашан W1/L1 негізді бір канондық РЕЗ кеңістігінде.
 * Станокқа outer бетті жоғары қойғанда оператор детальді таңдалған ось
 * бойымен аударады. Сонда сыртқы беттің сол-төменгі бұрышы басқа болады.
 * Бұл түрлендіру panel/drill-ді өзгертпейді, тек экспорт нүктесін қайтарады.
 */
export function pointOnMachinedFace(
  panel: Pick<Panel, 'cutLength' | 'cutWidth'>,
  point: Pick<Drill, 'face' | 'x' | 'y'>,
  outerFlipAxis: 'length' | 'width',
): { x: number; y: number } {
  if (point.face !== 'outer') return { x: point.x, y: point.y }
  return outerFlipAxis === 'length'
    ? { x: point.x, y: panel.cutWidth - point.y }
    : { x: panel.cutLength - point.x, y: point.y }
}
