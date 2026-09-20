'use client'

/**
 * Жобаны сақтау мен ашу.
 *
 * Файлда КОНФИГ қана жатады, панельдер емес (§7): пішін өзгерсе, ескі файл
 * `parseProject()` арқылы жаңа пішінге көтеріледі де, жоба сынбайды.
 */

import { t as tr } from '@/lib/i18n'
import { useRef } from 'react'
import { parseProject } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { Button } from '@/components/ui'

export function ProjectMenu() {
  const exportProject = useConfigurator((s) => s.exportProject)
  const loadProject = useConfigurator((s) => s.loadProject)
  const input = useRef<HTMLInputElement>(null)

  const save = () => {
    const file = exportProject()
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file.name || 'проект'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const open = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    try {
      loadProject(parseProject(JSON.parse(await file.text())))
    } catch (error) {
      // Бүлінген файл ҮНСІЗ жұтылмауы керек: адам не болғанын білуі тиіс.
      window.alert(
        `Не удалось открыть проект: ${error instanceof Error ? error.message : 'файл не распознан'}`,
      )
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button onClick={save} title={tr('Скачать проект файлом')}>{tr('Сохранить')}</Button>
      <Button onClick={() => input.current?.click()} title={tr('Открыть проект из файла')}>{tr('Открыть')}</Button>
      <input
        ref={input}
        // PRO100-дың «Файл → Открыть» мәзір пунктінен де осы файл терезесі
        // шақырылады (`Workspace.tsx`-тегі жаңа мәзір жолағы): логиканы
        // ЕКІНШІ РЕТ жазбау үшін, сол жерде осы `id` бойынша табылып басылады.
        id="project-open-input"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void open(e.target.files)}
      />
    </div>
  )
}
