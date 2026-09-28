/** A single colour meaning for classic tool icons, independent of rendering. */
export type ClassicIconName = 'select' | 'new' | 'open' | 'save' | 'print' | 'cut' | 'copy' | 'delete' | 'undo' | 'redo' | 'settings' | 'properties' | 'shop' | 'view' | 'box' | 'decor' | 'lathe' | 'bent' | 'board' | 'text' | 'wire' | 'eye' | 'magnet' | 'light' | 'fit' | 'structure' | 'library' | 'layers' | 'measure' | 'render' | 'room' | 'help' | 'duplicate' | 'mirror' | 'quote' | 'drill' | 'xray' | 'assembly' | 'walk' | 'doors' | 'ghost' | 'door' | 'find' | 'replace' | 'ar' | 'vr'
  | 'insert' | 'catalog' | 'sun' | 'texture' | 'fronts' | 'person' | 'zoomIn' | 'zoomOut' | 'import' | 'sketch' | 'parts' | 'cutlist'
  | 'alignLeft' | 'alignCenterX' | 'alignRight' | 'alignBottom' | 'alignMiddleY' | 'alignTop' | 'alignFront' | 'alignCenterZ' | 'alignBack'
  | 'distributeX' | 'distributeY' | 'distributeZ' | 'group' | 'ungroup' | 'rotateCcw' | 'rotateCw' | 'hide' | 'lock' | 'projectInfo'



export type ClassicIconTone = 'neutral' | 'blue' | 'yellow' | 'red'

export function classicIconTone(name: ClassicIconName): ClassicIconTone {
  if (name === 'delete') return 'red'
  if (name === 'open') return 'yellow'
  // PRO100's disk is blue; the other blue controls change the view/window.
  if (['save', 'view', 'fit', 'render', 'room'].includes(name)) return 'blue'
  return 'neutral'
}
