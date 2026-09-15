import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { onLiveMatchesSnapshot } from '@/lib/firestore-service';
import { oversToString } from '@/lib/cricket';
import type { Match } from '@/types/cricket';
import PageContainer from '@/components/layout/PageContainer';
import { Plus, Trophy, Zap, ChevronRight, ArrowRight } from 'lucide-react';

function LiveMatchCard({
  match,
  canScore,
}: {
  match: Match;
  canScore: boolean;
}) {
  const getBattingTeamName = () => {
    if (!match.toss) return match.team1.name;
    const battingFirst =
      match.toss.decision === 'bat'
        ? match.toss.winnerTeam
        : match.toss.winnerTeam === 'team1'
        ? 'team2'
        : 'team1';
    if (match.currentInnings === 1) {
      return battingFirst === 'team1' ? match.team1.name : match.team2.name;
    }
    return battingFirst === 'team1' ? match.team2.name : match.team1.name;
  };

  return (
    <div className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700/80 rounded-xl p-3.5 transition-colors flex flex-col gap-2.5">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
          <span className="text-xs text-gray-400">
            {match.settings.totalOvers} ov
          </span>
        </div>
        <Link
          to={`/match/${match.id}`}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-0.5"
        >
          View <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-semibold text-gray-200">
            {match.team1.name} vs {match.team2.name}
          </p>
          <p className="text-base font-bold text-white mt-0.5">
            {getBattingTeamName()}: {match.score.runs}/{match.score.wickets}
            <span className="text-xs text-gray-400 font-normal ml-1">
              ({oversToString(match.score.overs)} ov)
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">CRR</p>
          <p className="text-sm font-semibold text-emerald-400">
            {match.score.currentRunRate.toFixed(2)}
          </p>
        </div>
      </div>

      {canScore && (
        <div className="pt-2 border-t border-gray-700/60 flex gap-2">
          <Link
            to={`/match/${match.id}/score`}
            className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition-colors"
          >
            Resume Scoring <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user, isScorer } = useAuthStore();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setActiveMatchId(localStorage.getItem('cricket_active_match_id'));
    } catch {
      // ignore
    }

    const unsub = onLiveMatchesSnapshot((matches) => {
      setLiveMatches(matches);
    });
    return () => unsub();
  }, []);

  const isGuest = !user || user.isAnonymous;

  // Find the match currently scored by this user
  const activeScoringMatch = liveMatches.find(
    (m) => (user?.uid && isScorer(m.scorerId)) || m.id === activeMatchId
  );

  return (
    <PageContainer className="flex flex-col gap-5 pb-20">
      {/* App Title */}
      <div className="text-center pt-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          🏏 InsideOut
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Live scoring & match tracking
        </p>
      </div>

      {/* ── Active Ongoing Match Card (Resume Scoring) ────── */}
      {activeScoringMatch && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex flex-col gap-3 shadow-lg shadow-emerald-950/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Your Active Match
            </span>
            <span className="text-xs text-emerald-300/70 font-medium">
              {activeScoringMatch.settings.totalOvers} overs
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">
              {activeScoringMatch.team1.name} vs {activeScoringMatch.team2.name}
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Score: <span className="font-bold text-white">{activeScoringMatch.score.runs}/{activeScoringMatch.score.wickets}</span> ({oversToString(activeScoringMatch.score.overs)} ov)
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to={`/match/${activeScoringMatch.id}/score`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow"
            >
              Resume Scoring <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={`/match/${activeScoringMatch.id}`}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg text-sm transition-colors"
            >
              Scorecard
            </Link>
          </div>
        </div>
      )}

      {/* Guest Registration Banner */}
      {isGuest && (
        <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 border border-emerald-700/30 rounded-xl p-4">
          <p className="text-sm text-emerald-200 font-medium">
            Want to track your stats?
          </p>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            Sign in with Google to register as a player and build your cricket profile.
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Sign In & Register <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <Link
          to="/match/new"
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 py-4 text-lg font-semibold w-full text-center transition-colors active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Start New Match
        </Link>
        <button
          type="button"
          className="flex items-center justify-center gap-2 border-2 border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10 rounded-xl px-6 py-4 text-lg font-semibold w-full text-center transition-colors active:scale-[0.98]"
        >
          <Trophy className="w-5 h-5" />
          Start New Series
        </button>
      </div>

      {/* Live Matches */}
      <section className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            Live Matches
          </h2>
          {liveMatches.length > 0 && (
            <span className="text-xs text-gray-500">
              {liveMatches.length} match{liveMatches.length !== 1 && 'es'}
            </span>
          )}
        </div>

        {liveMatches.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {liveMatches.map((match) => {
              const canScore = isScorer(match.scorerId) || match.id === activeMatchId;
              return (
                <LiveMatchCard
                  key={match.id}
                  match={match}
                  canScore={canScore}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500">No live matches in progress</p>
            <p className="text-xs text-gray-600 mt-1">
              Start a match to see it here
            </p>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
