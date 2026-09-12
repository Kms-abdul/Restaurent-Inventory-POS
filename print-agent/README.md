# Restaurant POS — Local Print Agent

This is the **Windows Print Agent** for the Restaurant POS Platform. It runs as a background process on the restaurant's local Windows PC and polls Supabase for pending print jobs, sending them to the local thermal printer.

## Why is this needed?

Your Next.js app runs on **Vercel** (in the cloud). It cannot directly access a USB/LAN thermal printer physically attached to the restaurant's Windows PC. This agent bridges that gap:

```
Vercel (cloud) → Supabase → Print Job → This Agent → Windows Printer → Receipt
```

## Setup

### 1. Install dependencies

```bash
cd print-agent
npm install
```

### 2. Configure environment

Create a `.env` file in `print-agent/`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
BRANCH_ID=uuid-of-this-branch

# Printer names exactly as they appear in Windows Control Panel → Printers
RECEIPT_PRINTER_NAME=POS-80
KITCHEN_PRINTER_NAME=Kitchen-80

# Optional
POLL_INTERVAL_MS=2000
```

### 3. Find your Windows printer name

Open **Control Panel → Devices and Printers** and note the exact printer name as shown there. This must match `RECEIPT_PRINTER_NAME` exactly.

### 4. Run

Development (with live reload):
```bash
npm run dev
```

Production (build + start):
```bash
npm run build
npm start
```

### 5. Auto-start on Windows boot

Use **Task Scheduler** or create a startup shortcut to `npm start` from the `print-agent` directory.

Alternatively, use `pm2` (process manager):
```bash
npm install -g pm2
pm2 start dist/index.js --name "pos-print-agent"
pm2 save
pm2 startup
```

## How it works

1. Every 2 seconds, the agent queries Supabase for `print_jobs` with `status = 'pending'` and `branch_id = <your branch>`
2. It marks the job as `printing` immediately to prevent duplicate pickup
3. It formats the job payload using the appropriate template (receipt or KOT)
4. It sends the formatted text to the Windows printer
5. It marks the job as `done` (or `failed` with error message)

## Printer Setup in Admin UI

In the Restaurant Admin panel → **Settings → Printers**, the admin can:
- Register printer names for this branch
- Assign receipt vs kitchen printer
- Test print

## Troubleshooting

| Problem | Solution |
|---|---|
| "Printer not found" | Check that `RECEIPT_PRINTER_NAME` exactly matches Windows printer name |
| Text garbled | Ensure printer is set to receive plain text (not PCL/PostScript) |
| Jobs stuck in "printing" | Agent crashed mid-job — restart agent, jobs will be re-queued manually |
| Can't connect to Supabase | Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` |
