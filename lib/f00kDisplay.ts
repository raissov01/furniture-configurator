export function visibleMaterialNames(carcass: string, front: string): string[] {
  return carcass === front ? [carcass] : [carcass, front]
}

export function visibleNetworkMessage(networkLabel: string, message: string,
  unavailable = 'Сервер недоступен', offline = 'Нет сети'): string | null {
  const networkError = [unavailable, offline]
  if (networkError.includes(networkLabel) && networkError.includes(message)) return null
  return message || null
}

export function measurementCaption(label: string, capturedAt: number): string {
  if (!Number.isFinite(capturedAt) || capturedAt <= 0) return label
  return `${label} · ${new Date(capturedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
}
