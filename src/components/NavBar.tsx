'use client'

import Link from 'next/link'

/**
 * 透明导航栏
 *
 * 规格:
 *   纯文字，无背景色块
 *   文字 14px 量级，墨色 70% 透明度
 *   hover 时 1px 下划线，300ms 过渡
 */
const NAV_ITEMS = [
  { label: '问道', href: '/' },
  { label: '我的道', href: '/my-dao' },
  { label: '关于', href: '#about' },
]

export default function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
      {/* Logo */}
      <Link
        href="/"
        className="title-sans text-sm tracking-[0.05em] text-ink/70 hover:text-ink/90 transition-colors duration-300"
      >
        DaoFlow
      </Link>

      {/* 右侧菜单 */}
      <ul className="flex items-center gap-8">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="title-sans group relative text-sm tracking-[0.05em] text-ink/70 hover:text-ink/90 transition-colors duration-300"
            >
              {item.label}
              <span className="absolute bottom-[-2px] left-0 w-0 h-px bg-ink/50 transition-all duration-300 group-hover:w-full" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
