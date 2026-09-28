export type XrayView = {
  viewMode: 'solid' | 'ghost' | 'wire'
  showDrilling: boolean
  showFittings: boolean
}

export function xrayViewState(state: XrayView, enabled: boolean): XrayView {
  return enabled ? { viewMode: 'ghost', showDrilling: true, showFittings: true } : state
}
