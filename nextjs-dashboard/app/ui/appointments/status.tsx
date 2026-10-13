import { CalendarIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function AppointmentStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-blue-100 text-blue-600': status === 'booked',
          'bg-green-500 text-white': status === 'done',
          'bg-red-100 text-red-600': status === 'no_show',
        },
      )}
    >
      {status === 'booked' ? (
        <>
          Booked
          <CalendarIcon className="ml-1 w-4" />
        </>
      ) : null}
      {status === 'done' ? (
        <>
          Done
          <CheckIcon className="ml-1 w-4" />
        </>
      ) : null}
      {status === 'no_show' ? (
        <>
          No-show
          <XMarkIcon className="ml-1 w-4" />
        </>
      ) : null}
    </span>
  );
}
