'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRESETS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d',        label: '7 Days' },
  { key: '30d',       label: '30 Days' },
  { key: 'all',       label: 'All Time' },
]

export default function ReportFilters({
  range, from, to, today, branch,
}: { range: string; from: string; to: string; today: string; branch: string }) {
  const router = useRouter()
  const [fromVal, setFromVal] = useState(from)
  const [toVal, setToVal] = useState(to)

  const go = (qs: string) => router.push(`/restaurant/reports?${qs}&branch=${branch}`)

  const applyCustom = () => {
    if (!fromVal || !toVal) return
    const [a, b] = fromVal <= toVal ? [fromVal, toVal] : [toVal, fromVal]
    go(`range=custom&from=${a}&to=${b}`)
  }

  return (
    <div className="rf-wrap">
      <div className="rf-presets">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => go(`range=${p.key}`)}
            className={range === p.key ? 'rf-preset rf-active' : 'rf-preset'}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={range === 'custom' ? 'rf-custom rf-custom-active' : 'rf-custom'}>
        <label className="rf-field">
          <span>From</span>
          <input type="date" value={fromVal} max={today} onChange={e => setFromVal(e.target.value)} />
        </label>
        <label className="rf-field">
          <span>To</span>
          <input type="date" value={toVal} max={today} onChange={e => setToVal(e.target.value)} />
        </label>
        <button type="button" className="rf-apply" onClick={applyCustom} disabled={!fromVal || !toVal}>
          Apply
        </button>
      </div>

      <style>{`
        .rf-wrap { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: stretch; justify-content: flex-end; }
        .rf-presets { display: flex; background: #f1f5f9; border-radius: 0.5rem; padding: 0.25rem; border: 1px solid #cbd5e1; overflow-x: auto; }
        .rf-preset { padding: 0.4rem 0.8rem; border-radius: 0.375rem; font-size: 0.8rem; border: none; cursor: pointer;
          color: #475569; background: transparent; font-weight: 500; white-space: nowrap; transition: all 0.15s ease; }
        .rf-preset.rf-active { color: #fff; background: #2563eb; font-weight: 700; }
        .rf-custom { display: flex; align-items: flex-end; gap: 0.4rem; background: #f1f5f9; border: 1px solid #cbd5e1;
          border-radius: 0.5rem; padding: 0.25rem 0.4rem; }
        .rf-custom-active { border-color: #2563eb; background: #eff6ff; }
        .rf-field { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: #475569; font-weight: 600; }
        .rf-field input { padding: 0.3rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.8rem;
          color: #0f172a; background: #fff; min-width: 0; }
        .rf-apply { padding: 0.4rem 0.9rem; background: #2563eb; color: #fff; border: none; border-radius: 0.375rem;
          font-size: 0.8rem; font-weight: 700; cursor: pointer; align-self: center; }
        .rf-apply:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 768px) {
          .rf-wrap { flex-direction: column; width: 100%; }
          .rf-presets { width: 100%; }
          .rf-preset { flex: 1 0 auto; }
          .rf-custom { width: 100%; flex-wrap: wrap; padding: 0.5rem; }
          .rf-field { flex: 1 1 8rem; flex-direction: column; align-items: stretch; gap: 0.2rem; }
          .rf-field input { width: 100%; padding: 0.45rem; font-size: 0.9rem; }
          .rf-apply { width: 100%; padding: 0.6rem; font-size: 0.9rem; }
        }
      `}</style>
    </div>
  )
}
