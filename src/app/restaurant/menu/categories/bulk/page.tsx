'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bulkCreateMenuCategoriesAction } from '@/app/actions/restaurant-portal'

interface CategoryRow {
  id: string
  name: string
  description: string
  sort_order: number
}

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function newRow(index: number): CategoryRow {
  return { id: generateId(), name: '', description: '', sort_order: index + 1 }
}

export default function BulkCategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([newRow(0), newRow(1), newRow(2)])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function addRow() {
    setRows(prev => [...prev, newRow(prev.length)])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: keyof CategoryRow, value: string | number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validRows = rows.filter(r => r.name.trim())
    if (validRows.length === 0) {
      setError('Please enter at least one category name.')
      return
    }

    const formData = new FormData()
    validRows.forEach((row, i) => {
      formData.append(`categories[${i}][name]`, row.name.trim())
      formData.append(`categories[${i}][description]`, row.description.trim())
      formData.append(`categories[${i}][sort_order]`, String(row.sort_order))
    })
    formData.append('count', String(validRows.length))

    startTransition(async () => {
      try {
        await bulkCreateMenuCategoriesAction(formData)
        setSuccess(true)
      } catch (err: any) {
        setError(err?.message ?? 'Failed to save categories')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    padding: '0.55rem 0.75rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    color: '#0f172a',
    fontSize: '0.9rem',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  if (success) {
    return (
      <div className="ra-page" style={{ maxWidth: '700px' }}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#15803d', marginBottom: '0.5rem' }}>Categories Added!</h2>
          <p style={{ color: '#166534', marginBottom: '1.5rem' }}>Your menu categories have been saved successfully.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              className="btn-ghost"
              onClick={() => { setSuccess(false); setRows([newRow(0), newRow(1), newRow(2)]) }}
            >
              + Add More
            </button>
            <Link href="/restaurant/menu" className="btn-primary">Go to Menu →</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ra-page" style={{ maxWidth: '780px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Bulk Add Categories</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Add multiple menu categories at once — e.g. Starters, Biryani, Desserts, Beverages
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="ra-section" style={{ padding: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 90px 44px', gap: '0.75rem', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '1.9rem' }}>Category Name *</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order</span>
            <span />
          </div>

          {/* Data rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {rows.map((row, idx) => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 90px 44px', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, minWidth: '1.4rem', textAlign: 'right' }}>{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder="e.g. Biryani"
                    value={row.name}
                    onChange={e => updateRow(row.id, 'name', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Optional description"
                  value={row.description}
                  onChange={e => updateRow(row.id, 'description', e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  value={row.sort_order}
                  min={0}
                  onChange={e => updateRow(row.id, 'sort_order', Number(e.target.value))}
                  style={{ ...inputStyle, textAlign: 'center' }}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  style={{
                    padding: '0.5rem',
                    background: rows.length <= 1 ? '#f8fafc' : '#fef2f2',
                    border: `1px solid ${rows.length <= 1 ? '#e2e8f0' : '#fecaca'}`,
                    borderRadius: '0.5rem',
                    color: rows.length <= 1 ? '#cbd5e1' : '#dc2626',
                    cursor: rows.length <= 1 ? 'default' : 'pointer',
                    fontSize: '1rem',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '36px',
                    width: '36px',
                  }}
                  title="Remove row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add row button */}
          <button
            type="button"
            onClick={addRow}
            style={{
              marginTop: '0.85rem',
              padding: '0.55rem 1rem',
              background: '#f0f9ff',
              border: '1px dashed #7dd3fc',
              borderRadius: '0.5rem',
              color: '#0284c7',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.15s',
            }}
          >
            + Add Another Row
          </button>
        </div>

        {/* Tip box */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.75rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.83rem', color: '#92400e' }}>
          💡 <strong>Tip:</strong> Only rows with a Category Name will be saved. Empty rows are ignored automatically.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {rows.filter(r => r.name.trim()).length} of {rows.length} rows will be saved
          </span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending}
              style={{ minWidth: '160px' }}
            >
              {isPending ? 'Saving…' : `Save ${rows.filter(r => r.name.trim()).length} Categories`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
