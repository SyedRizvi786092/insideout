import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

interface AppShellProps {
  children?: React.ReactNode;
}

const HEADER_HIDDEN_ROUTES = ['/'];
const PAGE_OWN_HEADER_PATTERN = /^\/match\/[^/]+\/score$/;

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const hasHeader =
    !HEADER_HIDDEN_ROUTES.includes(location.pathname) &&
    !PAGE_OWN_HEADER_PATTERN.test(location.pathname);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-950 text-gray-100">
      <Header />
      <main className={`flex-1 ${hasHeader ? 'pt-14' : ''} pb-16 overflow-y-auto`}>
        {children ?? <Outlet />}
      </main>
      <BottomNav />
    </div>
  );
}

export { AppShell };
