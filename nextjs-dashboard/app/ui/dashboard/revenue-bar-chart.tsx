'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Revenue } from '@/app/lib/definitions'
import { formatCurrency } from '@/app/lib/utils'

/** Monthly revenue (paid invoices, last 12 months) formatted in Rands. */
export default function RevenueBarChart({ rows }: { rows: Revenue[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R${v / 1000}K`} />
        <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
        <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}