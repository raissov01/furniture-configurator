/**
 * Оқыту турының аялдамалары — РЕЖИМГЕ қарай.
 *
 * ⚠ 09-26 аудиті (P0-2): классикалық режимде 6 қадамның 4-еуі (size,
 * sections, export, shop) жасырын header/аяс ішіндегі элементке байланған
 * еді. Олар DOM-да БАР, бірақ көрінбейді — тур 0×0 тесікпен бүкіл экранды
 * қараңғылап тұратын. Енді: (1) классикада өз аялдамалары, (2) мақсаты жоқ
 * НЕМЕСЕ көрінбейтін қадам өткізіледі.
 */

export type TourStep = {
  /** Қай элементті көрсету. Табылмаса не көрінбесе — қадам өткізіледі. */
  selector: string
  title: string
  text: string
}

const SCENE: TourStep = {
  selector: '[data-tour="scene"]',
  title: 'Это не картинка, а те же детали',
  text: '3D и деталировка считаются из одной модели: если тут что-то не так, значит и в раскрое будет не так.',
}
const CUTLIST: TourStep = {
  selector: '[data-tour="cutlist"]',
  title: 'Деталировка: готовый и рез',
  text: 'Клиенту показывают готовый размер, цеху — рез. Разница — толщина кромки, и она уже вычтена.',
}

/**
 * «Наш» режимі — жұмыстың НАҚТЫ РЕТІМЕН: габарит → бөлімдер → 3D →
 * деталировка → экспорт → цех.
 */
export const OURS_TOUR_STEPS: readonly TourStep[] = [
  {
    selector: '[data-tour="size"]',
    title: 'Начните с габарита',
    text: 'Высота, ширина и глубина — всё остальное считается от них. Порядок в программе всегда H × W × D.',
  },
  {
    selector: '[data-tour="sections"]',
    title: 'Наполнение — в разделах слева',
    text: 'Полки, ящики, фасады, планки. Закрытый раздел показывает своё состояние справа, так что ничего не потеряется.',
  },
  SCENE,
  CUTLIST,
  {
    selector: '[data-tour="export"]',
    title: 'Экспорт для цеха',
    text: 'XLSX и CSV — на распил, DXF — на станок, PDF — на сборку. Присадка и карта раскроя лежат на странице «Раскрой».',
  },
  {
    selector: '[data-tour="shop"]',
    title: 'Профиль цеха — ваши правила',
    text: 'Материалы, кромки, цены, зазоры и присадка берутся отсюда. Пока цены пустые, коммерческое предложение не выпускается.',
  },
]

/** Phone properties and cut list live behind persistent controls above the 3D scene. */
export const MOBILE_TOUR_STEPS: readonly TourStep[] = OURS_TOUR_STEPS.map((step, index) =>
  index === 0 ? { ...step, selector: '[data-tour-mobile="size"]' }
    : index === 1 ? { ...step, selector: '[data-tour-mobile="sections"]' }
      : index === 3 ? { ...step, selector: '[data-tour-mobile="cutlist"]' } : step)

/** Классикалық (PRO100) жұмыс үстелі: мәзір → құралдар → 3D → көріністер → деталировка → күй жолағы. */
export const CLASSIC_TOUR_STEPS: readonly TourStep[] = [
  {
    selector: '[data-tour="menubar"]',
    title: 'Главное меню',
    text: 'Файл: сохранить, открыть и экспорт для цеха. Вид: камера, тема и качество 3D. Сервис: язык, цена и аккаунт.',
  },
  {
    selector: '[data-testid="classic-toolbar"]',
    title: 'Панели инструментов',
    text: 'Новый корпус, отмена, режимы отображения и окно «Структура». Название кнопки видно при наведении.',
  },
  SCENE,
  {
    selector: '[data-tour="viewtabs"]',
    title: 'Виды под сценой',
    text: 'Перспектива, аксонометрия, план и четыре стены — одним нажатием.',
  },
  CUTLIST,
  {
    selector: '[data-testid="p100-status"]',
    title: 'Строка состояния',
    text: 'Выбранный элемент, его положение и размеры H × W × D. Двойной щелчок по детали открывает «Свойства».',
  },
]

export function tourStepsFor(classic: boolean, mobile = false): readonly TourStep[] {
  return mobile ? MOBILE_TOUR_STEPS : classic ? CLASSIC_TOUR_STEPS : OURS_TOUR_STEPS
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** Элемент көрінеді: ауданы бар және экранмен қиылысады (`display:none` → 0×0). */
export function isRectVisible(rect: Rect, viewport: { width: number; height: number }): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false
  return rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height
}

export function visibleTourSteps(steps: readonly TourStep[], isVisible: (selector: string) => boolean): TourStep[] {
  return steps.filter((step) => isVisible(step.selector))
}
