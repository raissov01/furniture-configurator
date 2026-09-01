import { CutPage } from '@/components/CutPage'

export const metadata = {
  title: 'Раскрой — карта, КИМ, резы',
  description: 'Отдельный экран раскроя: настройки пропила и обрезки, КИМ по листу, число и длина резов, бирки для цеха',
}

export default function Page() {
  return <CutPage />
}
