/**
 * Лендинг. Бет «сызба парағы» болып оқылады: бөлімдерді өлшем сызығы бөледі,
 * сандар мен белгілер моноқаріппен жүреді.
 *
 * Беттегі сурет, кесте және баға ҚОЛМЕН ЖАЗЫЛМАҒАН — олар конфигураторда
 * істейтін ядроның нақты нәтижесі (`lib/demo.ts`). Сондықтан лендинг өнім
 * істей алмайтын нәрсені уәде ете алмайды.
 */

import { formatTenge } from '@/src/core/index'
import { demoNesting, demoPrice, demoRows, demoSheet } from '@/lib/demo'
import { SITE, TARIFFS } from '@/lib/site'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SheetFigure } from '@/components/site/SheetFigure'
import { Cta, Dimension, Eyebrow, H2, Section, Titled } from '@/components/site/parts'

const STEPS = [
  {
    title: 'Опишите задачу или возьмите шаблон',
    text: 'Пишете словами: «прихожая 1800, шкаф под верхнюю одежду». Получаете три готовых варианта корпуса. Или берёте шаблон из библиотеки и меняете размеры.',
  },
  {
    title: 'Правите корпус',
    text: 'Секции, полки, фасады, задняя стенка внакладку или в паз. Модель и деталировка пересчитываются на каждое изменение.',
  },
  {
    title: 'Ставите корпуса в комнату',
    text: 'Задаёте стены, выбираете, на какой стене что стоит. Пересечения и корпуса, которые не влезли, подсвечиваются сразу.',
  },
  {
    title: 'Забираете раскрой и смету',
    text: 'Карта раскроя на печать, DXF по листу на станок, коммерческое предложение клиенту. Всё по одной кнопке.',
  },
]

const RULES = [
  ['Пропил', '4 мм', 'между каждой деталью на листе'],
  ['Подрезка листа', '10 мм', 'с каждой стороны — кромка листа в дело не идёт'],
  ['Кромка 0.4 мм', 'не вычитается', 'станок не держит эту точность, клей съедает разницу'],
  ['Система присадки', '32 мм', 'первое отверстие полкодержателя — ваше значение'],
  ['Зазор фасадов', 'ваш', 'по умолчанию 3 мм, меняется в профиле'],
  ['Предел прогиба полки', 'пусто', 'мы не знаем ваш материал — пока не заполните, предупреждения нет'],
]

const FAQ = [
  {
    q: 'Мои цены и материалы будут у вас?',
    a: 'Они в вашем профиле, и цех заполняет их сам. В коде нет ни одной цены и ни одного зазора: пока цены не заданы, коммерческое предложение вообще не выпускается — выдуманная цена уходит клиенту.',
  },
  {
    q: 'Файл можно отдать на станок?',
    a: 'Да. По одному DXF на лист раскроя: контур листа, область после подрезки, детали и деловой отход лежат на отдельных слоях. Плюс DXF на каждую деталь с присадкой по диаметрам.',
  },
  {
    q: 'У нас свои зазоры и своя присадка.',
    a: 'Так и должно быть. Зазор полки, отступ от фронта, зазор фасадов, глубина паза, датум полкодержателя — всё в разделе «Правила цеха». Деталировка пересчитается под них.',
  },
  {
    q: 'Нужен ли интернет?',
    a: 'Корпус, раскрой и смета считаются прямо в браузере. Сеть нужна только чат-боту, который предлагает варианты по описанию.',
  },
]

export default function Page() {
  const ldsp = demoNesting.byMaterial[0]!

  return (
    <div className="site min-h-full">
      <SiteHeader />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <Section className="pb-4 pt-12 sm:pt-20">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="rise">
              <Eyebrow>Для мебельных цехов · ЛДСП</Eyebrow>
              <h1
                className="text-[2.6rem] leading-[0.98] sm:text-6xl lg:text-[4.2rem]"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.015em' }}
              >
                Корпус, раскрой и цена — из одной модели
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Задаёте габарит — получаете деталировку с колонками «готовый» и «рез»,
                карту раскроя на печать и коммерческое предложение. На ваших материалах,
                по вашим ценам и вашим правилам сборки.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Cta href="/configurator">Открыть конфигуратор</Cta>
                <Cta href="#artifacts" tone="ghost">Посмотреть, что забирает цех</Cta>
              </div>
              <p className="mt-4 text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}>
                Без установки. Считает в браузере.
              </p>
            </div>

            <div className="rise" style={{ animationDelay: '90ms' }}>
              <SheetFigure
                sheet={demoSheet.sheet}
                materialName={demoSheet.materialName}
                waste={demoSheet.waste}
              />
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Это не иллюстрация. Лист собран тем же движком, что работает в конфигураторе:
                гильотинный раскрой, пропил 4 мм, текстура не поворачивается.
              </p>
            </div>
          </div>
        </Section>

        <Section><Dimension label="Лист" value={`${demoSheet.sheet.sheetWidth} × ${demoSheet.sheet.sheetHeight} мм`} /></Section>

        {/* ── Артефакты ────────────────────────────────────────────────────── */}
        <Section id="artifacts" className="py-8 sm:py-14">
          <Eyebrow>01 — на выходе</Eyebrow>
          <H2>Три документа, которые цех правда отдаёт</H2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Не «3D-визуализация», а бумаги, по которым режут, сверлят и выставляют счёт.
            Ниже — настоящий вывод по шкафу из {demoRows.reduce((s, r) => s + r.qty, 0)} деталей.
          </p>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
            <figure className="sheet overflow-hidden">
              <figcaption
                className="border-b px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
                style={{ borderColor: 'var(--rule)', fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
              >
                Деталировка
              </figcaption>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ color: 'var(--ink-soft)' }}>
                      <th className="px-4 py-2 text-left font-normal">Наименование</th>
                      <th className="px-2 py-2 text-right font-normal">Кол-во</th>
                      <th className="px-2 py-2 text-right font-normal" colSpan={2}>Готовый · клиент</th>
                      <th className="px-2 py-2 text-right font-normal" colSpan={2}>Рез · цех</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoRows.map((r) => (
                      <tr key={`${r.name}-${r.finishedLength}-${r.finishedWidth}`} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                        <td className="px-4 py-1.5" style={{ fontFamily: 'var(--font-body)' }}>{r.name}</td>
                        <td className="px-2 py-1.5 text-right">{r.qty}</td>
                        <td className="px-2 py-1.5 text-right" style={{ color: 'var(--blueprint)' }}>{r.finishedLength}</td>
                        <td className="px-2 py-1.5 text-right" style={{ color: 'var(--blueprint)' }}>{r.finishedWidth}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{r.cutLength}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{r.cutWidth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t px-4 py-2 text-[11px]" style={{ borderColor: 'var(--rule)', color: 'var(--ink-soft)' }}>
                Клиент видит готовый размер, цех — рез. Разницу даёт кромка, и она посчитана,
                а не «примерно».
              </p>
            </figure>

            <div className="grid gap-6">
              <figure className="sheet p-4">
                <figcaption
                  className="mb-3 text-[11px] uppercase tracking-[0.18em]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
                >
                  Смета
                </figcaption>
                <dl className="space-y-1.5 text-sm">
                  {[
                    ['Материалы', demoPrice.materials.reduce((s, l) => s + l.cost, 0)],
                    ['Кромка', demoPrice.edges.reduce((s, l) => s + l.cost, 0)],
                    ['Фурнитура', demoPrice.hardware.reduce((s, l) => s + l.cost, 0)],
                    ['Работа', demoPrice.labour.reduce((s, l) => s + l.cost, 0)],
                  ].map(([label, cost]) => (
                    <div key={String(label)} className="flex items-baseline justify-between gap-4">
                      <dt style={{ color: 'var(--ink-soft)' }}>{label}</dt>
                      <dd style={{ fontFamily: 'var(--font-mono)' }}>{formatTenge(Number(cost))}</dd>
                    </div>
                  ))}
                  <div
                    className="flex items-baseline justify-between gap-4 border-t pt-2 text-base"
                    style={{ borderColor: 'var(--rule)', fontFamily: 'var(--font-display)', fontWeight: 700 }}
                  >
                    <dt>Итого клиенту</dt>
                    <dd>{formatTenge(demoPrice.total)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  Цены здесь — пример. Материал считается по числу листов, а не по площади:
                  цех покупает целый лист, а остаток оплачивает сам.
                </p>
              </figure>

              <figure className="sheet p-4">
                <figcaption
                  className="mb-3 text-[11px] uppercase tracking-[0.18em]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
                >
                  Файлы на станок
                </figcaption>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  <li><b style={{ color: 'var(--ink)' }}>PDF карты раскроя</b> — по листу на страницу, с подписями деталей.</li>
                  <li><b style={{ color: 'var(--ink)' }}>DXF по листу</b> — лист, область реза, детали и отход на разных слоях.</li>
                  <li><b style={{ color: 'var(--ink)' }}>DXF по детали</b> — присадка отдельным слоем на каждый диаметр.</li>
                  <li><b style={{ color: 'var(--ink)' }}>XLSX и CSV</b> — деталировка в вашей таблице.</li>
                </ul>
              </figure>
            </div>
          </div>
        </Section>

        <Section><Dimension label="Пропил" value="4 мм" /></Section>

        {/* ── Как это работает ─────────────────────────────────────────────── */}
        <Section id="how" className="py-8 sm:py-14">
          <Eyebrow>02 — порядок работы</Eyebrow>
          <H2>Четыре шага от разговора до реза</H2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Titled key={s.title} mark={`Шаг ${i + 1}`} title={s.title}>
                {s.text}
              </Titled>
            ))}
          </div>
        </Section>

        <Section><Dimension label="Кромка" value="2.0 / 0.4 мм" /></Section>

        {/* ── Правила цеха ─────────────────────────────────────────────────── */}
        <Section id="rules" className="py-8 sm:py-14">
          <Eyebrow>03 — почему это не «ещё один конструктор»</Eyebrow>
          <H2>Мы не выдумываем ваши числа</H2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Каждый цех собирает по-своему. Если зашить одно значение в код, у остальных
            тихо получится мебель, которая не собирается. Поэтому все константы —
            в профиле цеха, а не в программе.
          </p>

          <div className="sheet mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {RULES.map(([name, value, note]) => (
                  <tr key={name} className="border-b last:border-b-0" style={{ borderColor: 'var(--rule)' }}>
                    <td className="w-52 px-4 py-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{name}</td>
                    <td className="w-40 px-4 py-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blueprint)' }}>{value}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-soft)' }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section><Dimension label="Раскрой" value={`${demoNesting.sheetCount} листа · отход ${ldsp.wastePercent.toFixed(1)}%`} /></Section>

        {/* ── Тарифы ───────────────────────────────────────────────────────── */}
        <Section id="pricing" className="py-8 sm:py-14">
          <Eyebrow>04 — подписка</Eyebrow>
          <H2>Тарифы</H2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {TARIFFS.map((t) => (
              <div
                key={t.id}
                className="sheet flex flex-col p-5"
                style={t.highlighted ? { borderColor: 'var(--ink)', borderWidth: 2 } : undefined}
              >
                <p className="text-xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{t.name}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}>
                  {t.note}
                </p>
                <p className="mt-4 text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{t.price}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span style={{ color: 'var(--oak-deep)' }}>—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <Cta href="/configurator" tone={t.highlighted ? 'solid' : 'ghost'}>Попробовать</Cta>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <Section className="py-8 sm:py-14">
          <Eyebrow>05 — вопросы</Eyebrow>
          <H2>Что обычно спрашивают</H2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="mb-1.5 text-base" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {item.q}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Финальный призыв ─────────────────────────────────────────────── */}
        <Section className="pb-16 pt-6">
          <div className="sheet flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl sm:text-3xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Соберите свой шкаф прямо сейчас
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
                Регистрация не нужна. Профиль цеха можно заполнить позже.
              </p>
            </div>
            <Cta href="/configurator">Открыть {SITE.name}</Cta>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </div>
  )
}
