'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AppointmentsPerMonthRow } from '@/app/lib/data'

const STATUS_META = [
  { key: 'booked', name: 'Booked', fill: '#2563eb' },
  { key: 'done', name: 'Done', fill: '#16a34a' },
  { key: 'no_show', name: 'No-show', fill: '#dc2626' },
] as const

/** Grouped bar chart of appointments per month, split by status. */
export default function AppointmentsChart({ rows }: { rows: AppointmentsPerMonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {STATUS_META.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.fill} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}