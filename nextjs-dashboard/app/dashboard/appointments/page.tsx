import Link from 'next/link'
import {
  fetchAppointments,
  fetchAppointmentCounts,
  fetchAppointmentBookers,
  getSessionContext,
  type AppointmentStatusFilter,
} from '@/app/lib/data'
import { formatSA } from '@/app/lib/time'
import { CreateAppointment, UpdateAppointment, DeleteAppointment } from '@/app/ui/appointments/buttons'
import AppointmentStatus from '@/app/ui/appointments/status'
import BookerFilter from '@/app/ui/appointments/booker-filter'
import { lusitana } from '@/app/ui/fonts'
import clsx from 'clsx'

const STATUS_TABS: { key: AppointmentStatusFilter | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'booked', label: 'Booked' },
  { key: 'done', label: 'Done' },
  { key: 'no_show', label: 'No-shows' },
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page(props: {
  searchParams?: Promise<{ status?: string; user?: string }>
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

  const [rows, counts, bookers] = await Promise.all([
    fetchAppointments({ status, userId }),
    fetchAppointmentCounts(userId),
    fetchAppointmentBookers(),
  ])

  // Preserves the current status/user filters when switching tabs.
  const tabHref = (key: AppointmentStatusFilter | 'all') => {
    const params = new URLSearchParams()
    if (key !== 'all') params.set('status', key)
    if (userId) params.set('user', userId)
    const qs = params.toString()
    return qs ? `/dashboard/appointments?${qs}` : '/dashboard/appointments'
  }

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`${lusitana.className} text-2xl`}>Appointments</h1>
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
              href={tabHref(tab.key)}
              className={clsx(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label} ({count})
            </Link>
          )
        })}

        {/* Owner sees everyone's bookings, so offer a per-user filter too */}
        {isOwner && bookers.length > 1 && (
          <BookerFilter bookers={bookers} value={userId} />
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {status || userId
            ? 'No appointments match the selected filters.'
            : 'No appointments yet. Create the first one.'}
        </p>
      ) : (
        <table className="mt-6 min-w-full text-gray-900">
          <thead className="text-left text-sm font-normal">
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
      )}
    </div>
  )
}