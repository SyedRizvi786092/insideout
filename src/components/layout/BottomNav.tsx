import { Home, Swords, History, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavTab {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_TABS: NavTab[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Live', path: '/live', icon: Swords },
  { label: 'History', path: '/history', icon: History },
  { label: 'Profile', path: '/profile', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 h-16 bg-gray-900 border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-full items-center justify-around">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors select-none',
                isActive ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <Icon className="w-5 h-5 mb-1 shrink-0" />
              <span className="leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { BottomNav };
