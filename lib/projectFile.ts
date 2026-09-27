/**
 * Жоба файлын сақтау/ашу — `ProjectMenu`, классикалық мәзір мен құрал
 * жолағы үшін ОРТАҚ.
 *
 * Бұрын классикалық «Открыть»/«Сохранить» жасырын header-дегі батырма мен
 * `#project-open-input`-ты `.click()` ететін (аудит P0-1): header жасырын
 * болғанда ол сенімсіз. Енді әр шақырушы осы функцияларды тікелей шақырады.
 */

import { parseProjectV4 } from '@/src/core/index'
import type { ProjectFileV4 } from '@/src/core/index'
import { downloadFile } from '@/lib/shopExport'
import { tf } from '@/lib/i18n'

export function projectFileName(file: { name?: string | undefined }): string {
  return `${file.name || 'проект'}.json`
}

export function parseProjectFileText(text: string, filename = 'проект.json'): ProjectFileV4 {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new Error(tf('Неверный JSON в файле «{name}». Выберите файл проекта .json или исправьте его синтаксис.',
      { name: filename }), { cause: error })
  }
  return parseProjectV4(parsed)
}

export function downloadProjectFile(file: ProjectFileV4): void {
  downloadFile(projectFileName(file), JSON.stringify(file, null, 2), 'application/json')
}

export function projectFileErrorMessage(error: unknown): string {
  return tf('Не удалось открыть проект: {reason}', {
    reason: error instanceof Error ? error.message : String(error),
  })
}

/** Файлды оқып, жүктейді; қатені шақырушы бетте көрсетеді. */
export async function loadProjectFromFile(file: File, load: (project: ProjectFileV4) => void): Promise<void> {
  load(parseProjectFileText(await file.text(), file.name))
}

/**
 * Файл таңдау терезесі. Уақытша input DOM-ға тіркелмейді: `click()` пайдаланушы
 * басқан оқиғаның ішінде шақырылады, сондықтан браузер терезені ашады.
 */
export function pickProjectFile(load: (project: ProjectFileV4) => void, onError: (error: unknown) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void loadProjectFromFile(file, load).catch(onError)
  }, { once: true })
  input.click()
}
