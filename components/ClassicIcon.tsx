'use client'

/**
 * Original line drawings for the classic desktop controls. Drawn on an 18-unit
 * grid and shown at 16 px — the PRO100 toolbar icon size (эталон `base-inserted.png`).
 */
import { classicIconTone, type ClassicIconName } from '@/lib/classicIconPalette'
export type { ClassicIconName } from '@/lib/classicIconPalette'

export function ClassicIcon({ name }: { name: ClassicIconName }) {
  const tone = classicIconTone(name)
  const blue = tone === 'blue' ? 'var(--p100-icon-blue)' : 'currentColor'
  const red = tone === 'red' ? 'var(--p100-icon-red)' : 'currentColor'
  const yellow = tone === 'yellow' ? 'var(--p100-icon-yellow)' : 'none'
  const shape: Record<ClassicIconName, React.ReactNode> = {
    select: <path d="M3 2v13l3.5-3.2 2.1 4.1 2.3-1.2-2.2-4.1L14 10z" fill={blue} />,
    new: <><path d="M4 2.5h7l3 3V16H4z" fill="var(--p100-canvas)"/><path d="M11 2.5V6h3"/></>,
    open: <><path d="M2 6h5l1.5 2H16l-2 7H2z" fill={yellow}/><path d="M3 6V4h5l1.5 2"/></>,
    save: <><path d="M3 2h11l2 2v12H3z" fill={blue}/><path d="M6 2v5h7V2M6 16v-6h7v6" stroke="var(--p100-canvas)"/><path d="M8 3v3" stroke="var(--p100-canvas)"/></>,
    print: <><path d="M2 7h14v6h-3v-2H5v2H2z" fill="var(--p100-icon-gray)"/><path d="M5 6V2h8v4" fill="var(--p100-canvas)"/><path d="M5 11h8v5H5z" fill="var(--p100-canvas)"/><path d="M13 8.5h1"/></>,
    cut: <><rect x="2" y="2" width="14" height="14"/><path d="M9 2v14M2 9h7M9 12h7"/><path d="M4 4h3M11 4h3" stroke={blue}/></>,
    copy: <><path d="M5 2h10v11H5zM2 5v11h10"/></>,
    delete: <path d="M3 3l12 12M15 3 3 15" stroke={red}/>,
    undo: <path d="M7 4 3 8l4 4M3 8h8a4 4 0 0 1 0 8" stroke={blue}/>,
    redo: <path d="m11 4 4 4-4 4m4-4H7a4 4 0 0 0 0 8" stroke={blue}/>,
    settings: <><circle cx="9" cy="9" r="3"/><path d="M9 1v3m0 10v3M1 9h3m10 0h3M3.4 3.4l2.2 2.2m6.8 6.8 2.2 2.2m0-11.2-2.2 2.2m-6.8 6.8-2.2 2.2"/></>,
    properties: <><path d="M2 4h14M2 9h14M2 14h14"/><circle cx="6" cy="4" r="1.7" fill="var(--p100-icon-blue)"/><circle cx="12" cy="9" r="1.7" fill="var(--p100-icon-blue)"/><circle cx="7" cy="14" r="1.7" fill="var(--p100-icon-blue)"/></>,
    shop: <><path d="M2 7h14v9H2zM2 7l2-5h10l2 5M5 2l-1 5m5-5v5m4-5 1 5M6 16v-5h4v5M12 11h2v2h-2z"/></>,
    view: <><path d="M1 9q8-9 16 0-8 9-16 0z"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,

    box: <><path d="m2 5 7-3 7 3v9l-7 3-7-3z" fill="var(--p100-icon-lightblue)"/><path d="M2 5l7 3 7-3M9 8v9"/><path d="m9 8 7-3v9l-7 3z" fill="var(--p100-icon-blue)" opacity=".55"/></>,
    decor: <><path d="M3 15h12"/><path d="M5 12h8v3H5z" fill="var(--p100-icon-lightblue)"/><path d="M6 5l3-3 3 3-3 5z" fill="var(--p100-icon-yellow)"/><path d="M9 10v2M13 3v3m-1.5-1.5h3"/></>,
    lathe: <><path d="M2 3h14M2 15h14M9 3v2M9 13v2M6 5h6l-2 3 2 3-2 2H8l-2-2 2-3z"/></>,
    bent: <><path d="M2 14q7-11 14 0M2 11q7-11 14 0M2 11v3m14-3v3"/></>,
    board: <><path d="m2 5 9-3 5 3-9 3z" fill="var(--p100-icon-lightblue)"/><path d="M2 5v9l5 3V8m0 9 9-3V5" fill="none"/></>,
    text: <><path d="M2 6V3h14v3M9 3v12m-3 0h6" stroke="var(--p100-icon-blue)" strokeWidth="1.6"/></>,
    wire: <><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9" strokeDasharray="2 1"/></>,
    eye: <><path d="M1 9q8-8 16 0-8 8-16 0z"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,
    magnet: <path d="M3 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z" fill="var(--p100-icon-red)" stroke="var(--p100-icon-red)"/>,
    light: <><path d="M5 7a4 4 0 1 1 8 0c0 2-2 3-2 5H7c0-2-2-3-2-5zM7 14h4M8 16h2" fill="none"/></>,
    fit: <path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5M2 2l5 5m9-5-5 5m5 9-5-5m-9 5 5-5" stroke={blue}/>,
    structure: <><path d="M9 6v2M3 8h12M3 8v4m6-4v4m6-4v4"/><rect x="1" y="12" width="4" height="4" fill="var(--p100-icon-lightblue)"/><rect x="7" y="12" width="4" height="4" fill="var(--p100-icon-lightblue)"/><rect x="13" y="12" width="4" height="4" fill="var(--p100-icon-lightblue)"/><rect x="7" y="2" width="4" height="4" fill="var(--p100-icon-blue)"/></>,
    library: <><path d="M2 3h4v12H2zM7 2h4v13H7zM12 4h4v11h-4zM2 16h14"/><path d="M9 4v2" stroke={blue}/></>,
    layers: <><path d="m2 5 7-3 7 3-7 3zM2 9l7 3 7-3M2 13l7 3 7-3" stroke={blue}/></>,
    measure: <><path d="M2 3h14v5H2z" fill="var(--p100-icon-lightblue)"/><path d="M4 3v3m3-3v2m3-2v3m3-3v2"/><path d="M4 12v4m0-2h10m0-2v4" stroke="var(--p100-icon-blue)"/></>,
    render: <><path d="M3 4h12v10H3zM6 16h6M9 14v2"/><circle cx="9" cy="9" r="2" fill={blue}/></>,
    room: <><path d="M2 15V4l7-2v15z" fill="var(--p100-icon-lightblue)"/><path d="M2 15V4l7-2 7 2v11M2 15l7 2 7-2M9 2v15"/><path d="M3 12h4" stroke={blue}/></>,
    help: <><circle cx="9" cy="9" r="7" fill="var(--p100-icon-blue)" stroke="var(--p100-icon-blue)"/><path d="M6.5 6.5a2.5 2.5 0 1 1 3 2.5c-1 .5-1 1-1 2M9 13.5v.5" stroke="var(--p100-canvas)"/></>,
    duplicate: <><path d="M5 2h10v11H5z" fill="var(--p100-canvas)"/><path d="M2 5h10v11H2z" fill="var(--p100-canvas)"/><path d="M7 8v5m-2.5-2.5h5" stroke="var(--p100-icon-blue)"/></>,
    mirror: <><path d="M9 1v16M2 5l5-2v11l-5-2zM16 5l-5-2v11l5-2z"/><path d="M3 9h3m6 0h3" stroke={blue}/></>,
    quote: <><path d="M4 2.5h10v13.5H4zM7 1.5h4v2H7z"/><path d="M11.5 6.5h-5l3 3-3 3h5" stroke={blue} strokeWidth="1.4"/></>,
    drill: <><path d="M3 3h12v12H3zM9 4v10M4 9h10"/><circle cx="9" cy="9" r="2.5" fill={blue}/></>,
    xray: <><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9"/><circle cx="9" cy="9" r="2" fill={blue}/><path d="M4 5.5 14 14" strokeDasharray="2 2"/></>,
    assembly: <><path d="M2 3h5v5H2zM11 3h5v5h-5zM6.5 12h5v5h-5z"/><path d="M7 5h4M9 8v4M4 8v4h2m8-4v4h-2" stroke={blue}/></>,

    walk: <><circle cx="9" cy="3" r="2"/><path d="m9 5 2 4-3 2-3 5m6-7 3 2m-5 0 4 5" stroke={blue}/></>,
    doors: <><path d="M2 2h14v14H2zM9 2v14M5 8h1m6 0h1"/><path d="m2 16 3-2m11 2-3-2" stroke={blue}/></>,
    ghost: <><path d="m2 5 7-3 7 3v9l-7 3-7-3z" fill="var(--p100-icon-lightblue)" opacity=".45"/><path d="m2 5 7-3 7 3v9l-7 3-7-3zM2 5l7 3 7-3M9 8v9"/></>,
    door: <><path d="M3 2h12v14H3zM6 3l6 2v10l-6 2z"/><circle cx="10" cy="10" r="1" fill={blue}/></>,
    find: <><circle cx="7" cy="7" r="5" fill="var(--p100-icon-lightblue)"/><path d="m11 11 5 5" stroke="var(--p100-icon-blue)" strokeWidth="2"/></>,
    replace: <><path d="M3 6a6 6 0 0 1 10-2m0-2v3h-3M15 12a6 6 0 0 1-10 2m0 2v-3h3"/><path d="M7 8h4m-2-2v4" stroke={blue}/></>,
    ar: <><path d="M3 5h3l1.5-2h3L12 5h3v10H3z"/><circle cx="9" cy="10" r="2.5"/><path d="M1 8V5a2 2 0 0 1 2-2m14 5V5a2 2 0 0 0-2-2"/></>,
    // Шебер: сиқырлы таяқша + кухня модульдері (бірнеше қадаммен құрастыру).
    wizard: <><path d="m2 16 8-8M9 7l2 2"/><path d="M13 2v4m-2-2h4M15.5 8.5v2m-1-1h2M6 3v2M5 4h2" stroke={blue}/><path d="M11 12h5v4h-5zM13.5 12v4"/></>,
    vr: <><path d="M2 6h14v7H2zM2 9H1m15 0h1M5 13l2-2h4l2 2"/><path d="M5 9h2m4 0h2"/></>,

    insert: <><rect x="2" y="9" width="14" height="4" fill={blue}/><path d="M12 1.5v6M9 4.5h6" stroke="var(--p100-icon-green)" strokeWidth="1.6"/></>,
    catalog: <><path d="M3 2.5h10a1 1 0 0 1 1 1V16H4a1 1 0 0 1-1-1z" fill="var(--p100-icon-lightblue)"/><path d="M3 13.5h11"/><path d="M6 5h5M6 7.5h5" stroke="var(--p100-icon-blue)"/></>,
    sun: <><circle cx="9" cy="9" r="3.2" fill="var(--p100-icon-yellow)"/><path d="M9 1.5v2m0 11v2M1.5 9h2m11 0h2M3.7 3.7l1.4 1.4m7.8 7.8 1.4 1.4m0-10.6-1.4 1.4m-7.8 7.8-1.4 1.4"/></>,
    texture: <><rect x="2" y="3" width="14" height="12" fill={blue} opacity=".35"/><path d="M2 3h14v12H2zM2 7c3-1 6 1 9 0s4-1 5-1M2 11c3-1 6 1 9 0s4-1 5-1"/></>,
    fronts: <><path d="M2 2h14v14H2z"/><path d="M4 4h4.5v10H4zM9.5 4H14v10H9.5z" fill={blue} opacity=".45"/></>,
    person: <><circle cx="9" cy="3" r="1.8" fill="var(--p100-icon-blue)"/><path d="M9 5v6m-3.5-4h7M9 11l-2.5 5M9 11l2.5 5" stroke="var(--p100-icon-blue)"/></>,
    zoomIn: <><circle cx="7.5" cy="7.5" r="5"/><path d="m11 11 5 5M5 7.5h5M7.5 5v5"/></>,
    zoomOut: <><circle cx="7.5" cy="7.5" r="5"/><path d="m11 11 5 5M5 7.5h5"/></>,
    import: <><path d="M3 11v5h12v-5"/><path d="M9 2v9m-3.5-3.5L9 11l3.5-3.5" stroke={blue}/></>,
    sketch: <><path d="M3 15 13.5 4.5l2 2L5 17H3z"/><path d="M2 5c2-3 4 1 6-2" stroke={blue}/></>,
    parts: <><path d="M2 12h9v4H2zM5 2h4v9H5z"/><path d="M13 3v6m-3-3h6" stroke={blue}/></>,
    cutlist: <><path d="M2 2.5h14v4H2z" fill="var(--p100-icon-lightblue)"/><path d="M2 2.5h14v13H2zM2 6.5h14M2 10.5h14M7 2.5v13"/></>,
    alignLeft: <><path d="M2.5 1.5v15"/><rect x="4" y="3.5" width="10" height="4" fill={blue}/><rect x="4" y="10.5" width="6" height="4" fill={blue}/></>,
    alignCenterX: <><path d="M9 1.5v15"/><rect x="3.5" y="3.5" width="11" height="4" fill={blue}/><rect x="5.5" y="10.5" width="7" height="4" fill={blue}/></>,
    alignRight: <><path d="M15.5 1.5v15"/><rect x="4" y="3.5" width="10" height="4" fill={blue}/><rect x="8" y="10.5" width="6" height="4" fill={blue}/></>,
    alignBottom: <><path d="M1.5 15.5h15"/><rect x="3.5" y="4" width="4" height="10" fill={blue}/><rect x="10.5" y="8" width="4" height="6" fill={blue}/></>,
    alignMiddleY: <><path d="M1.5 9h15"/><rect x="3.5" y="3.5" width="4" height="11" fill={blue}/><rect x="10.5" y="5.5" width="4" height="7" fill={blue}/></>,
    alignTop: <><path d="M1.5 2.5h15"/><rect x="3.5" y="4" width="4" height="10" fill={blue}/><rect x="10.5" y="4" width="4" height="6" fill={blue}/></>,
    alignFront: <><path d="M2 14.5 8 11h9"/><path d="m3 11 3-2h6l-3 2zM6 7l3-2h6l-3 2z" fill={blue}/></>,
    alignCenterZ: <><path d="M2 11 8 7h9" strokeDasharray="2 1.5"/><path d="m2 14 3-2h6l-3 2zM7 6l3-2h6l-3 2z" fill={blue}/></>,
    alignBack: <><path d="M1 7.5 7 4h10"/><path d="m3 13 3-2h6l-3 2zM6 9l3-2h6l-3 2z" fill={blue}/></>,
    distributeX: <><path d="M1.5 2v14M16.5 2v14"/><rect x="3.5" y="5" width="3" height="8" fill={blue}/><rect x="7.5" y="5" width="3" height="8" fill={blue}/><rect x="11.5" y="5" width="3" height="8" fill={blue}/></>,
    distributeY: <><path d="M2 1.5h14M2 16.5h14"/><rect x="5" y="3.5" width="8" height="3" fill={blue}/><rect x="5" y="7.5" width="8" height="3" fill={blue}/><rect x="5" y="11.5" width="8" height="3" fill={blue}/></>,
    distributeZ: <><path d="M1 16 7 12M11 6l6-4"/><path d="m2 13 3-2h5l-3 2zM5 10l3-2h5l-3 2zM8 7l3-2h5l-3 2z" fill={blue}/></>,
    group: <><path d="M1.5 1.5h15v15h-15z" strokeDasharray="2 1.5"/><rect x="4" y="4" width="5" height="5" fill={blue}/><rect x="9" y="9" width="5" height="5" fill={blue}/></>,
    ungroup: <><rect x="2" y="2" width="6" height="6" fill={blue}/><rect x="10" y="10" width="6" height="6" fill={blue}/><path d="M11 2h5v5M2 11v5h5" strokeDasharray="2 1.5"/></>,
    rotateCcw: <><path d="M4 7.5a6 6 0 1 1 1 6" stroke={blue}/><path d="M2 3.5 4 7.5l4-1.5" stroke={blue}/></>,
    rotateCw: <><path d="M14 7.5a6 6 0 1 0-1 6" stroke={blue}/><path d="m16 3.5-2 4-4-1.5" stroke={blue}/></>,
    hide: <><path d="M1 9q8-8 16 0-8 8-16 0z"/><circle cx="9" cy="9" r="2.5"/><path d="M2 16 16 2" stroke="var(--p100-icon-red)"/></>,
    lock: <><rect x="3" y="8" width="12" height="8" fill="var(--p100-icon-yellow)"/><path d="M5.5 8V5.5a3.5 3.5 0 0 1 7 0V8"/></>,
    projectInfo: <><path d="M3 1.5h9l3 3v12H3z"/><path d="M6 7h6M6 10h6M6 13h4" stroke={blue}/></>,
  }
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">{shape[name]}</svg>
}
