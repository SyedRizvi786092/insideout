import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import HomePage from '@/pages/HomePage';
import MatchSetupPage from '@/pages/MatchSetupPage';
import MatchViewPage from '@/pages/MatchViewPage';
import ScoringPage from '@/pages/ScoringPage';
import LivePage from '@/pages/LivePage';
import { useAuthStore } from '@/stores/authStore';

function HistoryPage() {
  return (
    <PageContainer>
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Match History</h2>
        <p className="text-sm text-gray-400">Past matches and series will appear here.</p>
      </div>
    </PageContainer>
  );
}

function ProfilePage() {
  return (
    <PageContainer>
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Profile</h2>
        <p className="text-sm text-gray-400">User settings and player profile.</p>
      </div>
    </PageContainer>
  );
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/match/new" element={<MatchSetupPage />} />
          <Route path="/match/:matchId" element={<MatchViewPage />} />
          <Route path="/match/:matchId/score" element={<ScoringPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/live" element={<LivePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
