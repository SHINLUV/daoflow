'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { announceAuthChange } from '@/lib/auth/browser'
import { safeNext } from '@/lib/auth/safeNext'
import { AuthPageFrame } from '../_components/AuthPageFrame'

export default function AuthCompletePage() {
  return <Suspense fallback={<AuthPageFrame title="登录完成" intro="正在安全恢复账户会话。" />}><AuthCompleteContent /></Suspense>
}

function AuthCompleteContent() {
  const params = useSearchParams()
  useEffect(() => {
    announceAuthChange()
    window.location.replace(safeNext(params.get('next')))
  }, [params])
  return <AuthPageFrame title="登录完成" intro="正在安全回到 DaoFlow。" />
}
