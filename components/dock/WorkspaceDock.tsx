'use client'

import type { ReactNode } from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import type { DxfImportResult } from '@/src/core/import/dxf'
import { dxfRoomSize } from '@/lib/dxfRoomSize'
import { PricePanel } from '@/components/panels/PricePanel'
import { DimensionsPanel } from '@/components/panels/DimensionsPanel'
import { InfoPanel } from '@/components/panels/InfoPanel'
import { ImportPanel } from '@/components/panels/ImportPanel'
import { DockHost } from './DockHost'

const PANEL_IDS = ['price', 'dimensions', 'info', 'import'] as const
const WORKSPACE_DOCK_KEY = 'furniture-configurator:workspace-dock'

/** Production panels share the live project store in both workspace styles. */
export function WorkspaceDock({ children }: { children: ReactNode }) {
  const editRoom = useConfigurator((state) => state.editRoom)
  const importRoom = (result: DxfImportResult) => editRoom(dxfRoomSize(result))
  const panels = [
    { id: 'price', title: tr('Прайс-лист'), content: <PricePanel /> },
    { id: 'dimensions', title: tr('Размеры'), content: <DimensionsPanel /> },
    { id: 'info', title: tr('Информация'), content: <InfoPanel /> },
    { id: 'import', title: tr('Импорт'), content: <ImportPanel onImport={importRoom} /> },
  ]
  return <DockHost panels={panels} initiallyClosed={PANEL_IDS} storageKey={WORKSPACE_DOCK_KEY}>{children}</DockHost>
}
