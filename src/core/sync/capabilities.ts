/** One registry for the mobile UI's network labels and disabled/queued behavior. */
export const OFFLINE_CAPABILITIES = {
  measurement: 'offline', photo: 'offline', obstacle: 'offline', note: 'offline', audioFile: 'offline',
  generator: 'offline', kitchenWizard: 'offline', templates: 'offline', view2d3d: 'offline',
  cutList: 'offline', nesting: 'offline', drilling: 'offline', pricing: 'offline',
  pdf: 'offline', dxf: 'offline', cnc: 'offline', csv: 'offline', xlsx: 'offline', labels: 'offline',
  downloadedOrder: 'offline', qrScan: 'offline', workshopStatus: 'offline', assemblyChecklist: 'offline',
  manualPayment: 'offline',
  projectSync: 'queued', measurementSync: 'queued', photoUpload: 'queued', workshopStatusSync: 'queued',
  assemblySync: 'queued', manualPaymentSync: 'queued', publishShare: 'queued', commentSend: 'queued',
  whatsappLink: 'queued',
  firstLogin: 'online', teamInvite: 'online', roleChange: 'online', cloudDownload: 'online',
  clientApproval: 'online', otp: 'online', bankPaymentLink: 'online', bankPaymentCheck: 'online',
  aiGenerate: 'online', aiVariants: 'online', aiRender: 'online', speechRecognition: 'online',
  supplierPriceRefresh: 'online',
} as const

export type OfflineFeature = keyof typeof OFFLINE_CAPABILITIES
export type Capability =
  | { mode: 'offline'; requiresInternet: false }
  | { mode: 'queued' | 'online'; requiresInternet: true }

export function offlineCapability(feature: OfflineFeature): Capability {
  const mode = OFFLINE_CAPABILITIES[feature]
  if (mode === undefined) throw new Error(`Unknown offline feature: ${feature}`)
  if (mode === 'offline') return { mode, requiresInternet: false }
  return { mode, requiresInternet: true }
}
