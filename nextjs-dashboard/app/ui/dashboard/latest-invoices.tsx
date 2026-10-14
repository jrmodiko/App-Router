import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { lusitana } from '@/app/ui/fonts';
import { LatestInvoice } from '@/app/lib/definitions';
import { fetchLatestInvoices } from '@/app/lib/data';

export default async function LatestInvoices() {
  const latestInvoices = await fetchLatestInvoices();

  return (
    <div className="flex w-full flex-col md:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`${lusitana.className} text-xl md:text-2xl`}>
          Latest Invoices
        </h2>
        <span className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 sm:flex">
          <ArrowPathIcon className="h-4 w-4" />
          Updated just now
        </span>
      </div>

      <div className="grow overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {latestInvoices.length === 0 && (
          <p className="py-8 px-4 text-center text-sm text-gray-400">
            No invoices for your patients yet.
          </p>
        )}
        {latestInvoices.map((invoice, i) => {
          const initials = invoice.name
            .split(' ')
            .map((part) => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <div
              key={invoice.id}
              className={clsx(
                'flex flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-blue-50/50',
                {
                  'border-t border-gray-100': i !== 0,
                },
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-sm">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {invoice.name}
                  </p>
                  {invoice.phone && (
                    <p className="hidden text-sm text-gray-500 sm:block">
                      {invoice.phone}
                    </p>
                  )}
                </div>
              </div>
              <p
                className={clsx(
                  `${lusitana.className} shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold md:text-base`,
                  'bg-blue-600 text-white shadow-sm',
                )}
              >
                {invoice.amount}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
