'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/lib/i18n'
import { CORNER_IDS, OBSTACLE_KINDS, WALL_IDS, validateMeasurement, type MeasurementSurvey, type ObstacleKind, type RoomTolerance } from '@/src/core/measure'
import type { WallId } from '@/src/core/types'
import type { IndexedDbMobileStore } from '@/lib/mobile/indexedDb'
import { prepareMeasurementPhoto } from '@/lib/mobile/photo'
import type { JsonValue } from '@/src/core/sync/types'
import type { EnqueueResult } from './measurementSync'
import { canAdvanceWall, roomIssues, wallIssues, setObstacleLocation, updateMeasure, updateObstacle, updateObstacleDimension, type CaptureSource, type ObstacleDimension, type SurveyField } from './measurementModel'

const wallLabels: Record<WallId, string> = { north: 'Северная стена', east: 'Восточная стена', south: 'Южная стена', west: 'Западная стена' }
const cornerLabels: Record<typeof CORNER_IDS[number], string> = {
  northWest: 'Северо-западный', northEast: 'Северо-восточный',
  southEast: 'Юго-восточный', southWest: 'Юго-западный',
}
const obstacleDimensions: { field: ObstacleDimension; label: string }[] = [
  { field: 'offset', label: 'От начала стены, мм' }, { field: 'width', label: 'Ширина препятствия, мм' },
  { field: 'elevation', label: 'От пола, мм' }, { field: 'height', label: 'Высота препятствия, мм' },
  { field: 'depth', label: 'Глубина препятствия, мм' },
]
const obstacleLabels: Record<ObstacleKind, string> = {
  socket: 'Розетка', pipe: 'Труба', radiator: 'Батарея',
  vent: 'Вентиляция', windowSill: 'Подоконник', tileThickness: 'Толщина плитки',
}
const button = 'min-h-11 rounded-none border border-[#8c8c8c] bg-white px-3 py-2 text-left text-sm text-black disabled:bg-[#ededed] disabled:text-[#666]'
const input = 'min-h-11 w-full min-w-0 rounded-none border border-[#8c8c8c] bg-white px-3 text-base text-black'
const issueLabel = (path: string): string => {
  const parts = path.split('.')
  if (parts[0] === 'height') return t('Высота помещения')
  if (parts[0] === 'corners' && parts[1] && parts[1] in cornerLabels) return t(cornerLabels[parts[1] as keyof typeof cornerLabels])
  if (parts[0] === 'walls' && parts[1] && parts[1] in wallLabels) {
    const wall = t(wallLabels[parts[1] as WallId])
    if (parts[2] === 'obstacles' && parts[3] && parts[3] in obstacleLabels) {
      return `${wall} · ${t(obstacleLabels[parts[3] as ObstacleKind])}`
    }
    return wall
  }
  return t('Проверьте обязательное поле')
}
const issueCopy = (path: string): string => {
  if (path.endsWith('.photoRef')) return t('Добавьте фото')
  if (path.endsWith('.status')) return t('Ответьте «есть» или «нет»')
  if (path.endsWith('.thickness')) return t('Укажите толщину плитки')
  return t('Уточните целое положительное значение')
}

type Props = {
  initial: MeasurementSurvey
  store: IndexedDbMobileStore
  onBack: () => void
  onSave: (survey: MeasurementSurvey) => Promise<EnqueueResult>
  onKitchen: (survey: MeasurementSurvey, wall: WallId, tolerance: RoomTolerance) => Promise<void>
  pending: number
  networkLabel: string
  networkColor: string
}

export function MeasurementWizard({ initial, store, onBack, onSave, onKitchen, pending, networkLabel, networkColor }: Props) {
  const [survey, setSurvey] = useState(initial)
  const [step, setStep] = useState<'room' | 'wall' | 'review'>('room')
  const [wallIndex, setWallIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [kitchenWall, setKitchenWall] = useState<WallId>('north')
  const [wallTolerance, setWallTolerance] = useState(0)
  const [cornerTolerance, setCornerTolerance] = useState(0)
  const wall = WALL_IDS[wallIndex] ?? 'north'
  const issues = validateMeasurement(survey)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    saveChain.current = saveChain.current.catch(() => undefined).then(() => store.putSurvey(survey.id, survey as unknown as JsonValue))
    void saveChain.current.catch((error: unknown) => { setMessage(error instanceof Error ? error.message : t('Не удалось сохранить черновик')) })
  }, [store, survey])

  const changeNumber = (field: SurveyField, value: string, source: CaptureSource) => {
    const numeric = value === '' ? 0 : Number(value)
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
      setMessage(t('Введите целое число миллиметров'))
      return
    }
    setSurvey((current) => updateMeasure(current, field, numeric, source, Date.now()))
    setMessage('')
  }

  const save = async () => {
    if (issues.length) { setMessage(t('Сначала завершите все обязательные поля замера')); return }
    setBusy(true)
    try {
      await saveChain.current
      const result = await onSave(survey)
      setMessage(result === 'conflict' ? t('Замер сохранён локально; разрешите конфликт на главном экране') :
        result === 'rejected' ? t('Отправка отклонена; вернитесь и повторите вручную после исправления причины') :
        result === 'pending' ? t('Замер сохранён локально; предыдущая версия ещё ожидает отправки') :
        result === 'unchanged' ? t('Замер уже сохранён') :
        t('Замер сохранён на этом устройстве и поставлен в очередь отправки'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Не удалось сохранить замер'))
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    try { await saveChain.current; onBack() }
    catch (error) { setMessage(error instanceof Error ? error.message : t('Не удалось сохранить черновик')) }
  }

  const selectPhoto = async (kind: ObstacleKind, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage(t('Выберите фотографию')); return }
    const photoId = `photo:${crypto.randomUUID()}`
    setBusy(true)
    try {
      await store.putPhoto(photoId, await prepareMeasurementPhoto(file))
      setSurvey((current) => updateObstacle(current, wall, kind, { photoRef: photoId }))
      setMessage(t('Фото сохранено на этом устройстве'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Не удалось сохранить фото'))
    } finally {
      setBusy(false)
    }
  }

  const nextFromRoom = () => {
    const invalid = roomIssues(survey)
    if (invalid.length) {
      setMessage(`${t('Проверьте поле')}: ${issueLabel(invalid[0] ?? '')}. ${t('Введите целое положительное значение')}`)
      return
    }
    setMessage('')
    setStep('wall')
  }
  const nextFromWall = () => {
    if (!canAdvanceWall(survey, wall)) {
      setMessage(t('Для каждого препятствия выберите «есть» или «нет» и добавьте фото'))
      return
    }
    setMessage('')
    if (wallIndex < WALL_IDS.length - 1) setWallIndex(wallIndex + 1)
    else setStep('review')
  }

  const renderMeasuredField = ({ field, label, value, min = 1, unit = 'мм' }: {
    field: SurveyField; label: string; value: MeasurementSurvey['height']; min?: number; unit?: string
  }) => <label className="block min-w-0 text-sm font-medium">
      <span className="mb-1 block">{t(label)}</span>
      <span className="flex min-w-0 gap-2">
        <input aria-label={`${t(label)}, ${t(unit)}`} className={input} inputMode="numeric" min={min} step="1" type="number"
          value={value.value || ''} onChange={(event) => changeNumber(field, event.target.value, value.source)} />
        <select aria-label={`${t(label)}: ${t('Источник')}`} className={`${input} !w-28 shrink-0`}
          value={value.source} onChange={(event) => changeNumber(field, String(value.value), event.target.value as CaptureSource)}>
          <option value="manual">{t('Вручную')}</option><option value="voice">{t('Голос')}</option><option value="laser">{t('Лазер')}</option>
        </select>
      </span>
      <span className="mt-1 block text-xs text-[#525252]">{t(unit)} · {t('Источник отмечается вручную')}</span>
      {issues.some((issue) => issue.path === field || issue.path === `${field}.value`) && <span className="block text-xs text-[#9b1c1c]">{t('Требуется целое положительное значение')}</span>}
    </label>

  const answerCard = (kind: ObstacleKind) => {
    const answer = survey.walls[wall].obstacles[kind]
    const path = `walls.${wall}.obstacles.${kind}`
    const invalid = wallIssues(survey, wall).filter((issue) => issue.startsWith(path))
    return <fieldset key={kind} className="min-w-0 border border-[#b8b8b8] bg-white p-3">
      <legend className="px-1 text-sm font-semibold">{t(obstacleLabels[kind])}</legend>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={answer.status === 'present'} className={`${button} ${answer.status === 'present' ? '!border-[#005a9e] !bg-[#dceeff]' : ''}`}
          onClick={() => setSurvey((current) => updateObstacle(current, wall, kind, { status: 'present' }))}>{t('Есть')}</button>
        <button type="button" aria-pressed={answer.status === 'absent'} className={`${button} ${answer.status === 'absent' ? '!border-[#005a9e] !bg-[#dceeff]' : ''}`}
          onClick={() => setSurvey((current) => updateObstacle(current, wall, kind, { status: 'absent' }))}>{t('Нет')}</button>
      </div>
      <label className="mt-2 block text-sm">
        <span className="mb-1 block">{t('Фото обязательно даже при ответе «нет»')}</span>
        <input aria-label={`${t(obstacleLabels[kind])}: ${t('Фото')}`} className="block w-full min-w-0 text-sm file:mr-2 file:min-h-11 file:border file:border-[#8c8c8c] file:bg-white file:px-3" type="file" accept="image/*" capture="environment"
          onChange={(event) => void selectPhoto(kind, event.target.files?.[0])} />
      </label>
      {answer.photoRef && <p className="mt-1 text-xs text-[#235b2d]">{t('Фото сохранено на этом устройстве')}</p>}
      {answer.status === 'present' && <div className="mt-2 border-t border-[#b8b8b8] pt-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={answer.location !== null}
            onChange={(event) => setSurvey((current) => setObstacleLocation(current, wall, kind, event.target.checked, Date.now()))} />
          {t('Указать положение препятствия')}
        </label>
        {answer.location && <div className="space-y-2">
          {obstacleDimensions.map(({ field, label }) => <label className="block text-sm" key={field}>
            <span className="mb-1 block">{t(label)}</span>
            <span className="flex gap-2">
              <input className={input} type="number" inputMode="numeric" min="0" step="1" value={answer.location?.[field].value || ''}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (!Number.isSafeInteger(value) || value < 0) { setMessage(t('Введите целое число миллиметров')); return }
                  setSurvey((current) => updateObstacleDimension(current, wall, kind, field, value,
                    answer.location?.[field].source ?? 'manual', Date.now()))
                }} />
              <select aria-label={`${t(label)}: ${t('Источник')}`} className={`${input} !w-28 shrink-0`}
                value={answer.location?.[field].source ?? 'manual'}
                onChange={(event) => setSurvey((current) => updateObstacleDimension(current, wall, kind, field,
                  answer.location?.[field].value ?? 0, event.target.value as CaptureSource, Date.now()))}>
                <option value="manual">{t('Вручную')}</option><option value="voice">{t('Голос')}</option><option value="laser">{t('Лазер')}</option>
              </select>
            </span>
          </label>)}
        </div>}
      </div>}
      {kind === 'tileThickness' && answer.status === 'present' && <label className="mt-2 block text-sm">
        <span className="mb-1 block">{t('Толщина плитки, мм')}</span>
        <span className="flex gap-2">
          <input className={input} inputMode="numeric" min="1" step="1" type="number" value={answer.thickness?.value || ''}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isSafeInteger(value) || value < 0) return
              setSurvey((current) => updateObstacle(current, wall, kind, { thickness: {
                value, source: answer.thickness?.source ?? 'manual', capturedAt: Date.now(),
              } }))
            }} />
          <select aria-label={t('Источник')} className={`${input} !w-28 shrink-0`} value={answer.thickness?.source ?? 'manual'}
            onChange={(event) => setSurvey((current) => updateObstacle(current, wall, kind, { thickness: {
              value: answer.thickness?.value ?? 0, source: event.target.value as CaptureSource, capturedAt: Date.now(),
            } }))}>
            <option value="manual">{t('Вручную')}</option><option value="voice">{t('Голос')}</option><option value="laser">{t('Лазер')}</option>
          </select>
        </span>
      </label>}
      {invalid.length > 0 && <p className="mt-2 text-xs text-[#9b1c1c]">{invalid.map(issueCopy).join('; ')}</p>}
    </fieldset>
  }

  return <main className="mx-auto min-h-dvh w-full max-w-xl overflow-x-hidden bg-[#f5f5f5] p-4 text-black">
    <div role="status" className={`mb-4 border p-3 text-sm ${networkColor}`}>
      {networkLabel} · {t('Ожидает отправки')}: {pending}
    </div>
    <header className="mb-4 flex items-center justify-between gap-2">
      <button className={button} type="button" onClick={() => void leave()}>{t('Назад')}</button>
      <span className="text-right text-sm font-semibold">{t('Замер')} · {step === 'room' ? '1/3' : step === 'wall' ? '2/3' : '3/3'}</span>
    </header>
    {step === 'room' && <section className="space-y-4">
      <h1 className="text-xl font-semibold">{t('Помещение и стены')}</h1>
      <p className="text-sm text-[#525252]">{t('Все размеры в целых миллиметрах. Голос и лазер здесь только источник введённого числа.')}</p>
      {renderMeasuredField({ field: 'height', label: 'Высота помещения', value: survey.height })}
      {WALL_IDS.map((id) => <div key={id}>{renderMeasuredField({ field: `walls.${id}.length`, label: wallLabels[id], value: survey.walls[id].length })}</div>)}
      <h2 className="font-semibold">{t('Углы, градусы')}</h2>
      {CORNER_IDS.map((id) => <div key={id}>{renderMeasuredField({ field: `corners.${id}`, label: cornerLabels[id], value: survey.corners[id], unit: '°' })}</div>)}
      <button className={`${button} w-full !border-[#005a9e] !bg-[#005a9e] !text-white`} type="button" onClick={nextFromRoom}>{t('К препятствиям')}</button>
    </section>}
    {step === 'wall' && <section className="space-y-3">
      <h1 className="text-xl font-semibold">{t(wallLabels[wall])} · {wallIndex + 1}/4</h1>
      <p className="text-sm text-[#525252]">{t('Отметьте каждое препятствие и приложите фото. Без ответа и фото стена не завершится.')}</p>
      {OBSTACLE_KINDS.map(answerCard)}
      <div className="grid grid-cols-2 gap-2">
        <button className={button} type="button" onClick={() => wallIndex ? setWallIndex(wallIndex - 1) : setStep('room')}>{t('Назад')}</button>
        <button className={`${button} !border-[#005a9e] !bg-[#005a9e] !text-white`} type="button" onClick={nextFromWall}>{wallIndex < 3 ? t('Следующая стена') : t('Проверить')}</button>
      </div>
    </section>}
    {step === 'review' && <section className="space-y-3">
      <h1 className="text-xl font-semibold">{t('Проверка замера')}</h1>
      <p className="text-sm">{t('Высота помещения')}: {survey.height.value} {t('мм')}</p>
      {WALL_IDS.map((id) => <p className="text-sm" key={id}>{t(wallLabels[id])}: {survey.walls[id].length.value} {t('мм')}</p>)}
      {issues.length ? <div className="border border-[#9b1c1c] bg-white p-3 text-sm text-[#9b1c1c]">
        <strong>{t('Нужно уточнить')}</strong>
        <ul className="mt-2 list-disc pl-5">{issues.map((issue) => <li key={`${issue.path}:${issue.message}`}>{issueLabel(issue.path)}: {issueCopy(issue.path)}</li>)}</ul>
      </div> : <p className="border border-[#247333] bg-white p-3 text-sm">{t('Все обязательные ответы и фото есть')}</p>}
      <button className={`${button} w-full`} type="button" onClick={() => { setStep('wall'); setWallIndex(0) }}>{t('Исправить замер')}</button>
      <button className={`${button} w-full !border-[#005a9e] !bg-[#005a9e] !text-white`} type="button" disabled={busy || issues.length > 0} onClick={() => void save()}>{t('Сохранить замер')}</button>
      <label className="block text-sm">{t('Стена первого ряда кухни')}
        <select className={`${input} mt-1`} value={kitchenWall} onChange={(event) => setKitchenWall(event.target.value as WallId)}>
          {WALL_IDS.map((id) => <option key={id} value={id}>{t(wallLabels[id])}</option>)}
        </select>
      </label>
      <label className="block text-sm">{t('Допуск противоположных стен, мм')}
        <input className={`${input} mt-1`} type="number" min="0" step="1" value={wallTolerance}
          onChange={(event) => setWallTolerance(Number(event.target.value))} />
      </label>
      <label className="block text-sm">{t('Допуск углов, °')}
        <input className={`${input} mt-1`} type="number" min="0" step="1" value={cornerTolerance}
          onChange={(event) => setCornerTolerance(Number(event.target.value))} />
      </label>
      {WALL_IDS.some((id) => OBSTACLE_KINDS.some((kind) => survey.walls[id].obstacles[kind].status === 'present')) &&
        <p className="border border-[#a46a00] bg-[#fff3d5] p-3 text-sm">{t('Препятствия отмечены в замере. Проверьте положение модулей вручную до изготовления.')}</p>}
      <button className={`${button} w-full`} type="button" disabled={issues.length > 0 || busy} onClick={() => {
        setBusy(true)
        void saveChain.current.then(() => onKitchen(survey, kitchenWall,
          { wallMm: wallTolerance, cornerDeg: cornerTolerance })).catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : ''
          setMessage(reason.includes('corner') ? t('Для кухни все четыре угла должны быть 90°') :
            reason.includes('opposite walls') ? t('Для кухни противоположные стены должны быть равны') :
              t('Не удалось создать кухню по замеру'))
        }).finally(() => setBusy(false))
      }}>{t('Создать кухню по замеру')}</button>
    </section>}
    {message && <p role="status" className="mt-4 border border-[#8c8c8c] bg-white p-3 text-sm">{message}</p>}
  </main>
}
