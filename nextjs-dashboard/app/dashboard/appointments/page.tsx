import Link from 'next/link'
import {
  fetchAppointments,
  fetchAppointmentCounts,
  fetchAppointmentBookers,
  fetchCalendarAppointments,
  getSessionContext,
  type AppointmentStatusFilter,
} from '@/app/lib/data'
import { formatSA } from '@/app/lib/time'
import {
  CreateAppointment,
  DeleteAppointment,
  UpdateAppointment,
} from '@/app/ui/appointments/buttons'
import { lusitana } from '@/app/ui/fonts'
import AppointmentStatus from '@/app/ui/appointments/status'
import BookerFilter from '@/app/ui/appointments/booker-filter'
import Calendar from '@/app/ui/appointments/calendar'
import clsx from 'clsx'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListBulletIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'

const STATUS_TABS: { key: AppointmentStatusFilter | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'booked', label: 'Booked' },
  { key: 'done', label: 'Done' },
  { key: 'no_show', label: 'No-shows' },
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page(props: {
  searchParams?: Promise<{ status?: string; user?: string; view?: string; month?: string }>
}) {
  const searchParams = await props.searchParams
  const ctx = await getSessionContext()
  const isOwner = ctx?.role === 'owner'

  // Only accept known statuses / well-formed uuids so the query stays safe.
  const rawStatus = searchParams?.status
  const status: AppointmentStatusFilter | undefined =
    rawStatus === 'booked' || rawStatus === 'done' || rawStatus === 'no_show'
      ? rawStatus
      : undefined
  const rawUser = searchParams?.user
  const userId = rawUser && UUID_RE.test(rawUser) ? rawUser : undefined
  const view: 'calendar' | 'list' =
    searchParams?.view === 'list' ? 'list' : 'calendar'

  // Month comes in as 'YYYY-MM'; fall back to the current SA month.
  const nowSA = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }),
  )
  const rawMonth = searchParams?.month
  const monthMatch = rawMonth?.match(/^(\d{4})-(\d{2})$/)
  const parsedMonth = monthMatch ? Number(monthMatch[2]) : NaN
  const year =
    monthMatch && parsedMonth >= 1 && parsedMonth <= 12
      ? Number(monthMatch[1])
      : nowSA.getFullYear()
  const month =
    monthMatch && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : nowSA.getMonth() + 1
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const [counts, bookers] = await Promise.all([
    fetchAppointmentCounts(userId),
    fetchAppointmentBookers(),
  ])
  const rows =
    view === 'list' ? await fetchAppointments({ status, userId }) : []
  const calendarItems =
    view === 'calendar'
      ? await fetchCalendarAppointments(year, month, { status, userId })
      : []

  // Preserves the current status/user/view/month filters when switching tabs.
  const withParams = (overrides: {
    status?: AppointmentStatusFilter | 'all'
    user?: string | null
    view?: 'calendar' | 'list'
    month?: string
  }) => {
    const params = new URLSearchParams()
    const nextStatus =
      overrides.status !== undefined
        ? overrides.status
        : (status ?? 'all')
    if (nextStatus !== 'all') params.set('status', nextStatus)
    const nextUser = overrides.user !== undefined ? overrides.user : userId
    if (nextUser) params.set('user', nextUser)
    const nextView = overrides.view ?? view
    if (nextView === 'list') params.set('view', 'list')
    params.set('month', overrides.month ?? monthKey)
    const qs = params.toString()
    return qs ? `/dashboard/appointments?${qs}` : '/dashboard/appointments'
  }

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    'en-ZA',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  )

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>Appointments</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isOwner
              ? 'Every booking across the practice.'
              : 'Appointments you have booked.'}
          </p>
        </div>
        <CreateAppointment />
      </div>

      {/* Status filter: all / booked / done / no-shows, with counts */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.key === 'all' ? !status : status === tab.key
          const count =
            tab.key === 'all' ? counts.all : counts[tab.key as AppointmentStatusFilter]
          return (
            <Link
              key={tab.key}
              href={withParams({ status: tab.key })}
              className={clsx(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50',
              )}
            >
              {tab.label} ({count})
            </Link>
          )
        })}

        {/* Owner sees everyone's bookings, so offer a per-user filter too */}
        {isOwner && bookers.length > 1 && (
          <BookerFilter
            bookers={bookers}
            value={userId}
            baseParams={{
              ...(status ? { status } : {}),
              ...(view === 'list' ? { view: 'list' as const } : {}),
              month: monthKey,
            }}
          />
        )}
      </div>

      {/* Calendar / list toggle + month navigation */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200">
          <Link
            href={withParams({ view: 'calendar' })}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              view === 'calendar'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Squares2X2Icon className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            href={withParams({ view: 'list' })}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <ListBulletIcon className="h-4 w-4" />
            List
          </Link>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white px-1.5 py-1 ring-1 ring-inset ring-gray-200">
          <Link
            href={withParams({ month: shiftMonth(-1) })}
            aria-label="Previous month"
            className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <span className="flex min-w-36 items-center justify-center gap-1.5 px-1 text-sm font-semibold text-gray-900">
            <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
            {monthLabel}
          </span>
          <Link
            href={withParams({ month: shiftMonth(1) })}
            aria-label="Next month"
            className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {view === 'calendar' ? (
        calendarItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-900">
              Nothing on the calendar
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {status || userId
                ? 'No appointments match the selected filters.'
                : 'No appointments this month yet. Create the first one.'}
            </p>
          </div>
        ) : (
          <Calendar appointments={calendarItems} year={year} month={month} />
        )
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {status || userId
            ? 'No appointments match the selected filters.'
            : 'No appointments yet. Create the first one.'}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-gray-900">
          <thead className="bg-gray-50 text-left text-sm font-normal">
            <tr>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-3 py-3 font-medium">Starts</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Booked by</th>
              <th className="py-3 pl-6 pr-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((a) => (
              <tr key={a.id} className="border-b text-sm">
                <td className="whitespace-nowrap px-4 py-3">{a.patient_name}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatSA(a.starts_at)}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <AppointmentStatus status={a.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                  {a.booked_by ?? '—'}
                </td>
                <td className="whitespace-nowrap py-3 pl-6 pr-3">
                  <div className="flex justify-end gap-3">
                    <UpdateAppointment id={a.id} />
                    <DeleteAppointment id={a.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}