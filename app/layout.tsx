import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Конфигуратор корпусной мебели',
  description: 'Параметрический конфигуратор: 3D, деталировка и раскрой из одной модели',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
