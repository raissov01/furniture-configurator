/**
 * Докинг жүйесінің типтері. Тек таза TypeScript — React, DOM, three.js
 * импорты ЖОҚ (CLAUDE.md §3: логика таза қабатта, React тек көрсетеді).
 *
 * PRO100-дың докинг идеясы (docs/pro100/ui-design.md §2): панельдер
 * әдепкіде қалқымалы (450×200), пайдаланушы оларды жиекке өзі бекітеді.
 * Бір жиекке бірнеше панель бекітілсе — таб болып жиналады.
 */

export type PanelId = string

export type DockSide = 'left' | 'right' | 'top' | 'bottom'

export const DOCK_SIDES: readonly DockSide[] = ['left', 'right', 'top', 'bottom']

export type FloatingRect = {
  x: number
  y: number
  width: number
  height: number
}

/** Докинг контейнерінің (Scene аймағын қоршаған аумақтың) өлшемі. */
export type Bounds = {
  width: number
  height: number
}

export type PanelPlacement =
  | { kind: 'floating'; rect: FloatingRect }
  | { kind: 'docked'; side: DockSide }

export type PanelState = {
  placement: PanelPlacement
  /**
   * Панель жабық па. ⚠ Жабық болса да компонент DOM-нан АЛЫНБАЙДЫ, тек
   * CSS класымен жасырылады — components/ui.tsx-тегі Collapsible ережесі:
   * Tailwind-тың `[hidden]`-і `:where()` ішінде, салмағы 0, `flex`-тен
   * ұтылады, сондықтан жасыру атрибутпен емес, класпен істеледі.
   */
  visible: boolean
  /** Қалқымалы панельдердің қабаттасу реті: үлкен сан — үстінде. */
  z: number
}

export type DockState = {
  panels: Record<PanelId, PanelState>
  /**
   * Әр жиектегі докталған панельдер реті (таб қатары, сол→оң). Жабық
   * панель де осында қалады — тек құрамасы `visible: false` болады, сонда
   * DockPanel DOM-да қалады (жоғарыдағы ⚠-ні қара).
   */
  order: Record<DockSide, PanelId[]>
  /** Әр жиекте қай таб белсенді (мазмұны көрінеді). */
  activeTab: Partial<Record<DockSide, PanelId>>
}

/** PRO100.layout-тағы әдепкі қалқымалы өлшем (docs/pro100/ui-design.md §1). */
export const DEFAULT_FLOATING_SIZE = { width: 450, height: 200 }

/** Панель бұдан кішірейе алмайды — тым кішкентай терезе пайдасыз болады. */
export const MIN_FLOATING_SIZE = { width: 220, height: 140 }
