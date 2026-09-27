'use client'

/** Original 18 px line drawings for the classic desktop controls. */
export type ClassicIconName = 'new' | 'open' | 'save' | 'print' | 'cut' | 'copy' | 'delete' | 'undo' | 'redo' | 'settings' | 'properties' | 'shop' | 'view' | 'box' | 'decor' | 'board' | 'text' | 'wire' | 'eye' | 'magnet' | 'light' | 'fit' | 'structure' | 'library' | 'layers' | 'measure' | 'render' | 'room' | 'help' | 'duplicate' | 'mirror' | 'quote' | 'drill' | 'assembly' | 'walk' | 'doors' | 'ghost' | 'door' | 'find' | 'replace'

export function ClassicIcon({ name }: { name: ClassicIconName }) {
  const blue = 'var(--p100-icon-blue)'
  const red = 'var(--p100-icon-red)'
  const yellow = 'var(--p100-icon-yellow)'
  const shape: Record<ClassicIconName, React.ReactNode> = {
    new: <><path d="M4 2.5h7l3 3V16H4z"/><path d="M11 2.5V6h3"/></>,
    open: <><path d="M2 6h5l1.5 2H16l-2 7H2z" fill={yellow}/><path d="M3 6V4h5l1.5 2"/></>,
    save: <><path d="M3 2h11l2 2v12H3z" fill={blue}/><path d="M6 2v5h7V2M6 16v-6h7v6" stroke="var(--p100-canvas)"/><path d="M8 3v3" stroke="var(--p100-canvas)"/></>,
    print: <><path d="M5 6V2h8v4M5 13H2V7h14v6h-3M5 11h8v5H5z"/><path d="M13 8h1"/></>,
    cut: <><rect x="2" y="2" width="14" height="14"/><path d="M9 2v14M2 9h7M9 12h7"/><path d="M4 4h3M11 4h3" stroke={blue}/></>,
    copy: <><path d="M5 2h10v11H5zM2 5v11h10"/></>,
    delete: <path d="M3 3l12 12M15 3 3 15" stroke={red}/>,
    undo: <path d="M7 4 3 8l4 4M3 8h8a4 4 0 0 1 0 8" stroke={blue}/>,
    redo: <path d="m11 4 4 4-4 4m4-4H7a4 4 0 0 0 0 8" stroke={blue}/>,
    settings: <><circle cx="9" cy="9" r="3"/><path d="M9 1v3m0 10v3M1 9h3m10 0h3M3.4 3.4l2.2 2.2m6.8 6.8 2.2 2.2m0-11.2-2.2 2.2m-6.8 6.8-2.2 2.2"/></>,
    properties: <><path d="M2 4h14M2 9h14M2 14h14"/><circle cx="6" cy="4" r="1.5" fill="var(--p100-canvas)"/><circle cx="12" cy="9" r="1.5" fill="var(--p100-canvas)"/><circle cx="7" cy="14" r="1.5" fill="var(--p100-canvas)"/></>,
    shop: <><path d="M2 7h14v9H2zM2 7l2-5h10l2 5M5 2l-1 5m5-5v5m4-5 1 5M6 16v-5h4v5M12 11h2v2h-2z"/></>,
    view: <><path d="M1 9q8-9 16 0-8 9-16 0z"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,
    box: <><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9"/></>,
    decor: <><path d="M3 15h12M5 12h8v3H5zM6 5l3-3 3 3-3 5zM9 10v2M13 3v3m-1.5-1.5h3"/></>,
    board: <><path d="m2 5 9-3 5 3-9 3zM2 5v9l5 3V8m0 9 9-3V5" fill={blue}/></>,
    text: <><path d="M2 3h14v3M9 3v12m-3 0h6"/></>,
    wire: <><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9" strokeDasharray="2 1"/></>,
    eye: <><path d="M1 9q8-8 16 0-8 8-16 0z"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,
    magnet: <path d="M3 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z" fill={red}/>,
    light: <><path d="M5 7a4 4 0 1 1 8 0c0 2-2 3-2 5H7c0-2-2-3-2-5zM7 14h4M8 16h2" fill={yellow}/></>,
    fit: <path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5M2 2l5 5m9-5-5 5m5 9-5-5m-9 5 5-5" stroke={blue}/>,
    structure: <><path d="M9 2v4M3 8h12M3 8v4m6-4v4m6-4v4"/><rect x="1" y="12" width="4" height="4" fill={blue}/><rect x="7" y="12" width="4" height="4" fill={blue}/><rect x="13" y="12" width="4" height="4" fill={blue}/><rect x="7" y="2" width="4" height="4"/></>,
    library: <><path d="M2 3h4v12H2zM7 2h4v13H7zM12 4h4v11h-4zM2 16h14"/><path d="M9 4v2" stroke={blue}/></>,
    layers: <><path d="m2 5 7-3 7 3-7 3zM2 9l7 3 7-3M2 13l7 3 7-3" stroke={blue}/></>,
    measure: <><path d="M2 3h14v5H2zM4 3v3m3-3v2m3-2v3m3-3v2M4 12v4m0-2h10m0-2v4"/></>,
    render: <><path d="M3 4h12v10H3zM6 16h6M9 14v2"/><circle cx="9" cy="9" r="2" fill={blue}/></>,
    room: <><path d="M2 15V4l7-2 7 2v11M2 15l7 2 7-2M9 2v15"/><path d="M3 12h4" stroke={blue}/></>,
    help: <><circle cx="9" cy="9" r="7"/><path d="M6.5 6.5a2.5 2.5 0 1 1 3 2.5c-1 .5-1 1-1 2M9 13.5v.5"/></>,
    duplicate: <><path d="M2 5h10v11H2zM5 2h10v11"/><path d="M7 8v5m-2.5-2.5h5" stroke={blue}/></>,
    mirror: <><path d="M9 1v16M2 5l5-2v11l-5-2zM16 5l-5-2v11l5-2z"/><path d="M3 9h3m6 0h3" stroke={blue}/></>,
    quote: <><path d="M4 2h10v14H4zM6 5h6M6 8h6M6 11h3"/><path d="M11 13h2" stroke={blue}/></>,
    drill: <><path d="M3 3h12v12H3zM9 4v10M4 9h10"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,
    assembly: <><path d="m2 5 7-3 7 3-7 3zM2 10l7 3 7-3M2 14l7 3 7-3"/><path d="M9 9v3" stroke={blue}/></>,
    walk: <><circle cx="9" cy="3" r="2"/><path d="m9 5 2 4-3 2-3 5m6-7 3 2m-5 0 4 5" stroke={blue}/></>,
    doors: <><path d="M2 2h14v14H2zM9 2v14M5 8h1m6 0h1"/><path d="m2 16 3-2m11 2-3-2" stroke={blue}/></>,
    ghost: <><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9" opacity=".5"/><path d="M3 13h12" stroke={blue} strokeDasharray="2 2"/></>,
    door: <><path d="M3 2h12v14H3zM6 3l6 2v10l-6 2z"/><circle cx="10" cy="10" r="1" fill={blue}/></>,
    find: <><circle cx="7" cy="7" r="5"/><path d="m11 11 5 5" stroke={blue}/></>,
    replace: <><path d="M3 6a6 6 0 0 1 10-2m0-2v3h-3M15 12a6 6 0 0 1-10 2m0 2v-3h3"/><path d="M7 8h4m-2-2v4" stroke={blue}/></>,
  }
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">{shape[name]}</svg>
}
