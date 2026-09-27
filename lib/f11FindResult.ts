type PanelSizes = Pick<import('@/src/core/index').Panel,
  'finishedLength' | 'finishedWidth' | 'cutLength' | 'cutWidth'>

export function findResultSizes(panel: PanelSizes): { finished: string; cut: string } {
  return {
    finished: `${panel.finishedLength} × ${panel.finishedWidth} мм`,
    cut: `${panel.cutLength} × ${panel.cutWidth} мм`,
  }
}
