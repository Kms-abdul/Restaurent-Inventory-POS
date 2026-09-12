'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRestaurant } from '@/app/actions/restaurants'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function CreateRestaurantPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')

  const handleRestaurantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSlug(slugify(val))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const result = await createRestaurant(fd)
        router.push(`/super-admin/dashboard`)
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <a href="/super-admin/restaurants" className="link-muted small">← Back to Restaurants</a>
          <h1>Create Restaurant</h1>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-section">
            <h2 className="form-section-title">Restaurant Details</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="restaurant_name">Restaurant Name *</label>
                <input
                  id="restaurant_name"
                  name="restaurant_name"
                  type="text"
                  required
                  placeholder="e.g. Pista House"
                  onChange={handleRestaurantNameChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="slug">URL Slug *</label>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="pista-house"
                  pattern="[a-z0-9-]+"
                />
                <span className="form-hint">
                  Used in QR code URLs: /pista-house/hyderabad
                </span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Restaurant Administrator</h2>
            <p className="form-section-desc">
              This person will be the Restaurant Admin — they can manage branches,
              menu, inventory, and users.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="admin_name">Admin Name *</label>
                <input
                  id="admin_name"
                  name="admin_name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="form-group">
                <label htmlFor="admin_email">Admin Email *</label>
                <input
                  id="admin_email"
                  name="admin_email"
                  type="email"
                  required
                  placeholder="admin@pistahouse.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="admin_password">Initial Password *</label>
                <input
                  id="admin_password"
                  name="admin_password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">First Branch</h2>
            <p className="form-section-desc">
              Create the first branch for this restaurant. More branches can be
              added later by the Restaurant Admin.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="branch_name">Branch Name *</label>
                <input
                  id="branch_name"
                  name="branch_name"
                  type="text"
                  required
                  defaultValue="Main Branch"
                  placeholder="e.g. Hyderabad"
                />
              </div>
              <div className="form-group">
                <label htmlFor="branch_city">City</label>
                <input
                  id="branch_city"
                  name="branch_city"
                  type="text"
                  placeholder="e.g. Hyderabad"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="form-error" role="alert">{error}</div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              id="submitCreateRestaurant"
              type="submit"
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'Creating…' : 'Create Restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
