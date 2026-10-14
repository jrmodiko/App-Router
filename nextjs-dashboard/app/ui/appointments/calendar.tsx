import AppointmentStatus from '@/app/ui/appointments/status'
import {
  DeleteAppointment,
  UpdateAppointment,
} from '@/app/ui/appointments/buttons'
import { saDateKey, saTime, saTodayKey } from '@/app/lib/time'
import type { CalendarAppointment } from '@/app/lib/data'
import clsx from 'clsx'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Chip colors keyed off the appointment status. */
const CHIP_STYLES: Record<CalendarAppointment['status'], string> = {
  booked: 'bg-blue-50 text-blue-700 ring-blue-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  no_show: 'bg-rose-50 text-rose-700 ring-rose-200',
}

type Cell = { key: string; day: number; inMonth: boolean }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Monday-first cell layout for the given month. Weeks run Monday-first to
 * match the South African week; padding uses a plain date grid (no DST
 * concerns at month granularity).
 */
export function monthCells(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  // JS getUTCDay: 0 = Sun … 6 = Sat. Convert to Monday-first offset.
  const lead = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prevDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  const cells: Cell[] = []
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  for (let i = lead - 1; i >= 0; i--) {
    const d = prevDays - i
    cells.push({
      key: `${prev.y}-${pad(prev.m)}-${pad(d)}`,
      day: d,
      inMonth: false,
    })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${year}-${pad(month)}-${pad(d)}`, day: d, inMonth: true })
  }
  let d = 1
  while (cells.length % 7 !== 0) {
    cells.push({ key: `${next.y}-${pad(next.m)}-${pad(d)}`, day: d, inMonth: false })
    d += 1
  }
  return cells
}

/**
 * Month-grid calendar of appointments plus a same-month agenda. All day
 * grouping uses the practice timezone so late appointments never slip into
 * the wrong column.
 */
export default function Calendar({
  appointments,
  year,
  month,
}: {
  appointments: CalendarAppointment[]
  year: number
  month: number
}) {
  const byDay = new Map<string, CalendarAppointment[]>()
  for (const a of appointments) {
    const key = saDateKey(a.starts_at)
    const list = byDay.get(key)
    if (list) list.push(a)
    else byDay.set(key, [a])
  }

  const cells = monthCells(year, month)
  const todayKey = saTodayKey()
  const agenda = [...appointments].sort((a, b) =>
    a.starts_at < b.starts_at ? -1 : 1,
  )
  const MAX_CHIPS = 3

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm xl:col-span-2">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/70">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const items = byDay.get(cell.key) ?? []
            const isToday = cell.key === todayKey
            return (
              <div
                key={cell.key}
                className={clsx(
                  'min-h-[96px] border-gray-100 p-1.5 sm:p-2',
                  'border-b [&:nth-last-child(-n+7)]:border-b-0',
                  i % 7 !== 6 && 'border-r',
                  !cell.inMonth && 'bg-gray-50/60',
                )}
              >
                <span
                  className={clsx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    isToday
                      ? 'bg-blue-600 text-white shadow-sm'
                      : cell.inMonth
                        ? 'text-gray-700'
                        : 'text-gray-400',
                  )}
                >
                  {cell.day}
                </span>
                <div className="mt-1 space-y-1">
                  {items.slice(0, MAX_CHIPS).map((a) => (
                    <div
                      key={a.id}
                      title={`${saTime(a.starts_at)} — ${a.patient_name}`}
                      className={clsx(
                        'truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                        CHIP_STYLES[a.status],
                      )}
                    >
                      {saTime(a.starts_at)} {a.patient_name}
                    </div>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <p className="px-1 text-[11px] font-medium text-gray-400">
                      +{items.length - MAX_CHIPS} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            This month&apos;s schedule
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {agenda.length === 0
              ? 'Nothing booked yet.'
              : `${agenda.length} appointment${agenda.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {agenda.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No appointments in this view yet.
          </p>
        ) : (
          <ul className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto">
            {agenda.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-11 shrink-0 text-center">
                  <p className="text-lg font-semibold leading-none text-gray-900">
                    {saDateKey(a.starts_at).slice(8)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-gray-400">
                    {saTime(a.starts_at)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {a.patient_name}
                  </p>
                  <div className="mt-1">
                    <AppointmentStatus status={a.status} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <UpdateAppointment id={a.id} />
                  <DeleteAppointment id={a.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

