import { useLocation, useParams } from 'react-router-dom';
import { useMatchStore } from '@/stores/matchStore';

// Routes where the header should NOT be shown at all
const HEADER_HIDDEN_ROUTES = ['/'];
// Routes handled by the page itself (e.g., ScoringPage has its own header)
const PAGE_OWN_HEADER_PATTERN = /^\/match\/[^/]+\/score$/;

function useHeaderTitle(): string | null {
  const location = useLocation();
  const { match } = useMatchStore();

  const path = location.pathname;

  if (HEADER_HIDDEN_ROUTES.includes(path)) return null;
  if (PAGE_OWN_HEADER_PATTERN.test(path)) return null;

  if (path === '/match/new') return 'New Match';
  if (path === '/live') return 'Live Matches';
  if (path === '/history') return 'Match History';
  if (path === '/profile') return 'Profile';

  // Match view: show "Team A vs Team B"
  if (/^\/match\/[^/]+$/.test(path)) {
    if (match) return `${match.team1.name} vs ${match.team2.name}`;
    return 'Match';
  }

  return 'InsideOut';
}

export default function Header() {
  const title = useHeaderTitle();

  // Hidden on home and scoring page
  if (title === null) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-center px-4">
      <h1 className="text-base font-semibold text-gray-100 select-none">
        {title}
      </h1>
    </header>
  );
}

export { Header };
