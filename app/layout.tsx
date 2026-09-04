import type { Metadata, Viewport } from 'next'
import { Golos_Text, JetBrains_Mono, PT_Sans_Narrow } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/components/I18nProvider'
import { ServiceWorker } from '@/components/ServiceWorker'

/**
 * Қаріптер: ПТ Санс Нарроу — аймақтың техникалық көрсеткіштерінің қарпі
 * (тақырыптар), Golos Text — мәтін, JetBrains Mono — сандар мен белгілер.
 *
 * ⚠ `cyrillic-ext` МІНДЕТТІ. Қазақтың ә, ғ, қ, ң, ө, ұ, ү, һ, і әріптері
 * негізгі `cyrillic` жиынына КІРМЕЙДІ — онсыз олар қор қаріппен алмасады да,
 * қазақша мәтін жолдың ортасында басқа қаріппен «секіріп» тұрады.
 */
const display = PT_Sans_Narrow({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  weight: ['400', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = Golos_Text({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  variable: '--font-body',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Конфигуратор корпусной мебели для цехов',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  // Телефонға орнатылғанда терезенің аты қысқа болуы керек.
  appleWebApp: { capable: true, title: 'Конфигуратор', statusBarStyle: 'black-translucent' },
  description:
    'Задаёте габарит — получаете деталировку, карту раскроя и коммерческое предложение. Ваши материалы, ваши цены, ваши правила сборки.',
}

/**
 * Телефонға арналған көрініс.
 *
 * `viewportFit: 'cover'` — «тұмсығы» бар экрандарда (iPhone) қосымша толық
 * бетті алады, ал `themeColor` жүйелік жолақтың түсін жиһаздың фонымен
 * теңестіреді: орнатылған қосымша браузердің бетіндей емес, өз қосымшадай
 * көрінуі керек.
 */
export const viewport: Viewport = {
  themeColor: '#17191e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
