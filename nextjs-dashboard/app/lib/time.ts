const OFFSET = '+02:00'
const ZONE = 'Africa/Johannesburg'

// '2026-10-07T09:30' (form)  ->  '2026-10-07T09:30:00+02:00' (Postgres timestamptz input)
export function fromDateTimeLocal(value: string): string {
  return `${value}:00${OFFSET}`
}

// timestamptz from the database  ->  '2026-10-07T09:30' for an edit form's defaultValue
export function toDateTimeLocal(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 2 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}

export function formatSA(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    timeZone: ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// 'YYYY-MM-DD' calendar-day key in the practice timezone (never UTC).
export function saDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

// 'HH:mm' start time in the practice timezone.
export function saTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Today's date key in the practice timezone.
export function saTodayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}