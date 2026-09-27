import { BRAND } from '@/src/core/brand'

/** Browser тілін сервердегі орысша metadata-дан кейін қолданатын беттер. */
export function routeMetadata(pathname: string, translate: (key: string) => string):
  { title: string; description: string } | null {
  if (pathname === '/') return {
    title: `${BRAND.name} — ${translate('Платформа для мебельных цехов')}`,
    description: translate('Платформа для мебельных цехов Казахстана: корпус, раскрой, присадка и КП.'),
  }
  if (pathname === '/cut') return {
    title: `${translate('Раскрой — карта, КИМ, резы')} · ${BRAND.name}`,
    description: translate('Отдельный экран раскроя: настройки пропила и обрезки, КИМ по листу, число и длина резов, бирки для цеха'),
  }
  return null
}
