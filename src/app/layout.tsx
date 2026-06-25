import type { Metadata } from 'next'
import { Noto_Serif_SC } from 'next/font/google'
import Footer from '@/components/Footer'
import './globals.css'

const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DaoFlow · 问道',
  description: '不是看见道，是看见自己站在道之中',
  keywords: ['道德经', '问道', 'DaoFlow', '老子', '国学'],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'DaoFlow · 问道',
    description: '不是看见道，是看见自己站在道之中',
    type: 'website',
    locale: 'zh_CN',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={notoSerif.variable}>
        {children}
        <Footer />
      </body>
    </html>
  )
}
