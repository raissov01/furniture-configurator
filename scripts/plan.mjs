/**
 * Тарифті ҚОЛМЕН қою: `npm run plan -- <email> <free|shop|team> [күн]`
 *
 * Неге скрипт. Төлем жүйесі әлі жоқ, ал тарифті бүгін-ақ беру керек: цех
 * ақшасын Kaspi-мен аударады да, иесі осы команданы жүргізеді. Төлем
 * қосылғанда ол дәл осы `setPlan`-ды шақырады — бұл файл сол кезде де
 * қолмен түзетуге керек болады (қайтарым, сыйға беру, тест).
 *
 * ⚠ Скрипт ДЕРЕКҚОРҒА тікелей жазады, сондықтан оны СЕРВЕРДЕ, `DATA_DIR`
 * дұрыс тұрғанда жүргізу керек.
 */
import { register as _register } from 'node:module'
import { argv, env, exit } from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

const [email, plan, days] = argv.slice(2)
const PLANS = ['free', 'shop', 'team']

if (!email || !PLANS.includes(plan)) {
  console.error('Қолданылуы: npm run plan -- <email> <free|shop|team> [күн]')
  console.error('Мысал:      npm run plan -- shop@example.kz shop 30')
  exit(1)
}

const file = env.DATA_DIR ? join(env.DATA_DIR, 'furniture.db') : join(process.cwd(), '.data', 'furniture.db')
const db = new DatabaseSync(file)

const row = db
  .prepare('SELECT u.shop_id AS shopId, s.name AS shopName FROM users u JOIN shops s ON s.id = u.shop_id WHERE u.email = ?')
  .get(email.trim().toLowerCase())

if (!row) {
  console.error(`Мұндай пошта тіркелмеген: ${email}`)
  exit(2)
}

// Мерзім берілмесе — мерзімсіз. Тегін жоспарда мерзімнің мағынасы жоқ.
const until = days && plan !== 'free' ? Date.now() + Number(days) * 86_400_000 : null
if (days && !Number.isFinite(Number(days))) {
  console.error(`Күн саны сан емес: ${days}`)
  exit(1)
}

db.prepare('UPDATE shops SET plan = ?, plan_until = ? WHERE id = ?').run(plan, until, row.shopId)

const when = until ? new Date(until).toISOString().slice(0, 10) : 'мерзімсіз'
console.log(`✓ ${row.shopName} (${email}) → «${plan}», ${when}`)
