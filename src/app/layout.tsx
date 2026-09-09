import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import { MotionProvider } from '@/components/v2/motion/MotionProvider'
import './globals.css'

const notoSerif = localFont({
  src: './fonts/DaoFlow-Serif.woff2',
  weight: '300',
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DaoFlow · 问道',
  description: '让心归静，让生活顺流。借《道德经》的智慧，重新看见此刻的自己。',
  keywords: ['道德经', '问道', 'DaoFlow', '老子', '国学'],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'DaoFlow · 问道',
    description: '让心归静，让生活顺流。借《道德经》的智慧，重新看见此刻的自己。',
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
    <html lang="zh-CN" className={notoSerif.variable}>
      <body>
        <MotionProvider>
          <NavBar />
          {children}
          <Footer />
        </MotionProvider>
      </body>
    </html>
  )
}
