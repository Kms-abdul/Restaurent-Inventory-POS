'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Check if dismissed recently (don't show for 7 days)
    const dismissedAt = localStorage.getItem('pwa-install-dismissed')
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) return
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a short delay so user sees the app first
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // If iOS and not installed, show custom prompt after delay
    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 3000)
    }

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }

    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setShowIOSGuide(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  if (isInstalled || !showPrompt) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 99998,
          animation: 'pwa-fade-in 0.3s ease-out',
        }}
        onClick={handleDismiss}
      />

      {/* Install Prompt */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: 'calc(100% - 32px)',
          maxWidth: '420px',
          background: 'linear-gradient(135deg, #0d1b2a 0%, #1b2d45 50%, #0d2818 100%)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(26, 122, 76, 0.3)',
          animation: 'pwa-slide-up 0.4s ease-out',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {showIOSGuide ? (
          // iOS Installation Guide
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Install on iPhone/iPad
              </h3>
              <button
                onClick={handleDismiss}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '20px',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { step: '1', icon: '🔗', text: 'Tap the Share button at the bottom of Safari' },
                { step: '2', icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
                { step: '3', icon: '✅', text: 'Tap "Add" to confirm installation' },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #1a7a4c, #2d9b6a)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span style={{ color: '#e5e7eb', fontSize: '14px', lineHeight: '1.4' }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleDismiss}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                color: '#9ca3af',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Got it!
            </button>
          </div>
        ) : (
          // Standard Install Prompt
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <img
                src="/Kitchoralogo.png"
                alt="Kitchora"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  objectFit: 'cover',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              />
              <div>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>
                  Install Kitchora
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                  Get the full app experience on your device
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}
            >
              {['⚡ Fast Access', '📱 Full Screen', '🔔 Notifications', '📶 Works Offline'].map((feature) => (
                <span
                  key={feature}
                  style={{
                    fontSize: '12px',
                    color: '#a7f3d0',
                    background: 'rgba(26, 122, 76, 0.2)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid rgba(26, 122, 76, 0.3)',
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  color: '#9ca3af',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Not Now
              </button>
              <button
                onClick={handleInstall}
                style={{
                  flex: 2,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #1a7a4c, #22a664)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(26, 122, 76, 0.4)',
                  transition: 'all 0.2s',
                }}
              >
                📲 Install App
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pwa-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pwa-slide-up {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(100px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  )
}
