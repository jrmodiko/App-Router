'use client';

import {
  UserGroupIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

// Map of links to display in the side navigation.
// Depending on the size of the application, this would be stored in a database.
const links = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: DocumentDuplicateIcon,
  },
  { name: 'Patients', href: '/dashboard/patients', icon: UserGroupIcon },
  { name: 'Appointments', href: '/dashboard/appointments', icon: CalendarIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon }
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-3 rounded-xl p-3 text-sm font-medium transition-colors md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-blue-600 text-white shadow-sm shadow-blue-600/20': isActive,
                'text-gray-600 hover:bg-blue-50 hover:text-blue-600': !isActive,
              },
            )}
          >
            <LinkIcon className="w-6 shrink-0" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
