import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { onLiveMatchesSnapshot } from '@/lib/firestore-service';
import { oversToString } from '@/lib/cricket';
import type { Match } from '@/types/cricket';
import PageContainer from '@/components/layout/PageContainer';
import { Swords, Plus, ArrowRight } from 'lucide-react';

export default function LivePage() {
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

  const getBattingTeamName = (match: Match) => {
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
    <PageContainer className="flex flex-col gap-4 pb-20">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Swords className="w-6 h-6 text-emerald-500" />
          Live Matches
        </h1>
        <Link
          to="/match/new"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      {liveMatches.length > 0 ? (
        <div className="flex flex-col gap-3">
          {liveMatches.map((match) => {
            const canScore = isScorer(match.scorerId) || match.id === activeMatchId;

            return (
              <div
                key={match.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                  <span className="text-xs text-gray-500">{match.settings.totalOvers} ov</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">
                    {match.team1.name} vs {match.team2.name}
                  </h3>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">
                    {getBattingTeamName(match)}: {match.score.runs}/{match.score.wickets}
                    <span className="text-sm font-normal text-gray-400 ml-1.5">
                      ({oversToString(match.score.overs)} ov)
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    CRR: {match.score.currentRunRate.toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-2 pt-1 border-t border-gray-800">
                  {canScore ? (
                    <Link
                      to={`/match/${match.id}/score`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                    >
                      Resume Scoring <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : null}
                  <Link
                    to={`/match/${match.id}`}
                    className="flex-1 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2 rounded-lg text-sm transition-colors text-center"
                  >
                    View Scorecard
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center bg-gray-900/50">
          <p className="text-sm text-gray-400 font-medium">No live matches in progress</p>
          <p className="text-xs text-gray-500 mt-1">
            Start a new match to track live scores.
          </p>
          <Link
            to="/match/new"
            className="inline-flex items-center gap-1.5 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Start Match
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
