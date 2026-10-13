import Link from 'next/link';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/app/ui/button';
import { createAppointment } from '@/app/lib/actions';

export default function CreateAppointmentForm({ patients }: { patients: { id: string; full_name: string }[] }) {
  return (
    <form action={createAppointment}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">
        <div className="mb-4">
          <label htmlFor="patient_id" className="mb-2 block text-sm font-medium">Patient</label>
          <div className="relative">
            <select
              id="patient_id"
              name="patient_id"
              defaultValue=""
              required
              className="peer block w-full cursor-pointer rounded-md border border-gray-200 bg-white py-2 pl-10 text-sm outline-2"
            >
              <option value="" disabled>Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="starts_at" className="mb-2 block text-sm font-medium">Starts at</label>
          <input
            id="starts_at"
            type="datetime-local"
            name="starts_at"
            required
            className="block w-full rounded-md border border-gray-200 bg-white py-2 px-3 text-sm"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="status" className="mb-2 block text-sm font-medium">Status</label>
          <select
            id="status"
            name="status"
            defaultValue="booked"
            className="block w-full cursor-pointer rounded-md border border-gray-200 bg-white py-2 px-3 text-sm"
          >
            <option value="booked">Booked</option>
            <option value="done">Done</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Link
          href="/dashboard/appointments"
          className="flex h-10 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          Cancel
        </Link>
        <Button type="submit">Create appointment</Button>
      </div>
    </form>
  );
}