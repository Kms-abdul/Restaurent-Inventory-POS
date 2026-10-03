'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bulkCreateMenuItemsAction } from '@/app/actions/restaurant-portal'

interface ItemRow {
  id: string
  name: string
  category_id: string
  price: string
  description: string
}

interface Category {
  id: string
  name: string
}

interface Props {
  categories: Category[]
  defaultCategoryId: string
}

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function newRow(categoryId: string): ItemRow {
  return { id: generateId(), name: '', category_id: categoryId, price: '', description: '' }
}

export default function BulkItemsForm({ categories, defaultCategoryId }: Props) {
  // Global category applied to all rows at once
  const [globalCategoryId, setGlobalCategoryId] = useState(defaultCategoryId)

  const [rows, setRows] = useState<ItemRow[]>([
    newRow(defaultCategoryId),
    newRow(defaultCategoryId),
    newRow(defaultCategoryId),
  ])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  // When user picks a global category, apply it to ALL rows
  function applyGlobalCategory(catId: string) {
    setGlobalCategoryId(catId)
    setRows(prev => prev.map(r => ({ ...r, category_id: catId })))
  }

  function addRow() {
    setRows(prev => [...prev, newRow(globalCategoryId)])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: keyof ItemRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validRows = rows.filter(r => r.name.trim() && r.category_id && r.price)
    if (validRows.length === 0) {
      setError('Please fill in at least one item with name, category, and price.')
      return
    }

    for (const row of validRows) {
      const p = Number(row.price)
      if (isNaN(p) || p < 0) {
        setError(`Invalid price for item "${row.name}".`)
        return
      }
    }

    const formData = new FormData()
    validRows.forEach((row, i) => {
      formData.append(`items[${i}][name]`, row.name.trim())
      formData.append(`items[${i}][category_id]`, row.category_id)
      formData.append(`items[${i}][price]`, row.price)
      formData.append(`items[${i}][description]`, row.description.trim())
    })
    formData.append('count', String(validRows.length))

    startTransition(async () => {
      try {
        await bulkCreateMenuItemsAction(formData)
        setSavedCount(validRows.length)
      } catch (err: any) {
        setError(err?.message ?? 'Failed to save items')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    padding: '0.55rem 0.6rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    color: '#0f172a',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const validCount = rows.filter(r => r.name.trim() && r.category_id && r.price).length
  const globalCatName = categories.find(c => c.id === globalCategoryId)?.name ?? ''

  if (savedCount !== null) {
    return (
      <div className="ra-page" style={{ maxWidth: '900px' }}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#15803d', marginBottom: '0.5rem' }}>{savedCount} Items Added!</h2>
          <p style={{ color: '#166534', marginBottom: '1.5rem' }}>Your menu items have been saved successfully.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              className="btn-ghost"
              onClick={() => {
                setSavedCount(null)
                setRows([newRow(globalCategoryId), newRow(globalCategoryId), newRow(globalCategoryId)])
              }}
            >
              + Add More Items
            </button>
            <Link href="/restaurant/menu" className="btn-primary">Go to Menu →</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ra-page" style={{ maxWidth: '950px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Bulk Add Menu Items</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Select a category once at the top — all items will be saved under it
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Global Category Picker ── */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
          border: '2px solid #c7d2fe',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '0 0 auto' }}>
            <span style={{ fontSize: '1.3rem' }}>📂</span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category for All Items</div>
              <div style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '0.1rem' }}>Applies instantly to every row below</div>
            </div>
          </div>
          <select
            value={globalCategoryId}
            onChange={e => applyGlobalCategory(e.target.value)}
            style={{
              flex: '1 1 260px',
              padding: '0.7rem 1rem',
              background: '#ffffff',
              border: '2px solid #818cf8',
              borderRadius: '0.6rem',
              color: '#1e1b4b',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              maxWidth: '380px',
            }}
          >
            <option value="">— Select a Category —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {globalCatName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: '#4f46e5', color: '#fff',
              borderRadius: '2rem', padding: '0.35rem 0.9rem',
              fontSize: '0.85rem', fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              ✓ {globalCatName}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="ra-section" style={{ padding: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 100px 2.5fr 44px', gap: '0.6rem', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', minWidth: '480px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '1.9rem' }}>Item Name *</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price ₹ *</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
            <span />
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: '480px' }}>
            {rows.map((row, idx) => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 100px 2.5fr 44px', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, minWidth: '1.4rem', textAlign: 'right' }}>{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder="e.g. Veg Noodles"
                    value={row.name}
                    onChange={e => updateRow(row.id, 'name', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <input
                  type="number"
                  placeholder="150"
                  step="0.01"
                  min="0"
                  value={row.price}
                  onChange={e => updateRow(row.id, 'price', e.target.value)}
                  style={{ ...inputStyle, textAlign: 'right' }}
                />
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={row.description}
                  onChange={e => updateRow(row.id, 'description', e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  style={{
                    padding: '0.4rem',
                    background: rows.length <= 1 ? '#f8fafc' : '#fef2f2',
                    border: `1px solid ${rows.length <= 1 ? '#e2e8f0' : '#fecaca'}`,
                    borderRadius: '0.5rem',
                    color: rows.length <= 1 ? '#cbd5e1' : '#dc2626',
                    cursor: rows.length <= 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '36px', width: '36px', fontSize: '0.9rem',
                  }}
                  title="Remove row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

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
              minWidth: '480px',
            }}
          >
            + Add Another Row
          </button>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.75rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.83rem', color: '#92400e' }}>
          💡 <strong>Tip:</strong> All items will be saved under <strong>{globalCatName || 'the selected category'}</strong>. Only rows with a Name and Price are saved. Empty rows are ignored.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {validCount} of {rows.length} rows will be saved
            {globalCatName && <> → <strong style={{ color: '#4f46e5' }}>{globalCatName}</strong></>}
          </span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending || !globalCategoryId}
              style={{ minWidth: '160px', opacity: !globalCategoryId ? 0.6 : 1, cursor: !globalCategoryId ? 'not-allowed' : 'pointer' }}
            >
              {isPending ? 'Saving…' : !globalCategoryId ? 'Select a Category First' : `Save ${validCount} Items`}
            </button>
          </div>
        </div>

        {!globalCategoryId && (
          <p style={{ textAlign: 'right', fontSize: '0.78rem', color: '#dc2626', marginTop: '0.4rem' }}>
            ↑ Please select a category at the top before saving
          </p>
        )}
      </form>
    </div>
  )
}
