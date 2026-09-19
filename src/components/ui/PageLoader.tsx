'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

function PageLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const prevPath = useRef(pathname + searchParams.toString())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const current = pathname + searchParams.toString()
    if (current !== prevPath.current) {
      setLoading(true)
      prevPath.current = current
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setLoading(false), 600)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="page-loader-bar" aria-hidden="true">
      <div className="page-loader-bar-inner" />
    </div>
  )
}

export default function PageLoader() {
  return (
    <Suspense fallback={null}>
      <PageLoaderInner />
    </Suspense>
  )
}
