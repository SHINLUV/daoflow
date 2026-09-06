'use client'
import { YinYang } from '@phosphor-icons/react'
export default function DaoLoading() {
  return <div className="dao-loading" role="status"><YinYang size={38} weight="light" /><p>静待片刻</p><small>正在为你展开篇章……</small></div>
}
