import SideNav from '@/app/ui/dashboard/sidenav';
 
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none border-b border-gray-100 bg-white md:w-64 md:border-b-0 md:border-r">
        <SideNav />
      </div>
      <div className="grow bg-gray-50 p-6 md:overflow-y-auto md:p-12">{children}</div>
    </div>
  );
}