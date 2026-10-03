'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { bulkCreateMenuItemsAction } from '@/app/actions/restaurant-portal'
import * as XLSX from 'xlsx'

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
  const [globalCategoryId, setGlobalCategoryId] = useState(defaultCategoryId)
  const [rows, setRows] = useState<ItemRow[]>([newRow(defaultCategoryId), newRow(defaultCategoryId), newRow(defaultCategoryId)])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [importMode, setImportMode] = useState<'manual' | 'excel'>('manual')
  const [dragOver, setDragOver] = useState(false)
  const [importPreview, setImportPreview] = useState<{ total: number; matched: number; unmatched: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build a case-insensitive name→id map for categories
  const categoryMap = Object.fromEntries(
    categories.map(c => [c.name.trim().toLowerCase(), c.id])
  )

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

  // ── Excel import ──────────────────────────────────────────────────────
  function parseExcelFile(file: File) {
    setError(null)
    setImportPreview(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (jsonRows.length === 0) {
          setError('The Excel file appears to be empty.')
          return
        }

        // Auto-detect column names (case-insensitive)
        const firstRow = jsonRows[0]
        const keys = Object.keys(firstRow)
        const findCol = (...candidates: string[]) =>
          keys.find(k => candidates.some(c => k.trim().toLowerCase() === c)) ?? null

        const nameCol = findCol('name', 'item name', 'item', 'dish', 'product')
        const catCol  = findCol('category', 'category name', 'cat', 'section', 'type')
        const priceCol = findCol('price', 'rate', 'amount', 'mrp', 'cost')
        const descCol  = findCol('description', 'desc', 'notes', 'details')

        if (!nameCol) {
          setError('Could not find a "Name" column. Make sure your Excel has a column called Name, Item Name, or Dish.')
          return
        }
        if (!priceCol) {
          setError('Could not find a "Price" column. Make sure your Excel has a column called Price, Rate, or Amount.')
          return
        }

        const unmatched: string[] = []
        const parsed: ItemRow[] = []

        for (const r of jsonRows) {
          const name = String(r[nameCol] ?? '').trim()
          if (!name) continue

          const price = String(r[priceCol] ?? '').replace(/[^0-9.]/g, '')
          const description = descCol ? String(r[descCol] ?? '').trim() : ''

          // Try to match category from Excel first, then fall back to global
          let catId = globalCategoryId
          if (catCol) {
            const catName = String(r[catCol] ?? '').trim().toLowerCase()
            if (catName && categoryMap[catName]) {
              catId = categoryMap[catName]
            } else if (catName && !categoryMap[catName]) {
              if (!unmatched.includes(catName)) unmatched.push(catName)
            }
          }

          parsed.push({ id: generateId(), name, category_id: catId, price, description })
        }

        if (parsed.length === 0) {
          setError('No valid rows found in the Excel file.')
          return
        }

        setRows(parsed)
        setImportPreview({
          total: parsed.length,
          matched: parsed.filter(r => r.category_id).length,
          unmatched,
        })
        setImportMode('manual') // Switch to table view to review
      } catch (err: any) {
        setError('Failed to read Excel file. Make sure it is a valid .xlsx or .xls file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseExcelFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseExcelFile(file)
  }

  // ── Submit ─────────────────────────────────────────────────────────────
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
      if (isNaN(p) || p < 0) { setError(`Invalid price for "${row.name}".`); return }
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
    padding: '0.5rem 0.6rem',
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

  // ── Success screen ─────────────────────────────────────────────────────
  if (savedCount !== null) {
    return (
      <div className="ra-page" style={{ maxWidth: '700px' }}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#15803d', marginBottom: '0.5rem' }}>{savedCount} Items Saved!</h2>
          <p style={{ color: '#166534', marginBottom: '1.5rem' }}>Your menu items have been added successfully.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-ghost" onClick={() => { setSavedCount(null); setRows([newRow(globalCategoryId), newRow(globalCategoryId), newRow(globalCategoryId)]); setImportPreview(null) }}>
              + Add More
            </button>
            <Link href="/restaurant/menu" className="btn-primary">Go to Menu →</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ra-page" style={{ maxWidth: '1000px' }}>
      {/* ── Page header ── */}
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Bulk Add Menu Items</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Type items manually or import directly from your Excel file
          </p>
        </div>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.6rem' }}>
          <button
            type="button"
            onClick={() => setImportMode('manual')}
            style={{
              padding: '0.45rem 1rem', borderRadius: '0.45rem', border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
              background: importMode === 'manual' ? '#ffffff' : 'transparent',
              color: importMode === 'manual' ? '#1e40af' : '#64748b',
              boxShadow: importMode === 'manual' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >✏️ Manual Entry</button>
          <button
            type="button"
            onClick={() => setImportMode('excel')}
            style={{
              padding: '0.45rem 1rem', borderRadius: '0.45rem', border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
              background: importMode === 'excel' ? '#ffffff' : 'transparent',
              color: importMode === 'excel' ? '#15803d' : '#64748b',
              boxShadow: importMode === 'excel' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >📊 Import Excel</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Import preview banner ── */}
      {importPreview && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#166534', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>✅ <strong>{importPreview.total} rows</strong> imported from Excel.</span>
          {importPreview.unmatched.length > 0 && (
            <span style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.4rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>
              ⚠️ Unrecognised categories: <strong>{importPreview.unmatched.join(', ')}</strong> — rows assigned to global category
            </span>
          )}
          <button type="button" onClick={() => setImportPreview(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── EXCEL IMPORT PANEL ── */}
        {importMode === 'excel' && (
          <div style={{ marginBottom: '1.25rem' }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4f46e5' : '#a5b4fc'}`,
                background: dragOver ? '#eef2ff' : '#f5f3ff',
                borderRadius: '1rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4338ca', marginBottom: '0.4rem' }}>
                Drop your Excel file here
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' }}>
                or click to browse — supports .xlsx, .xls, .csv
              </div>
              <div style={{
                display: 'inline-block',
                padding: '0.5rem 1.25rem',
                background: '#4f46e5', color: '#fff',
                borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
              }}>
                Choose File
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </div>

            {/* Column guide */}
            <div style={{ marginTop: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '0.6rem' }}>📋 Expected Excel columns (order doesn't matter):</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {[
                  { col: 'Name', req: true, hint: 'Item / Dish / Product' },
                  { col: 'Category', req: false, hint: 'Noodles / Soup / Drinks' },
                  { col: 'Price', req: true, hint: 'Rate / Amount / MRP' },
                  { col: 'Description', req: false, hint: 'Notes / Details' },
                ].map(({ col, req, hint }) => (
                  <div key={col} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.83rem' }}>
                      {col} {req && <span style={{ color: '#dc2626' }}>*</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Also accepts: {hint}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.6rem' }}>
                💡 If your Excel has a Category column, items will be auto-matched to existing categories. Unmatched rows fall back to the global category you select below.
              </div>
            </div>
          </div>
        )}

        {/* ── Global Category Picker (always visible) ── */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
          border: '2px solid #c7d2fe',
          borderRadius: '1rem',
          padding: '1.1rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '0 0 auto' }}>
            <span style={{ fontSize: '1.2rem' }}>📂</span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {importMode === 'excel' ? 'Fallback / Default Category' : 'Category for All Items'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: '0.1rem' }}>
                {importMode === 'excel' ? 'Used when Excel category is not recognised' : 'Applies instantly to every row below'}
              </div>
            </div>
          </div>
          <select
            value={globalCategoryId}
            onChange={e => applyGlobalCategory(e.target.value)}
            style={{
              flex: '1 1 240px', maxWidth: '360px',
              padding: '0.65rem 1rem',
              background: '#ffffff', border: '2px solid #818cf8',
              borderRadius: '0.6rem', color: '#1e1b4b',
              fontSize: '1rem', fontWeight: 700, cursor: 'pointer', outline: 'none',
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
              borderRadius: '2rem', padding: '0.3rem 0.85rem',
              fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              ✓ {globalCatName}
            </div>
          )}
        </div>

        {/* ── ITEMS TABLE (manual + post-import review) ── */}
        {(importMode === 'manual' || rows.some(r => r.name)) && (
          <div className="ra-section" style={{ padding: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflowX: 'auto' }}>
            {importPreview && (
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  📊 Imported {rows.length} rows — review and edit below before saving
                </div>
                <button
                  type="button"
                  onClick={() => { setRows([newRow(globalCategoryId), newRow(globalCategoryId), newRow(globalCategoryId)]); setImportPreview(null) }}
                  style={{ fontSize: '0.78rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✕ Clear & Start Fresh
                </button>
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.8fr 100px 2fr 44px', gap: '0.6rem', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', minWidth: '520px' }}>
              {['Item Name *', 'Category', 'Price ₹ *', 'Description', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.73rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: i === 0 ? '1.9rem' : 0 }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '520px' }}>
              {rows.map((row, idx) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.8fr 100px 2fr 44px', gap: '0.6rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: 600, minWidth: '1.4rem', textAlign: 'right' }}>{idx + 1}.</span>
                    <input type="text" placeholder="e.g. Veg Noodles" value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} style={inputStyle} />
                  </div>
                  <select
                    value={row.category_id}
                    onChange={e => updateRow(row.id, 'category_id', e.target.value)}
                    style={{ ...inputStyle, fontWeight: row.category_id ? 600 : 400, color: row.category_id ? '#0f172a' : '#94a3b8' }}
                  >
                    <option value="">— Select —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" placeholder="150" step="0.01" min="0" value={row.price} onChange={e => updateRow(row.id, 'price', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                  <input type="text" placeholder="Optional notes" value={row.description} onChange={e => updateRow(row.id, 'description', e.target.value)} style={inputStyle} />
                  <button
                    type="button" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}
                    style={{
                      padding: '0.4rem', height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                      background: rows.length <= 1 ? '#f8fafc' : '#fef2f2',
                      border: `1px solid ${rows.length <= 1 ? '#e2e8f0' : '#fecaca'}`,
                      borderRadius: '0.5rem',
                      color: rows.length <= 1 ? '#cbd5e1' : '#dc2626',
                      cursor: rows.length <= 1 ? 'default' : 'pointer',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addRow} style={{ marginTop: '0.85rem', padding: '0.55rem 1rem', background: '#f0f9ff', border: '1px dashed #7dd3fc', borderRadius: '0.5rem', color: '#0284c7', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', width: '100%', minWidth: '520px' }}>
              + Add Another Row
            </button>
          </div>
        )}

        {/* Tip */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.7rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e' }}>
          💡 Only rows with <strong>Name</strong> and <strong>Price</strong> will be saved. Empty rows are ignored. You can edit any row before saving.
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {validCount} of {rows.length} rows will be saved
            {globalCatName && <> → <strong style={{ color: '#4f46e5' }}>default: {globalCatName}</strong></>}
          </span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
            <button
              type="submit" className="btn-primary" disabled={isPending}
              style={{ minWidth: '160px' }}
            >
              {isPending ? 'Saving…' : `Save ${validCount} Items`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
