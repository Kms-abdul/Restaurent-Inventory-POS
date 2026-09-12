import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { processPrintJob } from './jobs'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BRANCH_ID = process.env.BRANCH_ID!
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2000)

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BRANCH_ID) {
  console.error('❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, BRANCH_ID')
  process.exit(1)
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

console.log(`🖨️  Restaurant POS Print Agent`)
console.log(`   Branch ID: ${BRANCH_ID}`)
console.log(`   Polling every: ${POLL_INTERVAL_MS}ms`)
console.log(`   Supabase: ${SUPABASE_URL}`)
console.log(`   Started: ${new Date().toLocaleString()}`)
console.log(`─────────────────────────────────────────────`)

async function pollJobs() {
  try {
    // Fetch pending jobs for this branch
    const { data: jobs, error } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('branch_id', BRANCH_ID)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5)

    if (error) {
      console.error('Poll error:', error.message)
      return
    }

    for (const job of jobs ?? []) {
      // Mark as printing immediately (prevents duplicate pickup)
      await supabase
        .from('print_jobs')
        .update({ status: 'printing', picked_up_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'pending') // double-check to avoid race condition

      try {
        await processPrintJob(job)
        await supabase
          .from('print_jobs')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', job.id)
        console.log(`✅ Printed job ${job.id} (type: ${job.printer_type})`)
      } catch (printErr: any) {
        console.error(`❌ Print failed for job ${job.id}:`, printErr.message)
        await supabase
          .from('print_jobs')
          .update({ status: 'failed', error_message: printErr.message })
          .eq('id', job.id)
      }
    }
  } catch (err: any) {
    console.error('Unexpected error:', err.message)
  }
}

// Start polling
setInterval(pollJobs, POLL_INTERVAL_MS)
pollJobs() // run immediately on start
