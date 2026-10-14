import { cache } from 'react';
import postgres from 'postgres';
import { auth } from '@/auth';
import {
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  PatientField,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { createClient } from '@/lib/supabase/server';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export type SessionContext = {
  /** Supabase auth uid (the JWT `sub` claim) of the signed-in user */
  userId: string;
  /** Role from `profiles`: 'owner' = practice owner, anything else = staff */
  role: string;
};

/**
 * Resolves who is making this request: the Supabase uid from the access token
 * kept in the NextAuth session, plus their role in `profiles`. Cached per
 * request so cards, charts and tables only decode/lookup once.
 *
 * Returns null when there is no session (e.g. during a build prerender), in
 * which case patientScope() hides everything.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const session = await auth();
    const token = session?.supabaseAccessToken;
    if (!token) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      ) as { sub?: string };
      if (!payload.sub) return null;
      const [profile] = await sql<{ role: string }[]>`
        SELECT role FROM profiles WHERE id = ${payload.sub}
      `;
      // Users without a profile row fall back to staff (least privilege),
      // matching what the RLS policies grant them.
      return { userId: payload.sub, role: profile?.role ?? 'staff' };
    } catch (error) {
      console.error('Failed to resolve session context:', error);
      return null;
    }
  },
);

/**
 * SQL condition that re-applies patient visibility to raw queries. The postgres
 * pooler role bypasses RLS, so without this every query would behave like the
 * owner: the practice owner sees every patient, staff only patients registered
 * under their own user id (mirrors the "patients: owner or practice owner can
 * select" RLS policy). No session → no rows.
 */
function patientScope(ctx: SessionContext | null) {
  if (!ctx) return sql`FALSE`;
  if (ctx.role === 'owner') return sql`TRUE`;
  return sql`patients.user_id = ${ctx.userId}`;
}

/**
 * SQL condition mirroring the "appointments: select own" RLS policy, plus the
 * owner bypass: staff only ever see the appointments they booked, while the
 * practice owner (role = 'owner') sees every appointment in the practice.
 * Raw queries go through the pooler role which bypasses RLS, so this must be
 * re-applied here exactly like patientScope() does for patients.
 */
export function appointmentScope(ctx: SessionContext | null) {
  if (!ctx) return sql`FALSE`;
  if (ctx.role === 'owner') return sql`TRUE`;
  return sql`appointments.user_id = ${ctx.userId}`;
}

/**
 * Monthly revenue collected from paid patient invoices over the last 12 months.
 * Months without any paid invoice are zero-filled so the chart always shows a
 * complete 12-month axis (same bucketing approach as fetchPatientsPerMonth).
 */
export async function fetchRevenue(): Promise<Revenue[]> {
  try {
    const ctx = await getSessionContext();
    const data = await sql<{ month_start: string; revenue: number }[]>`
      SELECT
        to_char(date_trunc('month', invoices.date), 'YYYY-MM-DD') AS month_start,
        SUM(invoices.amount)::float AS revenue
      FROM invoices
      JOIN patients ON invoices.patient_id = patients.id
      WHERE ${patientScope(ctx)}
        AND invoices.status = 'paid'
        AND invoices.date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY date_trunc('month', invoices.date)
      ORDER BY date_trunc('month', invoices.date)`;

    const now = new Date();
    const buckets = new Map<string, Revenue>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
        month: d.toLocaleString('en-ZA', { month: 'short' }),
        revenue: 0,
      });
    }

    for (const row of data) {
      const [year, month] = row.month_start.split('-').map(Number);
      const bucket = buckets.get(`${year}-${month - 1}`);
      if (bucket) bucket.revenue = row.revenue;
    }

    return [...buckets.values()];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const ctx = await getSessionContext();
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, patients.full_name AS name, patients.phone, invoices.id
      FROM invoices
      JOIN patients ON invoices.patient_id = patients.id
      WHERE ${patientScope(ctx)}
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const ctx = await getSessionContext();

    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    // Raw SQL bypasses RLS, so patientScope() limits every figure to the
    // patients the signed-in user may see (owner: all, staff: own).
    const invoiceCountPromise = sql`
      SELECT COUNT(*) FROM invoices
      JOIN patients ON invoices.patient_id = patients.id
      WHERE ${patientScope(ctx)}`;
    const patientCountPromise = sql`
      SELECT COUNT(*) FROM patients
      WHERE ${patientScope(ctx)}`;
    const invoiceStatusPromise = sql`
      SELECT
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS "paid",
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS "pending"
      FROM invoices
      JOIN patients ON invoices.patient_id = patients.id
      WHERE ${patientScope(ctx)}`;

    const data = await Promise.all([
      invoiceCountPromise,
      patientCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfPatients = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

    return {
      numberOfPatients,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const ctx = await getSessionContext();
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.patient_id,
        invoices.amount,
        invoices.date,
        invoices.status,
        patients.full_name,
        patients.phone
      FROM invoices
      JOIN patients ON invoices.patient_id = patients.id
      WHERE ${patientScope(ctx)}
        AND (
          patients.full_name ILIKE ${`%${query}%`} OR
          patients.phone ILIKE ${`%${query}%`} OR
          invoices.amount::text ILIKE ${`%${query}%`} OR
          invoices.date::text ILIKE ${`%${query}%`} OR
          invoices.status ILIKE ${`%${query}%`}
        )
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const ctx = await getSessionContext();
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN patients ON invoices.patient_id = patients.id
    WHERE ${patientScope(ctx)}
      AND (
        patients.full_name ILIKE ${`%${query}%`} OR
        patients.phone ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      )
  `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.patient_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    // Amounts are stored in whole Rands, so no conversion is needed.
    const invoice = data[0];
    console.log(invoice); // Invoice is an empty array []
    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export type Patient = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  file_path: string | null;
  created_at: string;
};

export async function fetchPatients(): Promise<Patient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('id, user_id, full_name, phone, date_of_birth, file_path, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error('Failed to fetch patients.');
  }
  return data as Patient[];
}

export async function fetchPatientById(id: string): Promise<Patient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('id, user_id, full_name, phone, date_of_birth, file_path, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error);
    throw new Error('Failed to fetch patient.');
  }
  return (data as Patient | null) ?? null;
}

export interface AppointmentRow {
  id: string
  starts_at: string
  status: 'booked' | 'done' | 'no_show'
  patient_name: string
  /** Email of the user (owner or staff member) who booked the appointment. */
  booked_by: string | null
  booked_by_id: string
}

export type AppointmentStatusFilter = 'booked' | 'done' | 'no_show'

export interface AppointmentFilters {
  /** Narrow to a single status (booked / done / no-show). */
  status?: AppointmentStatusFilter
  /** Narrow to appointments booked by one user (owner only). */
  userId?: string
}

/**
 * Lists appointments visible to the signed-in user: the owner sees every
 * appointment in the practice (alongside who booked it), staff only see their
 * own. Optional status and per-user filters narrow the list further.
 *
 * Uses the raw pooler connection (like the invoice queries) because the
 * appointments RLS policies have no owner bypass — through the Supabase client
 * the owner would see an empty table. appointmentScope() re-applies the same
 * visibility rules the policies implement.
 */
export async function fetchAppointments(
  filters: AppointmentFilters = {},
): Promise<AppointmentRow[]> {
  const ctx = await getSessionContext()
  const status = filters.status ?? null
  const userId = filters.userId ?? null
  const data = await sql<AppointmentRow[]>`
    SELECT
      appointments.id,
      appointments.starts_at,
      appointments.status,
      appointments.user_id AS booked_by_id,
      patients.full_name AS patient_name,
      auth.users.email AS booked_by
    FROM appointments
    JOIN patients ON patients.id = appointments.patient_id
    LEFT JOIN auth.users ON auth.users.id = appointments.user_id
    WHERE ${appointmentScope(ctx)}
      AND (${status}::text IS NULL OR appointments.status = ${status})
      AND (${userId}::text IS NULL OR appointments.user_id = ${userId}::uuid)
    ORDER BY appointments.starts_at DESC`
  return data.map((row) => ({
    ...row,
    starts_at: new Date(row.starts_at).toISOString(),
  }))
}

/**
 * Appointment counts per status for the filter tabs, scoped like
 * fetchAppointments() and optionally narrowed to one booker (the userId
 * filter). `all` is the unfiltered total for the current scope.
 */
export async function fetchAppointmentCounts(
  userId?: string,
): Promise<{ all: number; booked: number; done: number; no_show: number }> {
  const ctx = await getSessionContext()
  const owner = userId ?? null
  const data = await sql<{ status: StatusRow['status'] | null; total: number }[]>`
    SELECT appointments.status, COUNT(*)::int AS total
    FROM appointments
    WHERE ${appointmentScope(ctx)}
      AND (${owner}::text IS NULL OR appointments.user_id = ${owner}::uuid)
    GROUP BY appointments.status`

  const counts = { all: 0, booked: 0, done: 0, no_show: 0 }
  for (const row of data) {
    counts.all += row.total
    if (row.status && row.status in counts) counts[row.status] = row.total
  }
  return counts
}

/**
 * Distinct users who booked appointments the caller is allowed to see.
 * Powers the owner's "Booked by" filter; staff only ever see themselves.
 */
export async function fetchAppointmentBookers(): Promise<
  { id: string; email: string | null }[]
> {
  const ctx = await getSessionContext()
  const data = await sql<{ id: string; email: string | null }[]>`
    SELECT DISTINCT appointments.user_id AS id, auth.users.email
    FROM appointments
    LEFT JOIN auth.users ON auth.users.id = appointments.user_id
    WHERE ${appointmentScope(ctx)}
    ORDER BY auth.users.email`
  return data
}

export async function fetchPatientOptions(): Promise<PatientField[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('patients').select('id, full_name').order('full_name')
  if (error) throw new Error(error.message)
  return data
}

export interface CalendarAppointment {
  id: string;
  patient_name: string;
  starts_at: string;
  status: 'booked' | 'done' | 'no_show';
  booked_by: string | null;
}

/**
 * Every appointment in one calendar month, grouped by the practice's
 * timezone (Africa/Johannesburg days, not UTC days). Scoped to the caller
 * exactly like fetchAppointments(): staff only see their own bookings,
 * the owner sees the whole practice. Pass the same status/user filters so
 * the calendar grid always matches the list view.
 */
export async function fetchCalendarAppointments(
  year: number,
  month: number,
  opts: { status?: AppointmentStatusFilter; userId?: string } = {},
): Promise<CalendarAppointment[]> {
  const ctx = await getSessionContext();
  const { status, userId } = opts;
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthStart = `${year}-${pad(month)}-01`;
  const nextStart = `${next.y}-${pad(next.m)}-01`;

  const statusParam = status ?? null;
  const userParam = userId ?? null;

  try {
    const data = await sql<CalendarAppointment[]>`
      SELECT
        appointments.id,
        patients.full_name AS patient_name,
        appointments.starts_at,
        appointments.status,
        auth.users.email AS booked_by
      FROM appointments
      JOIN patients ON patients.id = appointments.patient_id
      LEFT JOIN auth.users ON auth.users.id = appointments.user_id
      WHERE ${appointmentScope(ctx)}
        AND (appointments.starts_at AT TIME ZONE 'Africa/Johannesburg')::date >= ${monthStart}::date
        AND (appointments.starts_at AT TIME ZONE 'Africa/Johannesburg')::date < ${nextStart}::date
        AND (${statusParam}::text IS NULL OR appointments.status = ${statusParam})
        AND (${userParam}::text IS NULL OR appointments.user_id = ${userParam}::uuid)
      ORDER BY appointments.starts_at ASC`;
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch calendar appointments.');
  }
}

export async function fetchAppointmentById(id: string) {
  const ctx = await getSessionContext()
  const data = await sql<{
    id: string
    patient_id: string
    starts_at: Date
    status: 'booked' | 'done' | 'no_show'
  }[]>`
    SELECT id, patient_id, starts_at, status
    FROM appointments
    WHERE id = ${id} AND ${appointmentScope(ctx)}`
  const row = data[0]
  if (!row) return null
  return {
    id: row.id,
    patient_id: row.patient_id,
    // normalise the driver's Date to the ISO string the edit form expects
    starts_at: new Date(row.starts_at).toISOString(),
    status: row.status,
  }
}


export interface StatusRow {
  status: 'booked' | 'done' | 'no_show'
  total: number
}

const APPOINTMENT_STATUSES: StatusRow['status'][] = ['booked', 'done', 'no_show']

/**
 * Appointment status split for the current month, scoped to the caller
 * (owner: whole practice, staff: their own bookings).
 *
 * This used to read the `appointment_status_this_month` view through the
 * Supabase client, but that view is `security_invoker=true`, so RLS applied
 * and the owner (who books no appointments themselves) always saw nothing.
 * Querying the table directly with appointmentScope() fixes that.
 */
export async function fetchAppointmentStatusThisMonth(): Promise<StatusRow[]> {
  const ctx = await getSessionContext()
  const data = await sql<{ status: StatusRow['status']; total: number }[]>`
    SELECT appointments.status, COUNT(*)::int AS total
    FROM appointments
    WHERE ${appointmentScope(ctx)}
      AND appointments.starts_at >= date_trunc('month', CURRENT_DATE)
      AND appointments.starts_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY appointments.status`

  const byStatus = new Map(data.map((row) => [row.status, row.total]))
  // Zero-fill so the donut always shows all three slices.
  return APPOINTMENT_STATUSES.map((status) => ({
    status,
    total: byStatus.get(status) ?? 0,
  }))
}

export interface AppointmentsPerMonthRow {
  month: string
  booked: number
  done: number
  no_show: number
}

/**
 * Appointments per month for the last 6 months, split by status and scoped to
 * the caller (owner sees the whole practice). Months are zero-filled so the
 * chart always shows a complete 6-month axis.
 */
export async function fetchAppointmentsPerMonth(): Promise<AppointmentsPerMonthRow[]> {
  const ctx = await getSessionContext()

  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  start.setMonth(start.getMonth() - 5)

  const data = await sql<{
    month_start: string
    status: StatusRow['status']
    total: number
  }[]>`
    SELECT
      to_char(date_trunc('month', appointments.starts_at), 'YYYY-MM-DD') AS month_start,
      appointments.status,
      COUNT(*)::int AS total
    FROM appointments
    WHERE ${appointmentScope(ctx)}
      AND appointments.starts_at >= ${start}
    GROUP BY date_trunc('month', appointments.starts_at), appointments.status
    ORDER BY date_trunc('month', appointments.starts_at)`

  const buckets = new Map<string, AppointmentsPerMonthRow>()
  for (let i = 0; i < 6; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      month: d.toLocaleString('en-ZA', { month: 'short', year: 'numeric' }),
      booked: 0,
      done: 0,
      no_show: 0,
    })
  }

  for (const row of data) {
    const [year, month] = row.month_start.split('-').map(Number)
    const bucket = buckets.get(`${year}-${month - 1}`)
    if (bucket) bucket[row.status] = row.total
  }

  return [...buckets.values()]
}

export interface AnalyticsSummary {
  totalPatients: number
  appointmentsThisMonth: number
  noShowsThisMonth: number
  /** Percentage 0-100 of this month's appointments that were no-shows. */
  noShowRate: number
  /** Paid invoice totals for the last 12 months, in Rands (ZAR). */
  collectedLast12Months: number
  /** Outstanding invoice totals, in Rands (ZAR). */
  pendingTotal: number
}

/**
 * Headline numbers for the owner's analytics page, all scoped to the caller.
 * Revenue figures come back in Rands; format them with formatCurrency().
 */
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const ctx = await getSessionContext()

  const patientCount = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM patients WHERE ${patientScope(ctx)}`

  const appointmentCount = await sql<{ total: number; no_shows: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE appointments.status = 'no_show')::int AS no_shows
    FROM appointments
    WHERE ${appointmentScope(ctx)}
      AND appointments.starts_at >= date_trunc('month', CURRENT_DATE)
      AND appointments.starts_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`

  const invoiceTotals = await sql<{ collected: string | null; pending: string | null }[]>`
    SELECT
      SUM(CASE
        WHEN invoices.status = 'paid'
         AND invoices.date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
        THEN invoices.amount ELSE 0 END) AS collected,
      SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS pending
    FROM invoices
    JOIN patients ON invoices.patient_id = patients.id
    WHERE ${patientScope(ctx)}`

  const total = appointmentCount[0]?.total ?? 0
  const noShows = appointmentCount[0]?.no_shows ?? 0

  return {
    totalPatients: Number(patientCount[0]?.count ?? 0),
    appointmentsThisMonth: total,
    noShowsThisMonth: noShows,
    noShowRate: total === 0 ? 0 : Math.round((noShows / total) * 100),
    collectedLast12Months: Number(invoiceTotals[0]?.collected ?? 0),
    pendingTotal: Number(invoiceTotals[0]?.pending ?? 0),
  }
}

export interface PatientsPerMonthRow {
  month: string
  count: number
}

export async function fetchPatientsPerMonth(): Promise<PatientsPerMonthRow[]> {
  const supabase = await createClient()

  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  start.setMonth(start.getMonth() - 5)

  const { data, error } = await supabase
    .from('patients')
    .select('created_at')
    .gte('created_at', start.toISOString())
  if (error) throw new Error(error.message)

  const buckets = new Map<string, PatientsPerMonthRow>()
  for (let i = 0; i < 6; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      month: d.toLocaleString('en-ZA', { month: 'short', year: 'numeric' }),
      count: 0,
    })
  }

  for (const { created_at } of data ?? []) {
    const d = new Date(created_at)
    const bucket = buckets.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (bucket) bucket.count += 1
  }

  return [...buckets.values()]
}