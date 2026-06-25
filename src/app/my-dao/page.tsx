'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
import type { User } from '@supabase/supabase-js'

interface AskSession {
  id: string
  question: string
  ai_response: string
  follow_up_question: string | null
  created_at: string
}

/**
 * 「我的道」页面
 *
 * 登录前：邮箱输入 + 魔法链接（无密码）
 * 登录后：最近 5 条问道记录 + 回看
 *
 * 设计：安静、留白、不催促
 */
export default function MyDaoPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined=加载中
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sessions, setSessions] = useState<AskSession[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const [supabase] = useState(() => createClient())
  const router = useRouter()

  // 检查登录态
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // 监听 auth 状态变化（魔法链接回调后自动刷新）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // 登录后拉取历史
  useEffect(() => {
    if (!user) return
    fetch('/api/me/history')
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {}) // 静默降级
  }, [user])

  // 发送魔法链接
  const handleSendLink = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) return

    setSending(true)
    setSendError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/my-dao`,
      },
    })

    setSending(false)

    if (error) {
      setSendError(error.message)
    } else {
      setSent(true)
    }
  }, [email, supabase])

  // 退出登录
  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    setUser(null)
    setSessions([])
    setExpandedId(null)
    setSigningOut(false)
    router.refresh()
  }, [supabase, router])

  return (
    <main className="relative min-h-screen flex flex-col">
      <CloudBackground />
      <NavBar />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* 标题 */}
          <h1 className="text-2xl text-ink/80 text-center tracking-wider-title mb-2">
            我的道
          </h1>
          <p className="text-[13px] text-shadow-gray/50 text-center mb-10 tracking-wider">
            每一次问道，都是你与道的对话
          </p>

          {/* ===== 加载态 ===== */}
          {user === undefined && (
            <div className="text-center text-shadow-gray/40 text-sm tracking-wider">
              ...
            </div>
          )}

          {/* ===== 未登录：魔法链接表单 ===== */}
          {user === null && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-shadow-gray/50 tracking-wider text-center">
                输入邮箱，发送魔法链接，无需密码
              </p>

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSent(false)
                  setSendError('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendLink() }}
                placeholder="your@email.com"
                autoComplete="email"
                className="
                  w-full max-w-sm px-5 py-3 rounded-full
                  bg-cloud-white/60 border border-ridge-blue/10
                  text-ink/80 placeholder:text-shadow-gray/30
                  focus:outline-none focus:border-ridge-blue/25
                  transition-all text-sm text-center tracking-wider
                "
                disabled={sending || sent}
              />

              {sendError && (
                <p className="text-[12px] text-cinnabar/60 tracking-wider">{sendError}</p>
              )}

              <button
                type="button"
                onClick={handleSendLink}
                disabled={sending || sent || !email.trim()}
                className="
                  px-6 py-2.5 rounded-full
                  bg-ink/5 text-ink/70 hover:bg-ink/10
                  border border-ridge-blue/10 hover:border-ridge-blue/20
                  transition-all text-sm tracking-wider
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {sending ? '发送中...' : sent ? '已发送，请查收邮箱' : '发送魔法链接'}
              </button>
            </div>
          )}

          {/* ===== 已登录：历史记录 ===== */}
          {user && (
            <div className="flex flex-col gap-6">
              {/* 用户标识 */}
              <div className="text-center text-[13px] text-shadow-gray/40 tracking-wider">
                {user.email}
              </div>

              {/* 空状态 */}
              {sessions.length === 0 && (
                <p className="text-center text-shadow-gray/40 text-sm tracking-wider py-8">
                  还没有问道记录
                  <br />
                  <a href="/" className="text-ridge-blue/50 hover:text-ridge-blue/70 transition-colors">
                    去首页开始第一次对话
                  </a>
                </p>
              )}

              {/* 历史列表 */}
              <div className="flex flex-col gap-3">
                <AnimatePresence>
                  {sessions.map((s) => {
                    const isExpanded = expandedId === s.id
                    return (
                      <motion.div
                        key={s.id}
                        layout
                        className="border border-ridge-blue/08 rounded-2xl overflow-hidden transition-colors hover:border-ridge-blue/12"
                      >
                        {/* 问题摘要行 */}
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="w-full px-5 py-4 text-left flex items-start justify-between gap-3 hover:bg-cloud-white/40 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink/75 tracking-wider truncate">
                              {s.question}
                            </p>
                            <p className="text-[11px] text-shadow-gray/40 mt-1 tracking-wider">
                              {new Date(s.created_at).toLocaleDateString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <span className="text-shadow-gray/30 text-xs mt-0.5 shrink-0 tracking-wider">
                            {isExpanded ? '收起' : '回看'}
                          </span>
                        </button>

                        {/* 展开：AI 回答 */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="px-5 pb-5 border-t border-ridge-blue/05"
                          >
                            <p className="text-sm text-ink/70 leading-relaxed mt-4 tracking-wider">
                              {s.ai_response}
                            </p>
                            {s.follow_up_question && (
                              <p className="text-[13px] text-shadow-gray/50 mt-3 italic tracking-wider">
                                {s.follow_up_question}
                              </p>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* 退出登录 */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="
                  self-center px-4 py-2
                  text-[12px] text-shadow-gray/40 hover:text-ink/60
                  tracking-wider transition-colors
                "
              >
                {signingOut ? '退出中...' : '退出登录'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  )
}
