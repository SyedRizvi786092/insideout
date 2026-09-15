import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

interface AppShellProps {
  children?: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-gray-950 text-gray-100">
      <Header />
      <main className="flex-1 pt-14 pb-16 overflow-y-auto">
        {children ?? <Outlet />}
      </main>
      <BottomNav />
    </div>
  );
}

export { AppShell };
