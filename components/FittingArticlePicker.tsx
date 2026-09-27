'use client'

import { t as tr } from '@/lib/i18n'
import { FITTINGS_CATALOG } from '@/src/core/data/fittings'
import type { FittingProduct } from '@/src/core/data/fittings'
import type { HingeSystem } from '@/src/core/fittings'

/** Жауап планкасының бұл төрт координатасы жоқ болса core CNC генерациясын тоқтатады. */
export function fittingArticleIssue(product: FittingProduct): string | null {
  const plate = product.drilling.find((row) => row.operation === 'plateFixingReference')
  if (!plate) return 'plateFixingReference'
  if (plate.diameterMm === null) return 'plateFixingReference.diameterMm'
  if (typeof plate.depthMm !== 'number') return 'plateFixingReference.depthMm'
  if (plate.pitchMm === null) return 'plateFixingReference.pitchMm'
  if (plate.edgeDistanceMm?.fromCabinetFrontEdge === undefined) return 'plateFixingReference.fromCabinetFrontEdge'
  return null
}

export function FittingArticlePicker({ system, onChange }: { system: HingeSystem; onChange: (id: string | undefined) => void }) {
  const products = FITTINGS_CATALOG.products.filter((product) => product.kind === 'hinge' && product.brand.toLowerCase() === system.brand)
  const sources = new Map(FITTINGS_CATALOG.sources.map((source) => [source.id, source]))
  const selected = products.find((product) => product.id === system.fittingProductId)
  const selectedIssue = selected ? fittingArticleIssue(selected) : null
  return <div className="space-y-1 text-xs">
    <label className="block">{tr('Артикул производителя')}
      <select aria-label={`${system.name}: ${tr('Артикул производителя')}`} value={system.fittingProductId ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="mt-1 w-full min-w-32 border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
        <option value="">{tr('Без артикула')}</option>
        {products.map((product) => <option key={product.id} value={product.id}>
          {product.family} {product.variant} · {product.articleExamples.join(', ')}
        </option>)}
      </select>
    </label>
    {selectedIssue && <p role="alert" className="text-amber-700 dark:text-amber-300">
      {tr('Экспорт ЧПУ заблокируется для этого артикула')}: {selectedIssue}
    </p>}
    {products.map((product) => {
      const source = sources.get(product.sourceIds[0]!)
      const issue = fittingArticleIssue(product)
      return <p key={product.id} className="text-neutral-500 dark:text-neutral-400">
        {product.articleExamples.join(', ')}: {issue ? <span className="text-amber-700 dark:text-amber-300">
          {tr('Недостаточно данных для присадки')}: {issue}. </span> : tr('Схема планки заполнена')}{' '}
        {source && <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{tr('Официальный чертёж')}</a>}
      </p>
    })}
  </div>
}
