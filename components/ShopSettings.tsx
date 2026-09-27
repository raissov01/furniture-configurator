'use client'

/**
 * Цех профилі: материалдар, бағалар, зазорлар, фурнитура (SaaS негізі).
 *
 * Мұнда бір де бір «біздің цехта былай» деген сан кодта тұрмайды — бәрі осы
 * экраннан келеді. Жаңа цех тіркелгенде істейтіні: бағаларын енгізу.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import {
  DECOR_BRANDS,
  DECOR_LIBRARY,
  DEFAULT_SETTINGS,
  HANDLE_BORE_DIAMETER,
  HANDLE_BORE_SPACINGS,
  SERVICE_BASIS_NAMES,
  SERVICE_IDS,
  SERVICE_NAMES,
  SHEET_FORMATS,
  SHEET_THICKNESSES,
  makeMaterial,
  searchDecors,
  shopReadiness,
} from '@/src/core/index'
import type {
  ConstructionSettings, DimensionLimits, HandleModel, ServiceBasis, ShopProfile,
} from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { Button, Field, NumberInput, SectionTitle, Select, Toggle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { availableVerifiedHinges } from '@/lib/frontEdit'
import { materialUsedInTree } from '@/lib/materialUsedInTree'
import { ruleInputPolicy } from '@/lib/shopRuleInput'
import { ShopDrillingSettings } from './ShopDrillingSettings'
import { MarketPriceNotice, MarketPriceTag } from './MarketPrice'

type NumberSettingKey = { [K in keyof ConstructionSettings]: ConstructionSettings[K] extends number | null ? K : never }[keyof ConstructionSettings]

type Tab = 'profile' | 'materials' | 'bands' | 'hardware' | 'hinges' | 'rules' | 'drilling'

const TABS: { value: Tab; label: string }[] = [
  { value: 'profile', label: tr('Цех') },
  { value: 'materials', label: tr('Материалы') },
  { value: 'bands', label: tr('Кромки') },
  { value: 'hardware', label: tr('Фурнитура') },
  { value: 'hinges', label: tr('Петли') },
  { value: 'rules', label: tr('Правила цеха') },
  { value: 'drilling', label: tr('Присадка') },
]

/** Баға ішінде ТИЫНМЕН сақталады, экранда теңгемен көрсетіледі. */
const toTenge = (minor: number) => Math.round(minor / 100)
const toMinor = (tenge: number) => Math.round(tenge) * 100

const text =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ' +
  'focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300'

/**
 * Габарит шектерінің өрістері. Реті — жобаның H × W × D ережесімен бірдей,
 * ал әр жолда «ең кіші — ең үлкен» қатар тұрады.
 */
const LIMIT_FIELDS: { key: keyof DimensionLimits; label: string }[] = [
  { key: 'minHeight', label: 'Высота от, мм' },
  { key: 'minWidth', label: 'Ширина от, мм' },
  { key: 'minDepth', label: 'Глубина от, мм' },
  { key: 'maxHeight', label: 'Высота до, мм' },
  { key: 'maxWidth', label: 'Ширина до, мм' },
  { key: 'maxDepth', label: 'Глубина до, мм' },
]

export function ShopSettings() {
  const open = useConfigurator((s) => s.shopOpen)
  const setOpen = useConfigurator((s) => s.setShopOpen)
  const shop = useConfigurator((s) => s.shop)
  const editShop = useConfigurator((s) => s.editShop)
  const [tab, setTab] = useState<Tab>('profile')
  const verifiedHinges = availableVerifiedHinges(shop.hingeSystems)

  const readiness = useMemo(() => shopReadiness(shop), [shop])

  if (!open) return null

  const setPriceSheet = (id: string, tenge: number) =>
    editShop({ materials: shop.materials.map((m) => (m.id === id ? { ...m, pricePerSheet: toMinor(tenge) } : m)) })
  // Тақта (постформинг) метрмен сатылады — оның бағасы парақтың емес, метрдің.
  const setPriceMeter = (id: string, tenge: number) =>
    editShop({
      materials: shop.materials.map((m) => (m.id === id && m.slab
        ? { ...m, slab: { ...m.slab, pricePerMeter: toMinor(tenge) } }
        : m)),
    })
  const setSheet = (id: string, patch: { sheetWidth?: number; sheetHeight?: number }) =>
    editShop({ materials: shop.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const setBandPrice = (id: string, tenge: number) =>
    editShop({ edgeBands: shop.edgeBands.map((b) => (b.id === id ? { ...b, pricePerMeter: toMinor(tenge) } : b)) })
  const setHardwarePrice = (id: string, tenge: number) =>
    editShop({ hardware: shop.hardware.map((h) => (h.id === id ? { ...h, pricePerUnit: toMinor(tenge) } : h)) })
  const setHingeK = (id: string, cupFromEdge: number) =>
    editShop({ hingeSystems: shop.hingeSystems.map((h) => (h.id === id ? { ...h, cupFromEdge } : h)) })
  const setHingeEnd = (id: string, endOffset: number) =>
    editShop({ hingeSystems: shop.hingeSystems.map((h) => (h.id === id ? { ...h, endOffset } : h)) })
  /*
   * ТҰТҚА КАТАЛОГЫ — цехтың өзінікі.
   *
   * Артикул да, баға да жеткізушіден келеді әрі әр цехта басқаша, сондықтан
   * кодта тек ТҮРЛЕРІ тұр, ал нақты тізімді цех осында толықтырады. Жойылған
   * тұтқа жобада қалып қоюы мүмкін — сол себепті соңғы модельді жоюға
   * болмайды әрі фасад тұтқасыз қалмайды.
   */
  const addHandle = (name: string, kind: HandleModel['kind']) => {
    const id = `handle-shop-${Date.now().toString(36)}`
    const model: HandleModel = {
      id,
      name: name.trim(),
      kind,
      boreSpacings: kind === 'knob' || kind === 'profile' || kind === 'none'
        ? []
        : [...HANDLE_BORE_SPACINGS],
      boreDiameter: kind === 'profile' || kind === 'none' ? 0 : HANDLE_BORE_DIAMETER,
      hardwareId: id,
    }
    editShop({
      handles: [...shop.handles, model],
      // Сметаның жолы да бірге пайда болады, әйтпесе жаңа тұтқа ақшаға
      // кірмей қалар еді.
      hardware: [...shop.hardware, { id, kind: 'handle', name: model.name, pricePerUnit: 0 }],
    })
  }
  const renameHandle = (id: string, name: string) =>
    editShop({
      handles: shop.handles.map((h) => (h.id === id ? { ...h, name } : h)),
      hardware: shop.hardware.map((h) => (h.id === id ? { ...h, name } : h)),
    })
  const removeHandle = (id: string) => {
    if (shop.handles.length <= 1) return
    editShop({ handles: shop.handles.filter((h) => h.id !== id) })
  }

  const setRule = (key: NumberSettingKey, value: number) =>
    editShop({
      settings: {
        ...shop.settings,
        // «3-ші конфирмат» ережесінде 0 = ӨШІРУЛІ (`null`). Қалған
        // константаларда 0 — жай ғана нөл.
        [key]: key === 'confirmatSpanForThird' && value === 0 ? null : value,
      },
    })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">{tr('Настройки цеха')}</h2>
          {TABS.map((t) => (
            <Button key={t.value} active={tab === t.value} onClick={() => setTab(t.value)}>{t.label}</Button>
          ))}
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {!readiness.pricingReady ? (
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Пока не заданы цены, коммерческое предложение не выпускается: выдуманная цена уходит клиенту.
            Достаточно заполнить те материалы, с которыми вы реально работаете.
          </p>
        ) : null}

        <div className="mb-3">
          <MarketPriceNotice shop={shop} editShop={editShop} />
        </div>

        {tab === 'profile' ? (
          <div className="space-y-3">
            <SectionTitle>{tr('Реквизиты — попадут в КП')}</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={tr('Название цеха')}>
                <input className={text} value={shop.name} placeholder={tr('Цех «Алаш»')}
                  onChange={(e) => editShop({ name: e.target.value })} />
              </Field>
              <Field label={tr('Город')}>
                <input className={text} value={shop.city} placeholder={tr('Астана')}
                  onChange={(e) => editShop({ city: e.target.value })} />
              </Field>
              <Field label={tr('Телефон')}>
                <input className={text} value={shop.phone} placeholder="+7 ___ ___ __ __"
                  onChange={(e) => editShop({ phone: e.target.value })} />
              </Field>
            </div>
            <p className="text-[11px] text-neutral-400">
              Профиль хранится в этом браузере. Когда появятся аккаунты, он переедет на сервер как есть.
            </p>
            <PriceListManager shop={shop} />
          </div>
        ) : null}

        {tab === 'materials' ? (
          <div className="space-y-3">
            <AddMaterial />
            <PriceTable
            head={['Материал', 'Толщина', 'Лист, мм', 'Цена листа, ₸', '']}
            rows={shop.materials.map((m) => ({
              id: m.id,
              name: m.name,
              cells: m.slab
                ? [
                  // ТАҚТА (постформинг): парағы жоқ — ұзындықтары мен МЕТРДІҢ бағасы.
                  <span key="t" className="tabular-nums text-neutral-500">{m.thickness}</span>,
                  <span key="s" className="text-[11px] tabular-nums text-neutral-500">
                    Плита: {m.slab.stockLengths.join(' / ')} мм
                  </span>,
                  <span key="p" className="flex items-center gap-1">
                    <NumberInput value={toTenge(m.slab.pricePerMeter)} min={0} step={100}
                      invalid={m.slab.pricePerMeter <= 0}
                      onChange={(v) => setPriceMeter(m.id, v)} />
                    <span className="text-[11px] text-neutral-500">/м</span>
                  </span>,
                  <MaterialActions key="x" id={m.id} />,
                ]
                : [
                  <span key="t" className="tabular-nums text-neutral-500">{m.thickness}</span>,
                  <span key="s" className="flex items-center gap-1">
                    <NumberInput value={m.sheetWidth} min={500} step={10}
                      onChange={(sheetWidth) => setSheet(m.id, { sheetWidth })} />
                    <NumberInput value={m.sheetHeight} min={500} step={10}
                      onChange={(sheetHeight) => setSheet(m.id, { sheetHeight })} />
                  </span>,
                  <span key="p" className="flex items-center gap-1">
                    <NumberInput value={toTenge(m.pricePerSheet)} min={0} step={100}
                      invalid={m.pricePerSheet <= 0}
                      onChange={(v) => setPriceSheet(m.id, v)} />
                    <MarketPriceTag shop={shop} priceKey={`material:${m.id}`} editShop={editShop} />
                  </span>,
                  <MaterialActions key="x" id={m.id} />,
                ],
            }))}
            />
          </div>
        ) : null}

        {tab === 'bands' ? (
          <PriceTable
            head={['Кромка', 'Толщина', 'Цена за метр, ₸']}
            rows={shop.edgeBands.map((b) => ({
              id: b.id,
              name: b.name,
              cells: [
                <span key="t" className="tabular-nums text-neutral-500">{b.thickness}</span>,
                <span key="p" className="flex items-center gap-1">
                  <NumberInput value={toTenge(b.pricePerMeter)} min={0} step={10}
                    onChange={(v) => setBandPrice(b.id, v)} />
                  <MarketPriceTag shop={shop} priceKey={`edgeBand:${b.id}`} editShop={editShop} />
                </span>,
              ],
            }))}
          />
        ) : null}

        {tab === 'hardware' ? (
          <div className="space-y-4">
          <HandleCatalogue
            handles={shop.handles}
            onAdd={addHandle}
            onRename={renameHandle}
            onRemove={removeHandle}
          />
          <PriceTable
            head={['Позиция', 'Цена за штуку, ₸']}
            rows={shop.hardware.map((h) => ({
              id: h.id,
              name: h.name,
              cells: [
                <span key="p" className="flex items-center gap-1">
                  <NumberInput value={toTenge(h.pricePerUnit)} min={0} step={10}
                    onChange={(v) => setHardwarePrice(h.id, v)} />
                  <MarketPriceTag shop={shop} priceKey={`hardware:${h.id}`} editShop={editShop} />
                </span>,
              ],
            }))}
          />
          </div>
        ) : null}

        {tab === 'hinges' ? (
          <div className="space-y-3">
            {verifiedHinges.length > 0 ? (
              <div className="border border-neutral-300 p-2 text-xs dark:border-neutral-700">
                <p className="mb-2 font-medium">{tr('Добавить подтверждённый артикул петли')}</p>
                <div className="flex flex-wrap gap-2">
                  {verifiedHinges.map((hinge) => (
                    <Button key={hinge.id} onClick={() => editShop({ hingeSystems: [...shop.hingeSystems, hinge] })}>
                      + {hinge.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              K — расстояние от центра чашки до края фасада. Оно зависит от бренда и от
              накладки, поэтому <strong>{tr('сверьте его со своим шаблоном')}</strong>: 22 мм здесь —
              самое частое значение, а не гарантия. Присадка считается по этому числу.
            </p>
            <PriceTable
              head={['Система', 'K, мм', 'От края фасада, мм']}
              rows={shop.hingeSystems.map((h) => ({
                id: h.id,
                name: h.name,
                cells: [
                  <NumberInput key="k" value={h.cupFromEdge} min={0} max={60}
                    onChange={(v) => setHingeK(h.id, v)} />,
                  <NumberInput key="e" value={h.endOffset} min={0} max={300} step={5}
                    onChange={(v) => setHingeEnd(h.id, v)} />,
                ],
              }))}
            />
          </div>
        ) : null}

        {tab === 'drilling' ? <ShopDrillingSettings shop={shop} editShop={editShop} /> : null}

        {tab === 'rules' ? (
          <div className="space-y-3">
            <SectionTitle>{tr('Как собирает ваш цех, мм')}</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Rule label={tr('Зазор полки')} hint={tr('общий, на обе стороны')} k="shelfGap" shop={shop} onChange={setRule} />
              <Rule label={tr('Отступ полки от фронта')} k="shelfSetback" shop={shop} onChange={setRule} />
              {/* Цокольдің «вылеті»: аяқ тұратын орын. Бұрын кодта 50 мм
                  болып қатып тұрған, ал ас үйде 100 мм-ге дейін жетеді. */}
              <Rule label={tr('Отступ цоколя (вылет)')} k="plinthSetback" shop={shop} onChange={setRule} />
              <Rule label={tr('Зазор фасадов')} k="frontGap" shop={shop} onChange={setRule} />
              <Rule label={tr('Толщина задней стенки')} k="backThickness" shop={shop} onChange={setRule} />
              <Rule label={tr('Глубина паза')} k="grooveDepth" shop={shop} onChange={setRule} />
              <Rule label={tr('Отступ паза от края')} k="grooveInset" shop={shop} onChange={setRule} />
              <Rule label={tr('Кромка вычитается от')} hint={tr('0.4 обычно не вычитается')} k="minBandSubtract" shop={shop} onChange={setRule} />
              <Rule
                label={tr('3-й конфирмат при длине')}
                hint={tr('0 — не ставить')}
                k="confirmatSpanForThird"
                shop={shop}
                onChange={setRule}
              />

            </div>

            <SectionTitle>{tr('Услуги цеха')}</SectionTitle>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Каждую услугу считайте так, как считаете её у себя: один цех берёт за лист,
              другой за метр кромки, третий за отверстие. Услуга с нулевой ставкой в смету
              не попадает и не считается незаполненной.
            </p>
            <div className="max-h-[40vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-xs">
                <tbody>
                  {SERVICE_IDS.map((sid) => (
                    <tr key={sid} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                      <td className="px-2 py-1.5">{SERVICE_NAMES[sid]}</td>
                      <td className="w-44 px-2 py-1.5">
                        <Select
                          value={shop.services[sid].basis}
                          onChange={(basis) =>
                            editShop({
                              services: {
                                ...shop.services,
                                [sid]: { ...shop.services[sid], basis: basis as ServiceBasis },
                              },
                            })
                          }
                          options={(Object.keys(SERVICE_BASIS_NAMES) as ServiceBasis[]).map((b) => ({
                            value: b, label: SERVICE_BASIS_NAMES[b],
                          }))}
                        />
                      </td>
                      <td className="w-44 px-2 py-1.5">
                        <span className="flex items-center gap-1">
                        <NumberInput
                          value={toTenge(shop.services[sid].rate)}
                          min={0}
                          step={100}
                          onChange={(v) =>
                            editShop({
                              services: {
                                ...shop.services,
                                [sid]: { ...shop.services[sid], rate: toMinor(v) },
                              },
                            })
                          }
                        />
                        <MarketPriceTag shop={shop} priceKey={`service:${sid}`} editShop={editShop} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SectionTitle>{tr('Коэффициент, монтаж и наценка')}</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={tr('Коэффициент')} hint={tr('умножает материалы, услуги и фурнитуру')}>
                <NumberInput value={shop.coefficient} min={0.1} max={10} step={0.05}
                  onChange={(v) => editShop({ coefficient: v > 0 ? v : 1 })} />
              </Field>
              <Field label={tr('Монтаж, ₸ за 1 м ширины')} hint={tr('в коэффициент не входит')}>
                <NumberInput value={toTenge(shop.installation.ratePerMetreWidth)} min={0} step={500}
                  onChange={(v) => editShop({ installation: { ratePerMetreWidth: toMinor(v) } })} />
              </Field>
              <Field label={tr('Наценка, %')}>
                <NumberInput value={shop.markupPercent} min={0} max={1000} step={1}
                  onChange={(v) => editShop({ markupPercent: v })} />
              </Field>
            </div>

            <SectionTitle>{tr('Предел прогиба полки')}</SectionTitle>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={tr('Максимальный пролёт полки, мм')} hint={shop.maxShelfSpan === null ? 'выключено' : undefined}>
                <NumberInput
                  value={shop.maxShelfSpan ?? 0}
                  min={0}
                  step={10}
                  onChange={(v) => editShop({ maxShelfSpan: v > 0 ? v : null })}
                />
              </Field>
              <Button onClick={() => editShop({ maxShelfSpan: null })} disabled={shop.maxShelfSpan === null}>
                Выключить
              </Button>
            </div>
            <p className="max-w-2xl text-[11px] leading-snug text-neutral-400">
              Значения по умолчанию здесь нет намеренно. Предел зависит от материала, толщины и того,
              что кладут на полку — один цех ставит 800 мм, другой 900. Пока поле пустое, предупреждение
              не показывается вовсе.
            </p>

            <SectionTitle>{tr('Пределы габарита')}</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              {LIMIT_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={tr(f.label)}
                  hint={shop.limits[f.key] === null ? tr('нет') : undefined}
                >
                  <NumberInput
                    value={shop.limits[f.key] ?? 0}
                    min={0}
                    step={10}
                    onChange={(v) =>
                      // 0 = шек ЖОҚ. Бөлек «өшіру» түймесі алты өріске алты
                      // түйме болып, панельді ретсіз қылар еді.
                      editShop({ limits: { ...shop.limits, [f.key]: v > 0 ? v : null } })
                    }
                  />
                </Field>
              ))}
            </div>
            <p className="max-w-2xl text-[11px] leading-snug text-neutral-400">
              0 — предела нет. Это предупреждение, а не запрет: габарит всё равно можно ввести,
              цех вправе сделать корпус крупнее и собрать его из двух. Умолчаний здесь тоже нет —
              предел задаёт станок, лист и машина, которой везут заказ.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Бір каталогқа байланған атаулы бағалар; геометрия мен қызмет basis-і ортақ. */
function PriceListManager({ shop }: { shop: ShopProfile }) {
  const createPriceList = useConfigurator((s) => s.createPriceList)
  const selectPriceList = useConfigurator((s) => s.selectPriceList)
  const renamePriceList = useConfigurator((s) => s.renamePriceList)
  const deletePriceList = useConfigurator((s) => s.deletePriceList)
  const active = shop.priceLists.find((list) => list.id === shop.activePriceListId)!
  const [nameDraft, setNameDraft] = useState(active.name)

  useEffect(() => setNameDraft(active.name), [active.id, active.name])

  return (
    <div className="space-y-2">
      <SectionTitle>{tr('Прайс-листы')}</SectionTitle>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        Материалы, размеры и правила цеха общие для всех прайсов. В новом прайсе цены равны нулю;
        материал, добавленный позже, в старом прайсе тоже получает нулевую цену.
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <Select
          value={shop.activePriceListId}
          onChange={selectPriceList}
          options={shop.priceLists.map((list) => ({ value: list.id, label: list.name }))}
        />
        <input
          className={text}
          value={nameDraft}
          aria-label={tr('Название прайса')}
          onChange={(event) => setNameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && nameDraft.trim()) renamePriceList(active.id, nameDraft)
          }}
        />
        <Button disabled={!nameDraft.trim() || nameDraft.trim() === active.name}
          onClick={() => renamePriceList(active.id, nameDraft)}>{tr('Переименовать')}</Button>
        <Button disabled={shop.priceLists.length <= 1}
          onClick={() => {
            if (window.confirm(tr('Удалить этот прайс?'))) deletePriceList(active.id)
          }}>{tr('Удалить')}</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button onClick={() => createPriceList(`Прайс ${shop.priceLists.length + 1}`, 'blank')}>
          {tr('+ Новый прайс')}
        </Button>
        <Button onClick={() => createPriceList(`${active.name} (копия)`, 'copy')}>
          {tr('Копировать текущий')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Цехтың өз материалын қосу.
 *
 * Декор кітапханасын біз жаза алмаймыз: коды мен реңкі жеткізушіден келеді,
 * әр цехта басқаша. Сондықтан бос жол береміз де, цех өзінікін қосады.
 */
/**
 * Тұтқалардың каталогы: цех өз артикулын осында қосады.
 *
 * ТҮРІ ӨЗГЕРТІЛМЕЙДІ — ол присадканың негізі (қанша тесік, қай аралықта).
 * Түрі қате қойылса, оны түзетуден гөрі жаңасын қосып, ескісін жойған
 * қауіпсіз: сол кезде бұрын жасалған жобадағы присадка үнсіз өзгермейді.
 */
function HandleCatalogue({
  handles, onAdd, onRename, onRemove,
}: {
  handles: HandleModel[]
  onAdd: (name: string, kind: HandleModel['kind']) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<HandleModel['kind']>('bar')

  return (
    <div className="space-y-2">
      <SectionTitle>{tr('Ручки')} ({handles.length})</SectionTitle>
      <p className="max-w-2xl text-[11px] leading-snug text-neutral-400">
        Артикулы и цены у каждого цеха свои, поэтому в программе лежат только виды.
        Добавьте свои позиции — они попадут и в выбор фасада, и в смету.
      </p>
      <ul className="space-y-1">
        {handles.map((h) => (
          <li key={h.id} className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={h.name}
              onChange={(e) => onRename(h.id, e.target.value)}
            />
            <span className="w-28 shrink-0 text-[11px] text-neutral-400">{HANDLE_KIND_NAME[h.kind]}</span>
            <Button onClick={() => onRemove(h.id)} disabled={handles.length <= 1}>✕</Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          placeholder={tr('Ручка-скоба Boyard RS-101, 128 мм')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="w-40 shrink-0">
          <Select
            value={kind}
            onChange={setKind}
            options={(Object.keys(HANDLE_KIND_NAME) as HandleModel['kind'][])
              .map((k) => ({ value: k, label: HANDLE_KIND_NAME[k] }))}
          />
        </div>
        <Button
          active
          disabled={name.trim().length < 2}
          onClick={() => { onAdd(name, kind); setName('') }}
        >
          {tr('Добавить')}
        </Button>
      </div>
    </div>
  )
}

/** Кітапханадағы түрдің атауы — жаңа материалдың атына қосылады. */
const DECOR_KIND_NAME: Record<string, string> = {
  chipboard: 'ЛДСП',
  mdf: 'МДФ',
  hardboard: 'ХДФ',
  other: 'Плита',
}

const HANDLE_KIND_NAME: Record<HandleModel['kind'], string> = {
  bar: 'Скоба',
  rail: 'Рейлинг',
  shell: 'Ракушка',
  knob: 'Кнопка',
  profile: 'Профиль',
  none: 'Без ручки',
}

function AddMaterial() {
  const shop = useConfigurator((s) => s.shop)
  const addMaterial = useConfigurator((s) => s.addMaterial)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [draft, setDraft] = useState({
    name: '',
    thickness: 16,
    format: 0,
    color: '#c9a227',
    hasGrain: true,
  })

  const bands = shop.edgeBands
  const front = bands.find((b) => b.thickness === 2)?.id ?? null
  const secondary = bands.find((b) => b.thickness === 0.4)?.id ?? null

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-neutral-500">
          Каталог ваш: добавьте декоры, с которыми реально работаете —
          в библиотеке {DECOR_LIBRARY.length} позиций.
        </p>
        <Button onClick={() => setOpen(true)}>{tr('+ материал')}</Button>
      </div>
    )
  }

  const format = SHEET_FORMATS[draft.format]!
  const canSave = draft.name.trim().length > 0

  return (
    <div className="space-y-2 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      {/*
        ДЕКОР КІТАПХАНАСЫ (523 позиция, `src/core/decors.ts`).
        Цех өз плитасын атын қолмен теріп емес, каталогтан ТАБЫП қосады —
        артикул да, текстура да сол жерден келеді, ал қателесу мүмкіндігі азаяды.
      */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            className={text}
            value={search}
            placeholder={tr('Найти декор: egger дуб, K076, бетон…')}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="w-40 shrink-0">
            <Select
              value={brand}
              onChange={setBrand}
              options={[{ value: '', label: tr('Все бренды') },
                ...DECOR_BRANDS.map((b) => ({ value: b, label: b }))]}
            />
          </div>
        </div>
        {search.trim().length > 0 || brand ? (
          <ul className="max-h-44 space-y-0.5 overflow-auto rounded-md border border-neutral-200 p-1 dark:border-neutral-700">
            {searchDecors(search, brand || undefined, 40).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      name: `${DECOR_KIND_NAME[d.kind]} ${d.name} ${draft.thickness} мм`,
                      color: d.color,
                      hasGrain: d.hasGrain,
                    })
                    setSearch('')
                  }}
                >
                  <span
                    className="h-4 w-6 shrink-0 rounded-sm border border-black/10"
                    style={{ background: d.color }}
                  />
                  <span className="min-w-0 truncate">{d.name}</span>
                  {d.hasGrain ? <span className="ml-auto text-[10px] text-neutral-400">{tr('Текстура')}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_6rem]">
        <Field label={tr('Название')}>
          <input className={text} value={draft.name} placeholder={tr('ЛДСП Дуб Сонома 16 мм')}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label={tr('Толщина, мм')}>
          <select className={text} value={draft.thickness}
            onChange={(e) => setDraft({ ...draft, thickness: Number(e.target.value) })}>
            {SHEET_THICKNESSES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label={tr('Формат листа')}>
          <select className={text} value={draft.format}
            onChange={(e) => setDraft({ ...draft, format: Number(e.target.value) })}>
            {SHEET_FORMATS.map((f, i) => <option key={f.label} value={i}>{f.label}</option>)}
          </select>
        </Field>
        <Field label={tr('Цвет')}>
          <input type="color" className="h-9 w-full rounded-md border border-neutral-300 dark:border-neutral-700"
            value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          checked={draft.hasGrain}
          onChange={(hasGrain) => setDraft({ ...draft, hasGrain })}
          label={tr('Текстура (деталь нельзя поворачивать в раскрое)')}
        />
        <div className="ml-auto flex gap-1">
          <Button onClick={() => setOpen(false)}>{tr('Отмена')}</Button>
          <Button
            active
            disabled={!canSave}
            onClick={() => {
              addMaterial(makeMaterial({
                id: `shop-${Date.now().toString(36)}`,
                name: draft.name.trim(),
                thickness: draft.thickness,
                sheetWidth: format.width,
                sheetHeight: format.height,
                hasGrain: draft.hasGrain,
                color: draft.color,
                edging: { visibleFront: front, visibleSecondary: secondary },
              }))
              setDraft({ ...draft, name: '' })
              setOpen(false)
            }}
          >
            Добавить
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-neutral-400">
        Цена всегда начинается с нуля — её задаёте вы.
      </p>
    </div>
  )
}

function MaterialActions({ id }: { id: string }) {
  const cloneMaterial = useConfigurator((s) => s.cloneMaterial)
  const removeMaterial = useConfigurator((s) => s.removeMaterial)
  const used = useConfigurator((s) => materialUsedInTree(s.root, id))
  return (
    <span className="flex items-center gap-1">
      <Button onClick={() => cloneMaterial(id)} title={tr('Клонировать материал')}>
        {tr('Клонировать')}
      </Button>
      <Button
        onClick={() => removeMaterial(id)}
        disabled={used}
        title={used ? 'Используется в проекте' : 'Удалить из каталога'}
      >
        ✕
      </Button>
    </span>
  )
}

function Rule({
  label, hint, k, shop, onChange,
}: {
  label: string
  hint?: string
  k: NumberSettingKey
  shop: ShopProfile
  onChange: (k: NumberSettingKey, v: number) => void
}) {
  const raw = shop.settings[k] ?? DEFAULT_SETTINGS[k]
  const overridden = shop.settings[k] !== undefined
  // `null` — ереже өшірулі (қазір `confirmatSpanForThird`-те ғана болады).
  // Экранда ол 0 болып көрінеді: 0 қойса, ереже өшіп қалады.
  const value = raw ?? 0
  const fallback = DEFAULT_SETTINGS[k] ?? tr('выключено')
  const policy = ruleInputPolicy(k)
  return (
    <Field label={label} hint={hint ?? (overridden ? 'своё' : `по умолчанию ${fallback}`)}>
      <NumberInput value={value} min={policy.min} step={1} label={policy.label} onChange={(v) => onChange(k, v)} />
    </Field>
  )
}

function PriceTable({
  head, rows,
}: {
  head: string[]
  rows: { id: string; name: string; cells: React.ReactNode[] }[]
}) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2.5 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={cn(i % 2 === 1 && 'bg-neutral-50/60 dark:bg-neutral-950/40')}>
              <td className="px-2.5 py-1.5">{r.name}</td>
              {r.cells.map((c, k) => (
                <td key={k} className="px-2.5 py-1.5">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
