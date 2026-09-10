import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import { MotionProvider } from '@/components/v2/motion/MotionProvider'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://tanfeng.shinluv.cloud'),
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
    images: [
      {
        url: '/daoflow-v2/a14-taiji-launch.webp',
        width: 1200,
        height: 675,
        alt: 'DaoFlow 青绿山水太极图',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
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
