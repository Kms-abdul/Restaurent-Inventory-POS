// A "business day" runs from dayEndHour (IST) to dayEndHour the next morning, so
// sales after midnight count towards the night they belong to. dayEndHour 0 = midnight.

const HOUR_MS = 3600000
const DAY_MS = 24 * HOUR_MS

const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export const isDayString = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** The business day (YYYY-MM-DD) that a moment in time belongs to. */
export function businessDayOf(moment: Date, dayEndHour: number): string {
  return istDate(new Date(moment.getTime() - dayEndHour * HOUR_MS))
}

export function businessToday(dayEndHour: number): string {
  return businessDayOf(new Date(), dayEndHour)
}

export function shiftDay(day: string, days: number): string {
  return istDate(new Date(new Date(`${day}T12:00:00+05:30`).getTime() + days * DAY_MS))
}

/** First moment of a business day. */
export function businessDayStart(day: string, dayEndHour: number): Date {
  return new Date(new Date(`${day}T00:00:00+05:30`).getTime() + dayEndHour * HOUR_MS)
}

/** Last moment of a business day. */
export function businessDayEnd(day: string, dayEndHour: number): Date {
  return new Date(businessDayStart(day, dayEndHour).getTime() + DAY_MS - 1)
}
