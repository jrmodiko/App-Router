import RevenueChart from '@/app/ui/dashboard/revenue-chart';
import LatestInvoices from '@/app/ui/dashboard/latest-invoices';
import { lusitana } from '@/app/ui/fonts';
import { Suspense } from 'react';
import CardWrapper from '@/app/ui/dashboard/cards';
import { RevenueChartSkeleton, LatestInvoicesSkeleton, CardsSkeleton, } from '@/app/ui/skeletons';
import { auth } from '@/auth';

// The cards, revenue chart and latest invoices all depend on who is logged in
// (owner sees the whole practice, staff only their own patients), so this page
// must render on every request instead of being prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await auth();
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <main>
      {/* Hero banner: greeting + quick actions over a soft blue gradient */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-6 text-white shadow-md md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-blue-300/20 blur-2xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">
              {new Date().toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <h1 className={`${lusitana.className} mt-1 text-2xl md:text-3xl`}>
              Good day, {firstName}
            </h1>
            <p className="mt-1 max-w-md text-sm text-blue-100">
              Your practice at a glance — revenue, invoices and patients.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<CardsSkeleton />}>
          <CardWrapper />
        </Suspense>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <Suspense fallback={<RevenueChartSkeleton />}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<LatestInvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </main>
  );
} 