import {
  BanknotesIcon,
  ClockIcon,
  UserGroupIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';
import { fetchCardData } from '@/app/lib/data';

const iconMap = {
  collected: BanknotesIcon,
  patients: UserGroupIcon,
  pending: ClockIcon,
  invoices: InboxIcon,
};

export default async function CardWrapper() {
  const {
    numberOfInvoices,
    numberOfPatients,
    totalPaidInvoices,
    totalPendingInvoices,
  } = await fetchCardData();

  return (
    <>
      {/* NOTE: Uncomment this code in Chapter 9 */}

      <Card title="Collected" value={totalPaidInvoices} type="collected" />
      <Card title="Pending" value={totalPendingInvoices} type="pending" />
      <Card title="Total Invoices" value={numberOfInvoices} type="invoices" />
      <Card
        title="Total Patients"
        value={numberOfPatients}
        type="patients"
      />
    </>
  );
}

export function Card({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: 'invoices' | 'patients' | 'pending' | 'collected';
}) {
  const Icon = iconMap[type];

  const accents: Record<typeof type, string> = {
    collected: 'from-emerald-500 to-emerald-600 shadow-emerald-600/25',
    pending: 'from-amber-500 to-amber-600 shadow-amber-600/25',
    invoices: 'from-blue-500 to-blue-600 shadow-blue-600/25',
    patients: 'from-sky-500 to-blue-600 shadow-blue-600/25',
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-50/70 transition-transform group-hover:scale-125"
      />
      <div className="relative flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
        {Icon ? (
          <span
            className={`bg-gradient-to-br ${accents[type]} rounded-xl p-2.5 text-white shadow-md`}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p
        className={`${lusitana.className} relative mt-4 truncate text-2xl font-semibold text-gray-900`}
      >
        {value}
      </p>
    </div>
  );
}
