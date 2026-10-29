// Runs once when the server starts. Vercel servers run in UTC, so server-side
// date math (today's report range, collection report days) started the day at
// 05:30 IST. Node picks up a runtime TZ change for all later Date operations.
export function register() {
  process.env.TZ = 'Asia/Kolkata'
}
