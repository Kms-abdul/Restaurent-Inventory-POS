'use client'

import { useState } from 'react'
import { submitDailyEODAuditAction, type DailyLedgerItem } from '@/app/actions/inventory-daily'

interface Props {
  branchId: string
  branchName: string
  date: string
  items: DailyLedgerItem[]
  hasEodAudit: boolean
  auditNotes?: string
}

export default function StockAuditForm({
  branchId,
  branchName,
  date,
  items,
  hasEodAudit,
  auditNotes: initialAuditNotes,
}: Props) {
  const [counts, setCounts] = useState<{ [id: string]: number | '' }>(
    Object.fromEntries(items.map(i => [i.inventory_item_id, i.actual_qty]))
  )
  const [reasons, setReasons] = useState<{ [id: string]: string }>(
    Object.fromEntries(
      items.map(i => [i.inventory_item_id, i.adjustment_reason || 'wastage'])
    )
  )
  const [notes, setNotes] = useState<{ [id: string]: string }>(
    Object.fromEntries(items.map(i => [i.inventory_item_id, i.notes || '']))
  )
  const [generalNotes, setGeneralNotes] = useState(initialAuditNotes || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleActualChange = (id: string, val: string) => {
    setCounts(prev => ({
      ...prev,
      [id]: val === '' ? '' : parseFloat(val),
    }))
  }

  const handleReasonChange = (id: string, val: string) => {
    setReasons(prev => ({ ...prev, [id]: val }))
  }

  const handleNotesChange = (id: string, val: string) => {
    setNotes(prev => ({ ...prev, [id]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const auditData = items.map(item => {
      const actualVal = counts[item.inventory_item_id]
      const actual =
        typeof actualVal === 'number' && !isNaN(actualVal)
          ? actualVal
          : item.expected_closing
      const variance = Number((actual - item.expected_closing).toFixed(3))
      return {
        inventory_item_id: item.inventory_item_id,
        expected_qty: item.expected_closing,
        actual_qty: actual,
        variance_qty: variance,
        adjustment_reason:
          Math.abs(variance) > 0.001
            ? reasons[item.inventory_item_id] || 'wastage'
            : 'none',
        notes: notes[item.inventory_item_id] || '',
      }
    })

    try {
      await submitDailyEODAuditAction({
        branch_id: branchId,
        date: date,
        notes: generalNotes,
        items: auditData,
      })
      setSubmitted(true)
    } catch (err: any) {
      alert('Error submitting daily audit: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="ra-section"
        style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>
          Daily EOD Stock Audit Saved Successfully
        </h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
          Physical closing counts for <strong>{date}</strong> have been recorded to the ledger.
          These closing balances will automatically serve as the <strong>Opening Stock</strong> for the next day.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            window.location.reload()
          }}
          className="btn-primary"
        >
          View Updated Ledger
        </button>
      </div>
    )
  }

  // Count items with discrepancies
  const discrepancies = items.filter(item => {
    const actualVal = counts[item.inventory_item_id]
    const actual =
      typeof actualVal === 'number' && !isNaN(actualVal)
        ? actualVal
        : item.expected_closing
    return Math.abs(actual - item.expected_closing) > 0.001
  })

  const isToday = new Date().toISOString().slice(0, 10) === date

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Daily Audit Status Header */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>
              🏪 {branchName}
            </span>
            <span
              style={{
                background: '#f1f5f9',
                color: '#334155',
                padding: '0.2rem 0.6rem',
                borderRadius: '0.35rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              📅 {date} {isToday ? '(Today)' : ''}
            </span>
            {hasEodAudit ? (
              <span
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                ✓ EOD Audit Confirmed
              </span>
            ) : (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                ⏳ EOD Count Pending
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Today&apos;s closing stock automatically becomes tomorrow&apos;s opening stock. Enter the physical shelf count below to balance the ledger.
          </div>
        </div>

        {discrepancies.length > 0 ? (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '0.5rem',
              padding: '0.6rem 1.2rem',
              textAlign: 'right',
            }}
          >
            <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠️ {discrepancies.length} Variance{discrepancies.length !== 1 ? 's' : ''} Detected
            </div>
            <div style={{ fontSize: '0.75rem', color: '#78350f' }}>
              Requires adjustment reason
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.5rem',
              padding: '0.6rem 1.2rem',
              textAlign: 'right',
            }}
          >
            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.9rem' }}>
              ✓ All Physical Counts Match Expected
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
              Ledger is fully balanced
            </div>
          </div>
        )}
      </div>

      {/* Day-wise Stock Audit Table */}
      <div
        className="ra-section"
        style={{
          padding: 0,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Item</th>
                <th title="Previous Day Closing Stock">🌅 Opening Stock</th>
                <th title="Stock In / Purchases today">📥 Stock Added (+)</th>
                <th title="Auto-deducted from POS orders today">🍳 Consumed (-)</th>
                <th title="Waste / Spoilage logged today">🗑️ Wastage (-)</th>
                <th title="Opening + In - Consumed - Wastage">Expected Closing</th>
                <th style={{ width: '160px' }}>Physical Closing Count *</th>
                <th>Variance (Difference)</th>
                <th>Variance Reason</th>
                <th>Item Note</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="sa-empty">
                    No active inventory items found for this restaurant.
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const actualVal = counts[item.inventory_item_id]
                  const actual =
                    typeof actualVal === 'number' && !isNaN(actualVal)
                      ? actualVal
                      : item.expected_closing
                  const variance = Number((actual - item.expected_closing).toFixed(3))
                  const hasDiscrepancy = Math.abs(variance) > 0.001

                  return (
                    <tr
                      key={item.inventory_item_id}
                      style={{
                        background: hasDiscrepancy
                          ? variance < 0
                            ? '#fff5f5'
                            : '#eff6ff'
                          : 'transparent',
                      }}
                    >
                      {/* Name & Unit */}
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                          {item.name}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Unit: {item.unit}
                        </div>
                      </td>

                      {/* Opening Stock */}
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {item.opening_stock.toFixed(2)} {item.unit}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Yesterday EOD</div>
                      </td>

                      {/* Stock Added */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: item.stock_in > 0 ? '#16a34a' : '#94a3b8',
                          }}
                        >
                          {item.stock_in > 0 ? `+${item.stock_in.toFixed(2)}` : '0.00'} {item.unit}
                        </span>
                      </td>

                      {/* Consumed */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: item.stock_consumed > 0 ? '#d97706' : '#94a3b8',
                          }}
                        >
                          {item.stock_consumed > 0 ? `-${item.stock_consumed.toFixed(2)}` : '0.00'} {item.unit}
                        </span>
                      </td>

                      {/* Wastage */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: item.wastage > 0 ? '#dc2626' : '#94a3b8',
                          }}
                        >
                          {item.wastage > 0 ? `-${item.wastage.toFixed(2)}` : '0.00'} {item.unit}
                        </span>
                      </td>

                      {/* Expected Closing */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: '#0f172a',
                          }}
                        >
                          {item.expected_closing.toFixed(2)} {item.unit}
                        </span>
                      </td>

                      {/* Actual Physical Count Input */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={actualVal}
                            onChange={e =>
                              handleActualChange(item.inventory_item_id, e.target.value)
                            }
                            style={{
                              width: '100px',
                              padding: '0.45rem 0.5rem',
                              background: '#ffffff',
                              border: hasDiscrepancy ? '2px solid #d97706' : '1px solid #cbd5e1',
                              borderRadius: '0.4rem',
                              color: '#0f172a',
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                          />
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {item.unit}
                          </span>
                        </div>
                      </td>

                      {/* Variance */}
                      <td>
                        {!hasDiscrepancy ? (
                          <span
                            style={{
                              color: '#16a34a',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            ✓ 0.00 (Match)
                          </span>
                        ) : (
                          <div>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: '1rem',
                                color: variance < 0 ? '#dc2626' : '#2563eb',
                              }}
                            >
                              {variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)}{' '}
                              {item.unit}
                            </span>
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: variance < 0 ? '#dc2626' : '#2563eb',
                                fontWeight: 700,
                              }}
                            >
                              {variance < 0 ? '⚠️ SHORT / LOSS' : '📈 SURPLUS'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Variance Reason */}
                      <td>
                        {hasDiscrepancy ? (
                          <select
                            value={reasons[item.inventory_item_id] || 'wastage'}
                            onChange={e =>
                              handleReasonChange(item.inventory_item_id, e.target.value)
                            }
                            style={{
                              padding: '0.35rem 0.5rem',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.4rem',
                              color: '#0f172a',
                              fontSize: '0.8rem',
                            }}
                          >
                            <option value="wastage">Kitchen Prep Wastage</option>
                            <option value="spoilage">Spoilage / Expired</option>
                            <option value="other">Unaccounted / Theft</option>
                            <option value="counting_error">Staff Counting Error</option>
                          </select>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. spilled 500g"
                          value={notes[item.inventory_item_id] || ''}
                          onChange={e =>
                            handleNotesChange(item.inventory_item_id, e.target.value)
                          }
                          style={{
                            width: '130px',
                            padding: '0.35rem 0.5rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.4rem',
                            color: '#0f172a',
                            fontSize: '0.8rem',
                          }}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* General Notes and Submit Action */}
      <div
        className="ra-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          padding: '1.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
          Daily EOD Audit Remarks / Shift Handover Notes
        </label>
        <textarea
          rows={2}
          value={generalNotes}
          onChange={e => setGeneralNotes(e.target.value)}
          placeholder="Closing remarks for manager, storekeeper, or tomorrow's opening shift..."
          style={{
            padding: '0.75rem 1rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            color: '#0f172a',
            fontSize: '0.9rem',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Saving this audit will lock the physical closing count for <strong>{date}</strong> and update tomorrow&apos;s opening inventory.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isSubmitting ? (
              'Confirming & Saving...'
            ) : (
              `✓ Save EOD Stock Audit (${date})`
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
