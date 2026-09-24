'use client'

import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { DEFAULT_SETTINGS } from '@/src/core/constants'
import type { ShopProfile } from '@/src/core/shop'
import type { ConstructionSettings, SettingsOverride } from '@/src/core/types'
import { Button, Field, NumberInput, Select } from '@/components/ui'

// Баптау бір профильде сақталады, бірақ әр жоба mergeSettings арқылы алады.
// Каталогтың артикула тәуелді сандарын әмбебап стандарт ретінде ұсынбаймыз.
//
// ҚАДАМ (CLAUDE.md §0.2): орын/шегініс — бүтін мм; фурнитура артикулының
// физикалық Ø мен тереңдігі (ілгек чашкасы 12.5, минификс ұясы 12.7 сияқты)
// 0.1 мм дәлдікпен — `step: 0.1`. Ереже схемамен бірге тексеріледі: Zod бөлшекті
// қабылдайтын өрісте ғана 0.1 (tests/shopDrillingSettingsUi.test.ts).
type NumericKey = { [K in keyof ConstructionSettings]: ConstructionSettings[K] extends number | null ? K : never }[keyof ConstructionSettings]
type ArrayKey = 'runnerRollerHoleOffsets' | 'runnerBallHoleOffsets' | 'runnerTandemHoleOffsets'
type ChoiceKey = 'minifixBoltMount' | 'hingeCupMount' | 'minifixPairPlacement' | 'outerFlipAxis'

export const DRILLING_NUMBER_FIELDS: { key: NumericKey; label: string; hint: string; step?: number }[] = [
  { key: 'shelfPinDatum', label: 'Первый полкодержатель от дна', hint: 'мм от верхней пласти дна; стандартного начала сетки нет' },
  { key: 'shelfPinFrontOffset', label: 'Передний ряд полкодержателей', hint: 'мм от передней кромки; System 32 — 37' },
  { key: 'shelfPinBackOffset', label: 'Задний ряд полкодержателей', hint: 'мм от задней кромки; задаёт цех' },
  { key: 'confirmatFaceDiameter', label: 'Конфирмат: отверстие в пласти', hint: 'Ø мм сквозное; проверьте артикул', step: 0.1 },
  { key: 'confirmatEdgeDepth', label: 'Конфирмат: пилот в торце', hint: 'глубина Ø5, мм; проверьте артикул' },
  { key: 'confirmatScrewLength', label: 'Длина конфирмата', hint: 'мм; справка к артикулу, пилот задаётся отдельно' },
  { key: 'confirmatCountersinkDiameter', label: 'Зенковка конфирмата', hint: 'Ø мм; 0 — нет. Автоматическая зенковка без глубины и угла запрещена', step: 0.1 },
  { key: 'minifixSleeveDepth', label: 'Футорка Ø8: глубина', hint: 'мм; 0 — не задана, при выборе футорки генерация остановится', step: 0.1 },
  { key: 'hingeFixingSpacing', label: 'Чашка: расстояние креплений', hint: 'мм; Blum INSERTA — 45', step: 0.1 },
  { key: 'hingeFixingOffset', label: 'Чашка: боковое смещение креплений', hint: 'мм от центра чашки; Blum INSERTA — 9.5', step: 0.1 },
  { key: 'hingeScrewPilotDiameter', label: 'Чашка: пилот под винт', hint: 'Ø мм; 0 — не задан, нужен чертёж артикула', step: 0.1 },
  { key: 'hingeScrewPilotDepth', label: 'Чашка: глубина пилота', hint: 'мм; 0 — не задана, нужен чертёж артикула', step: 0.1 },
  { key: 'hingePressFitDiameter', label: 'Чашка: отверстие INSERTA', hint: 'Ø мм; только для подходящего артикула', step: 0.1 },
  { key: 'hingePressFitDepth', label: 'Чашка: глубина INSERTA', hint: 'мм; 0 — не задана, нужен чертёж артикула', step: 0.1 },
  { key: 'runnerRollerVerticalOffset', label: 'Ролик: подъём отверстий', hint: 'мм от низа ящика; 0 — прежний шаблон' },
  { key: 'runnerBallVerticalOffset', label: 'Шарик: подъём отверстий', hint: 'мм от низа ящика; 0 — прежний шаблон' },
  { key: 'runnerTandemVerticalOffset', label: 'Tandem: подъём отверстий', hint: 'мм от низа ящика; 0 — прежний шаблон' },
  { key: 'legCentreFromFront', label: 'Центр ножки от передней кромки', hint: 'мм; прежний образец qdesign — 104' },
  { key: 'drawerFacadeScrewEndOffset', label: 'Винты фасада ящика от торцов', hint: 'мм; прежний образец qdesign — 80' },
  { key: 'minifixPairSpacing', label: 'Минификс: расстояние пары', hint: 'мм; используется при размещении от центра' },
  { key: 'minifixPairEndOffset', label: 'Минификс: отступ от концов', hint: 'мм; пара «от концов», а также всегда — стяжки дна ящика с боковинами' },
]

const ARRAYS: { key: ArrayKey; label: string; hint: string }[] = [
  { key: 'runnerRollerHoleOffsets', label: 'Ролик: отверстия от переднего края', hint: 'мм через запятую; нужен чертёж конкретного артикула' },
  { key: 'runnerBallHoleOffsets', label: 'Шарик: отверстия от переднего края', hint: 'мм через запятую; нужен чертёж конкретного артикула' },
  { key: 'runnerTandemHoleOffsets', label: 'Tandem: отверстия от переднего края', hint: 'мм через запятую; прежний шаблон qdesign, проверьте артикул' },
]

const CHOICES: { key: ChoiceKey; label: string; hint: string; options: { value: string; label: string }[] }[] = [
  { key: 'minifixBoltMount', label: 'Штифт минификса', hint: 'Ø8 футорка требует отдельную глубину сверления', options: [
    { value: 'screw-5', label: 'Винт Ø5' }, { value: 'sleeve-8', label: 'Футорка Ø8' },
  ] },
  { key: 'hingeCupMount', label: 'Крепление чашки петли', hint: 'Только по чертежу выбранной петли', options: [
    { value: 'cup-only', label: 'Только чашка (прежний шаблон)' },
    { value: 'screw', label: 'Винты' }, { value: 'press-fit', label: 'INSERTA / запрессовка' },
  ] },
  { key: 'minifixPairPlacement', label: 'Пара минификсов', hint: 'Выберите расположение двух стяжек', options: [
    { value: 'center', label: 'От центра' }, { value: 'ends', label: 'От концов' },
  ] },
  { key: 'outerFlipAxis', label: 'Переворот наружной пласти', hint: 'Ось переворота детали на станке; влияет на CNC и DXF', options: [
    { value: 'length', label: 'Вдоль длины (X)' }, { value: 'width', label: 'Вдоль ширины (Y)' },
  ] },
]

const POSITIVE_NUMBERS = new Set<NumericKey>([
  'confirmatFaceDiameter', 'confirmatEdgeDepth', 'confirmatScrewLength',
  'hingeFixingSpacing',
  'hingePressFitDiameter', 'minifixPairSpacing',
])

const ARRAY_PATTERN = /^\s*\d+(?:\s*,\s*\d+)*\s*$/

export function ShopDrillingSettings({ shop, editShop }: {
  shop: ShopProfile
  editShop: (patch: Partial<ShopProfile>) => void
}) {
  const [choiceError, setChoiceError] = useState<string | null>(null)
  const change = <K extends keyof ConstructionSettings>(key: K, value: ConstructionSettings[K]) => {
    editShop({ settings: { ...shop.settings, [key]: value } })
  }
  const setNumber = (key: NumericKey, value: number): void => {
    if (key === 'confirmatCountersinkDiameter' && value > 0) {
      setChoiceError(tr('Зенковка требует ручной операции: глубина и угол не заданы'))
      return
    }
    const nullable = key === 'minifixSleeveDepth' || key === 'hingeScrewPilotDiameter'
      || key === 'hingeScrewPilotDepth' || key === 'hingePressFitDepth'
    if (nullable && value === 0) {
      if (key === 'minifixSleeveDepth' && shop.settings.minifixBoltMount === 'sleeve-8') {
        setChoiceError(tr('Сначала укажите глубину футорки Ø8 по чертежу артикула'))
        return
      }
      if (key === 'hingePressFitDepth' && shop.settings.hingeCupMount === 'press-fit') {
        setChoiceError(tr('Сначала укажите глубину INSERTA по чертежу артикула'))
        return
      }
      if (key === 'hingeScrewPilotDepth' && shop.settings.hingeCupMount === 'screw') {
        setChoiceError(tr('Сначала укажите глубину пилота петли по чертежу артикула'))
        return
      }
      if (key === 'hingeScrewPilotDiameter' && shop.settings.hingeCupMount === 'screw') {
        setChoiceError(tr('Сначала укажите диаметр пилота петли по чертежу артикула'))
        return
      }
      setChoiceError(null)
      change(key, null)
      return
    }
    const minimum = POSITIVE_NUMBERS.has(key) || nullable ? 0.1 : 0
    if (!Number.isFinite(value) || value < minimum || value > 4000) {
      setChoiceError(tr('Значение вне допустимого диапазона присадки'))
      return
    }
    setChoiceError(null)
    change(key, value)
  }
  const reset = (key: keyof ConstructionSettings) => {
    const settings: SettingsOverride = { ...shop.settings }
    delete settings[key]
    if (key === 'minifixSleeveDepth') delete settings.minifixBoltMount
    if (key === 'hingeScrewPilotDiameter') delete settings.hingeCupMount
    if (key === 'hingeScrewPilotDepth') delete settings.hingeCupMount
    if (key === 'hingePressFitDepth') delete settings.hingeCupMount
    editShop({ settings })
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{tr('Проверьте размеры по чертежам вашей фурнитуры. Значения без общего стандарта оставлены как в прежнем шаблоне.')}</p>
      {choiceError ? <p role="alert" className="text-xs text-red-700 dark:text-red-300">{choiceError}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {DRILLING_NUMBER_FIELDS.map(({ key, label, hint, step }) => {
          const raw = shop.settings[key] ?? DEFAULT_SETTINGS[key]
          return <Field key={key} label={tr(label)} hint={tr(hint)}>
            <div className="flex gap-1">
              {step && step < 1 ? (
                <input type="number" className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={raw ?? 0} min={POSITIVE_NUMBERS.has(key) ? 0.1 : 0} step={step}
                  onChange={(event) => {
                    // 0.1 мм — drilling.ts-тегі roundCoord дәлдігі.
                    const value = Math.round(Number(event.currentTarget.value) * 10) / 10
                    setNumber(key, value)
                  }} />
              ) : (
                <NumberInput value={raw ?? 0} min={POSITIVE_NUMBERS.has(key) ? 1 : 0} step={step ?? 1}
                  onChange={(value) => setNumber(key, value)} />
              )}
              <Button disabled={shop.settings[key] === undefined} onClick={() => reset(key)}>{tr('Сброс')}</Button>
            </div>
          </Field>
        })}
        {CHOICES.map(({ key, label, hint, options }) => (
          <Field key={key} label={tr(label)} hint={tr(hint)}>
            <div className="flex gap-1">
              <Select value={shop.settings[key] ?? DEFAULT_SETTINGS[key]}
                options={options.map((option) => ({ value: option.value, label: tr(option.label) }))}
                onChange={(value) => {
                  if (key === 'minifixBoltMount' && value === 'sleeve-8'
                    && !shop.settings.minifixSleeveDepth) {
                    setChoiceError(tr('Сначала укажите глубину футорки Ø8 по чертежу артикула'))
                    return
                  }
                  if (key === 'hingeCupMount' && value === 'press-fit'
                    && !shop.settings.hingePressFitDepth) {
                    setChoiceError(tr('Сначала укажите глубину INSERTA по чертежу артикула'))
                    return
                  }
                  if (key === 'hingeCupMount' && value === 'screw'
                    && !shop.settings.hingeScrewPilotDepth) {
                    setChoiceError(tr('Сначала укажите глубину пилота петли по чертежу артикула'))
                    return
                  }
                  if (key === 'hingeCupMount' && value === 'screw'
                    && !shop.settings.hingeScrewPilotDiameter) {
                    setChoiceError(tr('Сначала укажите диаметр пилота петли по чертежу артикула'))
                    return
                  }
                  setChoiceError(null)
                  change(key, value as ConstructionSettings[typeof key])
                }} />
              <Button disabled={shop.settings[key] === undefined} onClick={() => reset(key)}>{tr('Сброс')}</Button>
            </div>
          </Field>
        ))}
        {ARRAYS.map(({ key, label, hint }) => (
          <Field key={key} label={tr(label)} hint={tr(hint)}>
            <div className="flex gap-1">
              <input key={`${key}-${(shop.settings[key] ?? DEFAULT_SETTINGS[key]).join(',')}`}
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                defaultValue={(shop.settings[key] ?? DEFAULT_SETTINGS[key]).join(', ')}
                onBlur={(event) => {
                  const input = event.currentTarget.value
                  if (!ARRAY_PATTERN.test(input) || input.split(',').some((value) => Number(value.trim()) <= 0)) { event.currentTarget.setCustomValidity(tr('Укажите положительные целые миллиметры через запятую')); event.currentTarget.reportValidity(); return }
                  event.currentTarget.setCustomValidity('')
                  change(key, input.split(',').map((value) => Number(value.trim())))
                }} />
              <Button disabled={shop.settings[key] === undefined} onClick={() => reset(key)}>{tr('Сброс')}</Button>
            </div>
          </Field>
        ))}
      </div>
    </div>
  )
}
