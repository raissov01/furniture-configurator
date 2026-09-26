import { currentAccount } from '@/lib/server/session'
import { recentObservability } from '@/lib/server/observability'

export default async function ObservabilityPage() {
  const account = await currentAccount()
  if (!account || account.role !== 'owner') return <main>Рұқсат жоқ</main>
  const data = recentObservability(account.shopId)
  return <main className="mx-auto max-w-5xl p-6">
    <h1 className="text-2xl font-semibold">Бақылау журналы</h1>
    <h2 className="mt-6 text-lg">Өзгерістер</h2>
    <table className="w-full text-left text-sm"><thead><tr><th>Уақыт</th><th>Әрекет</th><th>Нысан</th><th>Кім</th></tr></thead>
      <tbody>{data.audit.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('kk-KZ')}</td><td>{row.action}</td><td>{row.entity_type} {row.entity_id}</td><td>{row.actor_id ?? 'жүйе'}</td></tr>)}</tbody>
    </table>
    {data.metrics.length > 0 && <><h2 className="mt-6 text-lg">API сұраныстары</h2>
      <table className="w-full text-left text-sm"><thead><tr><th>Уақыт</th><th>Маршрут</th><th>Күй</th><th>Мс</th></tr></thead>
        <tbody>{data.metrics.map((row, index) => <tr key={index}><td>{new Date(row.created_at).toLocaleString('kk-KZ')}</td><td>{row.method} {row.route}</td><td>{row.status}</td><td>{row.latency_ms}</td></tr>)}</tbody>
      </table></>}
    {data.errors.length > 0 && <><h2 className="mt-6 text-lg">Қателер</h2>
      <table className="w-full text-left text-sm"><thead><tr><th>Уақыт</th><th>Маршрут</th><th>Хабар</th></tr></thead>
        <tbody>{data.errors.map((row, index) => <tr key={index}><td>{new Date(row.created_at).toLocaleString('kk-KZ')}</td><td>{row.route}</td><td>{row.message}</td></tr>)}</tbody>
      </table></>}
  </main>
}
