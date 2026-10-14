'use client'

import { usePathname, useRouter } from 'next/navigation'

/**
 * Owner-only "Booked by" filter for the appointments page. Selecting a user
 * updates the `user` search param while preserving the active status, view
 * and month filters.
 */
export default function BookerFilter({
  bookers,
  value,
  baseParams = {},
}: {
  bookers: { id: string; email: string | null }[]
  value?: string
  baseParams?: Record<string, string>
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleChange = (next: string) => {
    const params = new URLSearchParams(baseParams)
    if (next) params.set('user', next)
    else params.delete('user')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <label htmlFor="booker" className="text-sm text-gray-500">
        Booked by
      </label>
      <select
        id="booker"
        value={value ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none"
      >
        <option value="">Everyone</option>
        {bookers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.email ?? b.id}
          </option>
        ))}
      </select>
    </div>
  )
}