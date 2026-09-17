import { useEffect, useState } from 'react';
import type { Match, Ball, Innings } from '@/types/cricket';
import { getInningsBalls, getInnings } from '@/lib/firestore-service';
import { cn } from '@/lib/utils';

// ─── Ball Bubble ─────────────────────────────────────────────────────────────

function OverBubble({ ball }: { ball: Ball }) {
  const display = ballDisplayText(ball);
  const isWicket = ball.isWicket;
  const isFour = ball.runsBat === 4 && !ball.isWicket;
  const isSix = ball.runsBat === 6 && !ball.isWicket;
  const isExtra = ball.extras.type !== null;
  const isDot = !isWicket && !isExtra && ball.runsBat === 0;

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isWicket && 'bg-red-500 text-white',
        isSix && 'bg-violet-500 text-white',
        isFour && 'bg-blue-500 text-white',
        !isWicket && !isFour && !isSix && isExtra && 'bg-orange-500 text-white',
        isDot && 'bg-gray-700 text-gray-400',
        !isWicket && !isFour && !isSix && !isExtra && !isDot && 'bg-gray-600 text-white',
      )}
    >
      {isDot ? '·' : display}
    </div>
  );
}

function ballDisplayText(ball: Ball): string {
  if (ball.isWicket) return 'W';
  if (ball.extras.type) {
    const { type, runs } = ball.extras;
    if (type === 'wide') return ball.totalRuns > 1 ? `Wd` : 'Wd';
    if (type === 'noBall') return ball.runsBat > 0 ? `Nb` : 'Nb';
    if (type === 'bye') return `B${runs}`;
    if (type === 'legBye') return `Lb${runs}`;
  }
  return ball.runsBat === 0 ? '0' : ball.runsBat.toString();
}

// ─── Group balls by over ─────────────────────────────────────────────────────

interface OverGroup {
  overNumber: number;
  scoreAtStart: string;
  balls: Ball[];
  totalRuns: number;
  bowlerName: string;
  batsmanNames: string[];
}

function groupByOver(
  balls: Ball[],
  batsmanNameById: Map<string, string> = new Map(),
  bowlerNameById: Map<string, string> = new Map(),
): OverGroup[] {
  const overMap = new Map<number, Ball[]>();
  for (const ball of balls) {
    const existing = overMap.get(ball.overNumber) ?? [];
    existing.push(ball);
    overMap.set(ball.overNumber, existing);
  }

  const groups: OverGroup[] = [];
  overMap.forEach((overBalls, overNumber) => {
    const sorted = [...overBalls].sort((a, b) => a.ballSequence - b.ballSequence);
    const first = sorted[0];
    const scoreAtStart = first.previousState
      ? `${first.previousState.runs}-${first.previousState.wickets}`
      : '0-0';
    const totalRuns = sorted.reduce((sum, b) => sum + b.totalRuns, 0);
    const bowlerName = bowlerNameById.get(sorted[0]?.bowlerId) ?? 'Bowler';
    const batsmanIds = [...new Set(sorted.map(b => b.batsmanId))];
    const batsmanNames = batsmanIds.map(id => batsmanNameById.get(id) ?? id.slice(0, 8));

    groups.push({ overNumber, scoreAtStart, balls: sorted, totalRuns, bowlerName, batsmanNames });
  });

  return groups.sort((a, b) => b.overNumber - a.overNumber);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function OversList({ matchId, match }: { matchId: string; match: Match }) {
  const [selectedInnings, setSelectedInnings] = useState<1 | 2>(match.currentInnings === 2 ? 2 : 1);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInningsBalls(matchId, selectedInnings),
      getInnings(matchId, selectedInnings),
    ])
      .then(([fetchedBalls, fetchedInnings]) => {
        setBalls(fetchedBalls);
        setInnings(fetchedInnings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [matchId, selectedInnings]);

  // Build name lookup maps from innings cards
  const batsmanNameById = new Map<string, string>();
  const bowlerNameById = new Map<string, string>();
  innings?.battingCard.forEach(b => batsmanNameById.set(b.playerId, b.playerName));
  innings?.bowlingCard.forEach(b => bowlerNameById.set(b.playerId, b.playerName));
  // Also from active players on match
  if (match.striker) batsmanNameById.set(match.striker.id, match.striker.name);
  if (match.nonStriker) batsmanNameById.set(match.nonStriker.id, match.nonStriker.name);
  if (match.currentBowler) bowlerNameById.set(match.currentBowler.id, match.currentBowler.name);

  const overGroups = groupByOver(balls, batsmanNameById, bowlerNameById);

  const team1Label = `${match.team1.name} (1st inn)`;
  const team2Label = `${match.team2.name} (2nd inn)`;

  return (
    <div className="flex flex-col">
      {/* Team selector */}
      <div className="flex gap-2 px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={() => setSelectedInnings(1)}
          className={cn(
            'flex-1 py-2 rounded-full text-xs font-semibold border transition-colors',
            selectedInnings === 1
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          )}
        >
          {team1Label}
        </button>
        <button
          onClick={() => setSelectedInnings(2)}
          className={cn(
            'flex-1 py-2 rounded-full text-xs font-semibold border transition-colors',
            selectedInnings === 2
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          )}
        >
          {team2Label}
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-3 py-1 border-b border-gray-800">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider w-14">Over</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider flex-1">Balls</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider w-10 text-right">Runs</span>
      </div>

      {loading && (
        <div className="py-8 text-center text-gray-500 text-sm">Loading overs...</div>
      )}

      {!loading && overGroups.length === 0 && (
        <div className="py-8 text-center text-gray-500 text-sm">No overs yet</div>
      )}

      {!loading && overGroups.map((group) => (
        <div key={group.overNumber} className="px-3 py-2.5 border-b border-gray-800/60">
          <div className="flex items-start">
            {/* Left: Over number + score */}
            <div className="w-14 shrink-0">
              <p className="text-sm font-bold text-white">Ov {group.overNumber + 1}</p>
              <p className="text-[10px] text-gray-500">{group.scoreAtStart}</p>
            </div>

            {/* Center: bowler + batsmen + balls */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-1.5 truncate">
                {group.bowlerName} to {group.batsmanNames.join(' & ')}
              </p>
              <div className="flex gap-1 flex-wrap">
                {group.balls.map((ball) => (
                  <OverBubble key={ball.id} ball={ball} />
                ))}
              </div>
            </div>

            {/* Right: total runs */}
            <div className="w-10 text-right shrink-0 self-center">
              <span className="text-sm font-bold text-white">{group.totalRuns}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
