import {
  fetchPatientsPerMonth,
  fetchAppointmentStatusThisMonth,
  fetchAppointmentsPerMonth,
  fetchAnalyticsSummary,
  fetchRevenue,
} from '@/app/lib/data'
import { formatCurrency } from '@/app/lib/utils'
import PatientsChart from '@/app/ui/dashboard/patients-chart'
import AppointmentsChart from '@/app/ui/dashboard/appointments-chart'
import RevenueBarChart from '@/app/ui/dashboard/revenue-bar-chart'
import StatusDonut from '@/app/ui/dashboard/status-donut'
import { lusitana } from '@/app/ui/fonts'
import type { ReactNode } from 'react'

// Every figure is scoped to the signed-in user (owner: whole practice,
// staff: their own patients/appointments), so render per request.
export const dynamic = 'force-dynamic'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="text-sm font-medium text-gray-500">{label}</h3>
      <p
        className={`${lusitana.className} mt-4 truncate text-2xl font-semibold text-gray-900`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

export default async function Page() {
  const [
    perMonth,
    statusRows,
    appointmentsPerMonth,
    summary,
    revenue,
  ] = await Promise.all([
    fetchPatientsPerMonth(),
    fetchAppointmentStatusThisMonth(),
    fetchAppointmentsPerMonth(),
    fetchAnalyticsSummary(),
    fetchRevenue(),
  ])

  return (
    <main>
      <h1 className={`${lusitana.className} text-2xl`}>Analytics</h1>

      {/* Headline numbers for the practice */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total patients"
          value={String(summary.totalPatients)}
        />
        <StatCard
          label="Appointments this month"
          value={String(summary.appointmentsThisMonth)}
          hint={`${summary.noShowsThisMonth} no-show${summary.noShowsThisMonth === 1 ? '' : 's'}`}
        />
        <StatCard
          label="No-show rate this month"
          value={`${summary.noShowRate}%`}
        />
        <StatCard
          label="Collected (last 12 months)"
          value={formatCurrency(summary.collectedLast12Months)}
          hint={`Pending: ${formatCurrency(summary.pendingTotal)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel title="Is the practice growing? New patients per month (last 6 months)">
          <PatientsChart rows={perMonth} />
        </Panel>
        <Panel title="How busy is the practice? Appointments per month (last 6 months)">
          <AppointmentsChart rows={appointmentsPerMonth} />
        </Panel>
        <Panel title="What share of this month&apos;s appointments are no-shows?">
          <StatusDonut rows={statusRows} />
        </Panel>
        <Panel title="How much was collected? Monthly revenue (last 12 months, ZAR)">
          {revenue.some((month) => month.revenue > 0) ? (
            <RevenueBarChart rows={revenue} />
          ) : (
            <p className="text-sm text-gray-500">No paid patient invoices yet.</p>
          )}
        </Panel>
      </div>
    </main>
  )
}