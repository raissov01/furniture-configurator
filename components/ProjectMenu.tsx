'use client'

/**
 * Жобаны сақтау мен ашу.
 *
 * Файлда КОНФИГ қана жатады, панельдер емес (§7): пішін өзгерсе, ескі файл
 * `parseProject()` арқылы жаңа пішінге көтеріледі де, жоба сынбайды.
 */

import { t as tr } from '@/lib/i18n'
import { useRef, useState } from 'react'
import { downloadProjectFile, loadProjectFromFile, projectFileErrorMessage } from '@/lib/projectFile'
import { useConfigurator } from '@/store/configurator'
import { Button } from '@/components/ui'

export function ProjectMenu() {
  const exportProject = useConfigurator((s) => s.exportProject)
  const loadProject = useConfigurator((s) => s.loadProject)
  const input = useRef<HTMLInputElement>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  const save = () => downloadProjectFile(exportProject())

  const open = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    setOpenError(null)
    try {
      await loadProjectFromFile(file, loadProject)
    } catch (error) {
      setOpenError(projectFileErrorMessage(error))
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="project-menu">
      <Button onClick={save} title={tr('Скачать проект файлом')}>{tr('Сохранить')}</Button>
      <Button onClick={() => input.current?.click()} title={tr('Открыть проект из файла')}>{tr('Открыть')}</Button>
      <input
        ref={input}
        // Классикалық «Файл → Открыть» бұл input-қа тиіспейді: ол
        // `lib/projectFile.ts`-тегі `pickProjectFile`-ты тікелей шақырады.
        id="project-open-input"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void open(e.target.files)}
      />
      {openError ? <p role="alert" className="w-full border border-red-600 px-2 py-1 text-xs text-red-700">{openError}</p> : null}
    </div>
  )
}
