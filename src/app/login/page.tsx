'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="login-page-container">
      <div className="login-card-wrap">
        {/* Main Header Logo */}
        <div className="login-centered-logo">
          <Image
            src="/Kitchoralogo.png"
            alt="Kitchora Logo"
            width={280}
            height={280}
            className="login-top-logo"
            priority
          />
        </div>

        {/* Form Box */}
        <div className="login-form-box">
          <div className="login-form-header">
            <h1>Sign in</h1>
            <p>Enter your credentials to access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              id="loginBtn"
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" aria-label="Signing in…" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Multi-branch POS feature callout text (no box background) */}
          <p className="login-feature-text">
            Multi-branch POS, live kitchen display, inventory tracking, and daily reporting — built for restaurant operations.
          </p>
        </div>
      </div>
    </div>
  )
}
