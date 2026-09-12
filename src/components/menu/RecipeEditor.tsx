'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveRecipeAction, deleteRecipeAction } from '@/app/actions/recipes'

interface InventoryItem {
  id: string
  name: string
  unit: string
  low_stock_threshold: number
}

interface ExistingIngredient {
  inventory_item_id: string
  quantity: number
  unit: string
  notes?: string | null
}

interface Props {
  menuItem: {
    id: string
    name: string
    price: number
  }
  inventoryItems: InventoryItem[]
  existingRecipe: {
    id: string
    notes: string | null
  } | null
  existingItems: ExistingIngredient[]
}

interface IngredientRow {
  inventory_item_id: string
  quantity: number | string
  unit: string
  notes: string
}

export default function RecipeEditor({ menuItem, inventoryItems, existingRecipe, existingItems }: Props) {
  const [rows, setRows] = useState<IngredientRow[]>(
    existingItems.length > 0
      ? existingItems.map(i => ({
          inventory_item_id: i.inventory_item_id,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes ?? '',
        }))
      : inventoryItems.length > 0
      ? [{ inventory_item_id: inventoryItems[0].id, quantity: '0.1', unit: inventoryItems[0].unit, notes: '' }]
      : []
  )

  const [testServings, setTestServings] = useState(3)

  const handleAddRow = () => {
    if (inventoryItems.length === 0) return
    const defaultItem = inventoryItems[0]
    setRows(prev => [
      ...prev,
      { inventory_item_id: defaultItem.id, quantity: '0.1', unit: defaultItem.unit, notes: '' }
    ])
  }

  const handleRemoveRow = (index: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index: number, itemId: string) => {
    const selected = inventoryItems.find(i => i.id === itemId)
    setRows(prev => prev.map((r, idx) => {
      if (idx === index) {
        return {
          ...r,
          inventory_item_id: itemId,
          unit: selected?.unit ?? r.unit,
        }
      }
      return r
    }))
  }

  const handleQtyChange = (index: number, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === index ? { ...r, quantity: val } : r))
  }

  const handleNotesChange = (index: number, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === index ? { ...r, notes: val } : r))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <form action={saveRecipeAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="menu_item_id" value={menuItem.id} />
        <input type="hidden" name="ingredients_json" value={JSON.stringify(rows)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.25rem' }}>
              Ingredient Bill of Materials (BOM)
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Specify the exact quantity of raw materials consumed whenever 1 portion of <strong style={{ color: '#0f172a' }}>{menuItem.name}</strong> is ordered at POS.
            </p>
          </div>
          <button type="button" onClick={handleAddRow} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}>
            + Add Ingredient
          </button>
        </div>

        {inventoryItems.length === 0 ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1.25rem', borderRadius: '0.75rem', color: '#b45309', fontSize: '0.9rem' }}>
            ⚠️ You haven&apos;t added any items to your Inventory yet.
            <div style={{ marginTop: '0.5rem' }}>
              <Link href="/restaurant/inventory/new" style={{ color: '#b45309', fontWeight: 600, textDecoration: 'underline' }}>
                Add items (e.g. Chicken, Vegetables, Oil) in Inventory first →
              </Link>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '2px dashed #cbd5e1' }}>
            <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem' }}>
              No ingredients configured for this dish yet.
            </p>
            <button type="button" onClick={handleAddRow} className="btn-primary">
              + Add First Ingredient
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rows.map((row, idx) => {
              const selectedItem = inventoryItems.find(i => i.id === row.inventory_item_id)
              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 2fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                  }}
                >
                  {/* Select Inventory Item */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Raw Ingredient
                    </label>
                    <select
                      value={row.inventory_item_id}
                      onChange={e => handleItemChange(idx, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                      }}
                    >
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.name} (Unit: {inv.unit})</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity per portion */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Per 1 Dish
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      value={row.quantity}
                      onChange={e => handleQtyChange(idx, e.target.value)}
                      placeholder="e.g. 0.100"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Unit
                    </label>
                    <input
                      type="text"
                      value={row.unit}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        color: '#475569',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={e => handleNotesChange(idx, e.target.value)}
                      placeholder="e.g. Boneless, chopped"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        color: '#0f172a',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  {/* Remove Button */}
                  <div style={{ paddingTop: '1.1rem' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '0.3rem',
                      }}
                      title="Remove ingredient"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Live Simulation Simulator */}
        {rows.length > 0 && (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#6d28d9', fontSize: '0.9rem' }}>
                💡 POS Live Stock Deduction Simulation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                <span>Simulate selling:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={testServings}
                  onChange={e => setTestServings(Number(e.target.value) || 1)}
                  style={{
                    width: '60px',
                    padding: '0.2rem 0.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.3rem',
                    color: '#0f172a',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                />
                <span>portions</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              {rows.map((row, idx) => {
                const selected = inventoryItems.find(i => i.id === row.inventory_item_id)
                const perPortion = Number(row.quantity) || 0
                const totalConsumed = (perPortion * testServings).toFixed(3)
                return (
                  <div key={idx} style={{ color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>• {selected?.name ?? 'Item'}:</span>
                    <span style={{ fontFamily: 'monospace', color: '#b45309', fontWeight: 700 }}>
                      -{totalConsumed} {row.unit} automatically deducted
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <div>
            {existingRecipe && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Delete this recipe? Stock will no longer auto-deduct for this dish.')) {
                    await deleteRecipeAction(menuItem.id)
                  }
                }}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: '0.4rem',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete Recipe
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={inventoryItems.length === 0}>
              Save Recipe &amp; Enable Auto-Deduct
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
