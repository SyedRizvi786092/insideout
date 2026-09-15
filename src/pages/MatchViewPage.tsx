import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMatchStore } from '@/stores/matchStore';
import { useAuthStore } from '@/stores/authStore';
import { oversToString } from '@/lib/cricket';
import { cn } from '@/lib/utils';
import { MatchStatus } from '@/types/cricket';
import type { RecentBallDisplay } from '@/types/cricket';
import { Loader2, Share2, ArrowRight } from 'lucide-react';
import Scorecard from '@/components/match/Scorecard';

function BallBubble({ ball }: { ball: RecentBallDisplay }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        ball.isWicket && 'bg-red-500 text-white',
        !ball.isWicket && ball.isBoundary && ball.display.includes('6') && 'bg-violet-500 text-white',
        !ball.isWicket && ball.isBoundary && ball.display.includes('4') && 'bg-blue-500 text-white',
        !ball.isWicket && ball.isExtra && 'bg-orange-500 text-white',
        !ball.isWicket && !ball.isBoundary && !ball.isExtra && ball.display === '0' && 'bg-gray-700 text-gray-400',
        !ball.isWicket && !ball.isBoundary && !ball.isExtra && ball.display !== '0' && 'bg-gray-600 text-white',
      )}
    >
      {ball.display === '0' ? '·' : ball.display}
    </div>
  );
}

export default function MatchViewPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { match, currentInnings, loading, error, subscribeToMatch, clear } = useMatchStore();
  const { user, isScorer } = useAuthStore();

  useEffect(() => {
    if (matchId) {
      subscribeToMatch(matchId);
    }
    return () => clear();
  }, [matchId, subscribeToMatch, clear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-gray-400 text-center">{error || 'Match not found'}</p>
        <Link to="/" className="mt-4 text-emerald-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  const isLive = match.status === MatchStatus.Live || match.status === MatchStatus.InningsBreak;
  const isCompleted = match.status === MatchStatus.Completed;
  const canScore = matchId && isScorer(match.scorerId);

  // Determine batting team name
  const battingTeamName = match.currentInnings === 1
    ? (match.toss?.decision === 'bat'
      ? (match.toss.winnerTeam === 'team1' ? match.team1.name : match.team2.name)
      : (match.toss?.winnerTeam === 'team1' ? match.team2.name : match.team1.name))
    : (match.toss?.decision === 'bat'
      ? (match.toss?.winnerTeam === 'team1' ? match.team2.name : match.team1.name)
      : (match.toss?.winnerTeam === 'team1' ? match.team1.name : match.team2.name));

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${match.team1.name} vs ${match.team2.name}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3 max-w-lg mx-auto">
      {/* Match Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          {isCompleted && (
            <span className="bg-gray-700 text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full">
              COMPLETED
            </span>
          )}
          {match.status === MatchStatus.InningsBreak && (
            <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              INNINGS BREAK
            </span>
          )}
          <span className="text-xs text-gray-500">
            {match.settings.totalOvers} overs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="p-2 text-gray-400 hover:text-white transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          {canScore && (
            <Link
              to={`/match/${matchId}/score`}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Score <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Score Banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-gray-400">{battingTeamName || 'Team'}</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {match.score.runs}
              <span className="text-gray-400">/{match.score.wickets}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-300">({oversToString(match.score.overs)} ov)</p>
            <p className="text-xs text-gray-500">CRR: {match.score.currentRunRate.toFixed(2)}</p>
          </div>
        </div>

        {match.score.target && (
          <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between text-sm">
            <span className="text-gray-400">
              Target: <span className="text-white font-semibold">{match.score.target}</span>
            </span>
            {match.score.requiredRunRate && (
              <span className="text-gray-400">
                RRR: <span className="text-yellow-400 font-semibold">{match.score.requiredRunRate.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}

        {isCompleted && match.result && (
          <div className="mt-2 pt-2 border-t border-gray-800">
            <p className="text-emerald-400 text-sm font-semibold text-center">
              {match.result.resultText}
            </p>
          </div>
        )}
      </div>

      {/* Active Players */}
      {isLive && (match.striker || match.nonStriker || match.currentBowler) && (
        <div className="grid grid-cols-2 gap-2">
          {/* Batsmen Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Batting</p>
            {match.striker && (
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-400 text-xs">★</span>
                  <span className="text-sm text-white font-medium truncate max-w-[80px]">
                    {match.striker.name}
                  </span>
                </div>
                <span className="text-sm text-gray-300 font-mono">
                  {match.striker.runs}<span className="text-gray-500">({match.striker.balls})</span>
                </span>
              </div>
            )}
            {match.nonStriker && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 truncate max-w-[80px] pl-4">
                  {match.nonStriker.name}
                </span>
                <span className="text-sm text-gray-500 font-mono">
                  {match.nonStriker.runs}<span className="text-gray-600">({match.nonStriker.balls})</span>
                </span>
              </div>
            )}
          </div>

          {/* Bowler Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Bowling</p>
            {match.currentBowler && (
              <>
                <p className="text-sm text-white font-medium truncate">
                  {match.currentBowler.name}
                </p>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {oversToString(match.currentBowler.overs)}-{match.currentBowler.maidens}-{match.currentBowler.runsConceded}-{match.currentBowler.wickets}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Econ: {match.currentBowler.economyRate.toFixed(2)}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* This Over */}
      {isLive && match.recentBalls.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">This Over</p>
          <div className="flex gap-1.5 flex-wrap">
            {match.recentBalls.map((ball) => (
              <BallBubble key={ball.ballId} ball={ball} />
            ))}
          </div>
        </div>
      )}

      {/* Scorecard */}
      {currentInnings && (
        <Scorecard innings={currentInnings} matchSettings={match.settings} />
      )}
    </div>
  );
}
