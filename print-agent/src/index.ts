import 'dotenv/config'
import path from 'path'
import http from 'http'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { processPrintJob } from './jobs'

// Attempt to load parent .env.local if present
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BRANCH_ID = process.env.BRANCH_ID
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 1500)
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8080)

export const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

console.log(`=============================================`)
console.log(`🖨️  Restaurant POS Local Thermal Print Agent`)
console.log(`=============================================`)
console.log(`   Printer: ${process.env.RECEIPT_PRINTER_NAME || 'POSIO QX300'}`)
console.log(`   Local Bridge: http://127.0.0.1:${HTTP_PORT}/print`)
if (supabase) {
  console.log(`   Cloud Queue: Connected to Supabase (${SUPABASE_URL})`)
  if (BRANCH_ID) console.log(`   Branch ID: ${BRANCH_ID}`)
  console.log(`   Poll Interval: ${POLL_INTERVAL_MS}ms`)
} else {
  console.log(`   Cloud Queue: Supabase credentials not set (Local HTTP Bridge only)`)
}
console.log(`   Started: ${new Date().toLocaleString()}`)
console.log(`─────────────────────────────────────────────`)

// ── 1. Local HTTP Bridge Server (Instant <50ms direct print from browser) ──
const server = http.createServer(async (req, res) => {
  // CORS headers so kitchora-ops.vercel.app can send direct print commands
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const job = {
          id: 'http-' + Date.now(),
          printer_type: payload.type === 'KOT' ? 'kitchen' : 'receipt',
          payload: {
            restaurant_name: payload.data?.restaurantName || 'CHINESE NAWAB',
            branch_name: payload.data?.branchName,
            order_no: payload.data?.orderNumber,
            cashier_name: payload.data?.cashierName,
            created_at: payload.data?.createdAt,
            subtotal: payload.data?.subtotal ? payload.data.subtotal * 100 : 0,
            discount_amount: payload.data?.discount ? payload.data.discount * 100 : 0,
            total_amount: payload.data?.total ? payload.data.total * 100 : 0,
            payment_mode: payload.data?.paymentMode,
            split_details: payload.data?.splitDetails,
            items: (payload.data?.items || []).map((i: any) => ({
              name: i.name,
              qty: i.quantity || i.qty || 1,
              line_total: i.lineTotal ? i.lineTotal * 100 : ((i.price || 0) * (i.quantity || 1) * 100),
            })),
          },
        }

        console.log(`⚡ [Local Bridge] Printing ${payload.type || 'RECEIPT'} directly to ${payload.printerName || 'POSIO QX300'}...`)
        await processPrintJob(job)
        console.log(`✅ [Local Bridge] Printed successfully!`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err: any) {
        console.error(`❌ [Local Bridge] Print error:`, err?.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err?.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

// Keep the agent alive: log unexpected errors instead of exiting
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught error (agent kept running):', err?.message ?? err)
})
process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️  Unhandled rejection (agent kept running):', reason?.message ?? reason)
})

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${HTTP_PORT} is already in use. Another print agent may be running.`)
    process.exit(1)
  }
  console.error('❌ HTTP server error:', err.message)
})

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`🚀 Direct Print HTTP Server running at http://127.0.0.1:${HTTP_PORT}/print`)
})

// ── 2. Background Cloud Queue Poller (Supabase print_jobs) ──────────────────
let polling = false

async function pollJobs() {
  if (!supabase || polling) return
  polling = true
  try {
    let query = supabase
      .from('print_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5)

    if (BRANCH_ID) {
      query = query.eq('branch_id', BRANCH_ID)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.error('Poll error:', error.message)
      return
    }

    for (const job of jobs ?? []) {
      // Claim the job; skip it if another poll or agent already took it
      const { data: claimed } = await supabase
        .from('print_jobs')
        .update({ status: 'printing', picked_up_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'pending')
        .select('id')
      if (!claimed?.length) continue

      try {
        await processPrintJob(job)
        await supabase
          .from('print_jobs')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', job.id)
        console.log(`✅ [Cloud Queue] Printed job ${job.id} (${job.printer_type})`)
      } catch (printErr: any) {
        console.error(`❌ [Cloud Queue] Print failed for job ${job.id}:`, printErr.message)
        await supabase
          .from('print_jobs')
          .update({ status: 'failed', error_message: printErr.message })
          .eq('id', job.id)
      }
    }
  } catch (err: any) {
    console.error('Unexpected queue error:', err.message)
  } finally {
    polling = false
  }
}

if (supabase) {
  setInterval(pollJobs, POLL_INTERVAL_MS)
  pollJobs()
}
