import type { Metadata } from 'next'
import { Golos_Text, JetBrains_Mono, PT_Sans_Narrow } from 'next/font/google'
import './globals.css'

/**
 * Қаріптер: ПТ Санс Нарроу — аймақтың техникалық көрсеткіштерінің қарпі
 * (тақырыптар), Golos Text — мәтін, JetBrains Mono — сандар мен белгілер.
 * Үшеуінде де толық кириллица бар: қазақ-орыс мәтіні сынбауы керек.
 */
const display = PT_Sans_Narrow({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-display',
  display: 'swap',
})

const body = Golos_Text({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-body',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Конфигуратор корпусной мебели для цехов',
  description:
    'Задаёте габарит — получаете деталировку, карту раскроя и коммерческое предложение. Ваши материалы, ваши цены, ваши правила сборки.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
