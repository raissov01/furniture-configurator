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

export function projectFileName(file: { name?: string | undefined }): string {
  return `${file.name || 'проект'}.json`
}

export function parseProjectFileText(text: string): ProjectFileV4 {
  return parseProjectV4(JSON.parse(text))
}

export function downloadProjectFile(file: ProjectFileV4): void {
  downloadFile(projectFileName(file), JSON.stringify(file, null, 2), 'application/json')
}

/** Файлды оқып, жүктейді; бүлінген файл ҮНСІЗ жұтылмайды. */
export async function loadProjectFromFile(file: File, load: (project: ProjectFileV4) => void): Promise<void> {
  try {
    load(parseProjectFileText(await file.text()))
  } catch (error) {
    window.alert(`Не удалось открыть проект: ${error instanceof Error ? error.message : 'файл не распознан'}`)
  }
}

/**
 * Файл таңдау терезесі. Уақытша input DOM-ға тіркелмейді: `click()` пайдаланушы
 * басқан оқиғаның ішінде шақырылады, сондықтан браузер терезені ашады.
 */
export function pickProjectFile(load: (project: ProjectFileV4) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void loadProjectFromFile(file, load)
  }, { once: true })
  input.click()
}
