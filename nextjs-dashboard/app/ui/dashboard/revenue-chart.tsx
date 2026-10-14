import { generateYAxis } from '@/app/lib/utils';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';
import { Revenue } from '@/app/lib/definitions';
import { fetchRevenue } from '@/app/lib/data';

// This component is representational only.
// For data visualization UI, check out:
// https://www.tremor.so/
// https://www.chartjs.org/
// https://airbnb.io/visx/

export default async function RevenueChart() {
  const revenue = await fetchRevenue();

  const chartHeight = 350;

  // Every month is zero-filled, so "no data" means no paid invoices at all.
  if (!revenue?.some((month) => month.revenue > 0)) {
    return (
      <div className="w-full md:col-span-4">
        <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
          Monthly Revenue
        </h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="py-8 text-center text-sm text-gray-400">
            No paid patient invoices yet.
          </p>
        </div>
      </div>
    );
  }

  const { yAxisLabels, topLabel } = generateYAxis(revenue);

  return (
    <div className="w-full md:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`${lusitana.className} text-xl md:text-2xl`}>
          Monthly Revenue
        </h2>
        <span className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 sm:flex">
          <CalendarIcon className="h-4 w-4" />
          Last 12 months
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-blue-50/60 to-white p-5 shadow-sm">
        <div className="sm:grid-cols-13 mt-0 grid grid-cols-12 items-end gap-2 md:gap-4">
          <div
            className="mb-6 hidden flex-col justify-between text-xs text-gray-400 sm:flex"
            style={{ height: `${chartHeight}px` }}
          >
            {yAxisLabels.map((label) => (
              <p key={label}>{label}</p>
            ))}
          </div>

          <div
            className="col-span-12 flex items-end justify-between gap-2 sm:col-span-12 md:gap-4"
            style={{ height: `${chartHeight + 24}px` }}
          >
            {revenue.map((month) => (
              <div
                key={month.month}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="mb-1 hidden text-xs font-medium text-blue-600 group-hover:block">
                  {month.revenue > 0 ? `R${month.revenue.toLocaleString('en-ZA')}` : ''}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all group-hover:from-blue-500 group-hover:to-blue-400"
                  style={{
                    height: `${Math.max(
                      (chartHeight / topLabel) * month.revenue,
                      month.revenue > 0 ? 4 : 0,
                    )}px`,
                  }}
                ></div>
                <p className="text-xs text-gray-400">{month.month}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-xs text-gray-500">
            Paid patient invoices — last 12 months
          </h3>
        </div>
      </div>
    </div>
  );
}
