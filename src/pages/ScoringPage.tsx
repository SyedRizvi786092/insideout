import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Drawer } from 'vaul';
import { ArrowLeft, Share2, Undo2, UserMinus, ArrowLeftRight } from 'lucide-react';
import { useMatchStore } from '@/stores/matchStore';
import { useScoringStore } from '@/stores/scoringStore';
import { useAuthStore } from '@/stores/authStore';
import { MatchStatus, ExtraType, WicketType } from '@/types/cricket';
import type { ActiveBatsmanInfo, ActiveBowlerInfo, Player } from '@/types/cricket';
import { cn } from '@/lib/utils';
import { startMatch, updateMatch, getAllPlayers, createPlayer, updateInnings } from '@/lib/firestore-service';
import { oversToString } from '@/lib/cricket';
import Scorecard from '@/components/match/Scorecard';
import OversList from '@/components/match/OversList';

// ─── Types ──────────────────────────────────────────────────────────────────

type ScoringTab = 'live' | 'scorecard' | 'overs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function BallBubble({ display, isWicket, isBoundary, isExtra }: {
  display: string; isWicket: boolean; isBoundary: boolean; isExtra: boolean;
}) {
  const bg = isWicket
    ? 'bg-red-500 text-white'
    : display === '6'
    ? 'bg-violet-500 text-white'
    : display === '4'
    ? 'bg-blue-500 text-white'
    : isExtra
    ? 'bg-orange-500 text-white'
    : display === '0'
    ? 'bg-gray-700 text-gray-400'
    : 'bg-gray-600 text-white';

  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', bg)}>
      {display === '0' ? '·' : display}
    </div>
  );
}

// ─── Player Resolution ──────────────────────────────────────────────────────

async function resolvePlayer(
  name: string,
  dbPlayers: Player[],
): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  const existing = dbPlayers.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return { id: existing.id, name: existing.name };
  const newId = await createPlayer(trimmed);
  return { id: newId, name: trimmed };
}

// ─── PlayerNameInput (with autocomplete) ────────────────────────────────────

function PlayerNameInput({
  value,
  onChange,
  placeholder,
  dbPlayers,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dbPlayers: Player[];
  className?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  // Exclude exact matches so the dropdown closes as soon as a suggestion is selected.
  const filtered = dbPlayers.filter(
    (p) =>
      p.name.toLowerCase().includes(value.toLowerCase()) &&
      p.name.toLowerCase() !== value.toLowerCase()
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
        }}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 text-base',
          className
        )}
      />
      {focused && value && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => onChange(p.name)}
              className="px-4 py-2.5 text-white hover:bg-gray-700 text-sm cursor-pointer"
            >
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Match Initialization Modal ─────────────────────────────────────────────

function OpeningPlayersModal({
  isOpen,
  match,
  currentInnings,
  onComplete,
  dbPlayers,
}: {
  isOpen: boolean;
  match: any;
  currentInnings: any;
  onComplete: () => void;
  dbPlayers: Player[];
}) {
  const [step, setStep] = useState<'striker' | 'nonStriker' | 'bowler'>('striker');
  const [strikerName, setStrikerName] = useState('');
  const [nonStrikerName, setNonStrikerName] = useState('');
  const [bowlerName, setBowlerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const battingTeamName =
    currentInnings?.battingTeam === 'team1' ? match.team1.name : match.team2.name;
  const bowlingTeamName =
    currentInnings?.bowlingTeam === 'team1' ? match.team1.name : match.team2.name;

  const handleConfirm = async () => {
    if (step === 'striker') {
      if (!strikerName.trim()) return;
      setStep('nonStriker');
      return;
    }
    if (step === 'nonStriker') {
      if (!nonStrikerName.trim()) return;
      if (nonStrikerName.trim().toLowerCase() === strikerName.trim().toLowerCase()) {
        setError('Non-striker must be different from striker');
        return;
      }
      setError('');
      setStep('bowler');
      return;
    }

    // step === 'bowler'
    if (!bowlerName.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const strikerPlayer = await resolvePlayer(strikerName, dbPlayers);
      const nonStrikerPlayer = await resolvePlayer(nonStrikerName, dbPlayers);
      const bowlerPlayer = await resolvePlayer(bowlerName, dbPlayers);

      const strikerInfo: ActiveBatsmanInfo = {
        id: strikerPlayer.id,
        name: strikerPlayer.name,
        runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
      };
      const nonStrikerInfo: ActiveBatsmanInfo = {
        id: nonStrikerPlayer.id,
        name: nonStrikerPlayer.name,
        runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
      };
      const bowlerInfo: ActiveBowlerInfo = {
        id: bowlerPlayer.id,
        name: bowlerPlayer.name,
        overs: 0, maidens: 0, runsConceded: 0, wickets: 0, economyRate: 0,
      };

      // Add players to team's playerIds if not already there
      const battingTeamKey = currentInnings.battingTeam as 'team1' | 'team2';
      const bowlingTeamKey = currentInnings.bowlingTeam as 'team1' | 'team2';
      const battingIds = [...match[battingTeamKey].playerIds];
      const bowlingIds = [...match[bowlingTeamKey].playerIds];

      if (!battingIds.includes(strikerPlayer.id)) battingIds.push(strikerPlayer.id);
      if (!battingIds.includes(nonStrikerPlayer.id)) battingIds.push(nonStrikerPlayer.id);
      if (!bowlingIds.includes(bowlerPlayer.id)) bowlingIds.push(bowlerPlayer.id);

      // Start the match: set status to Live, set active players
      await startMatch(match.id, strikerInfo, nonStrikerInfo, bowlerInfo);

      // Update team playerIds
      await updateMatch(match.id, {
        [battingTeamKey]: { ...match[battingTeamKey], playerIds: battingIds },
        [bowlingTeamKey]: { ...match[bowlingTeamKey], playerIds: bowlingIds },
      });

      // D1 Fix: Add opening batsmen to innings battingCard immediately
      await updateInnings(match.id, currentInnings.inningsNumber, {
        battingCard: [
          {
            playerId: strikerPlayer.id,
            playerName: strikerPlayer.name,
            runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
            isOut: false, howOut: 'not out', battingPosition: 1,
          },
          {
            playerId: nonStrikerPlayer.id,
            playerName: nonStrikerPlayer.name,
            runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
            isOut: false, howOut: 'not out', battingPosition: 2,
          },
        ],
        bowlingCard: [
          {
            playerId: bowlerPlayer.id,
            playerName: bowlerPlayer.name,
            overs: 0, maidens: 0, runsConceded: 0, wickets: 0, economyRate: 0,
          },
        ],
      });

      onComplete();
    } catch (err) {
      console.error('Failed to initialize match:', err);
      setError('Failed to start match. Please try again.');
      setIsSubmitting(false);
    }
  };

  const currentName = step === 'striker' ? strikerName : step === 'nonStriker' ? nonStrikerName : bowlerName;
  const setCurrentName = step === 'striker' ? setStrikerName : step === 'nonStriker' ? setNonStrikerName : setBowlerName;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-950/95 z-50 flex items-end justify-center">
      <div className="bg-gray-900 rounded-t-2xl p-5 w-full max-w-lg max-h-[75dvh] overflow-y-auto">
        <div className="mx-auto w-12 h-1 rounded-full bg-gray-700 mb-4" />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {['Striker', 'Non-Striker', 'Bowler'].map((label, i) => {
            const currentStepIndex = step === 'striker' ? 0 : step === 'nonStriker' ? 1 : 2;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                    i < currentStepIndex
                      ? 'bg-emerald-600 text-white'
                      : i === currentStepIndex
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  )}
                >
                  {i < currentStepIndex ? '✓' : i + 1}
                </div>
                <span
                  className={cn(
                    'text-xs',
                    i === currentStepIndex ? 'text-white font-medium' : 'text-gray-500'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <h2 className="text-lg font-bold text-white mb-1">
          {step === 'striker' && 'Who is the Striker?'}
          {step === 'nonStriker' && 'Who is the Non-Striker?'}
          {step === 'bowler' && 'Who is the Opening Bowler?'}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {step === 'bowler' ? `From ${bowlingTeamName}` : `From ${battingTeamName}`}
        </p>

        {/* Already entered names */}
        {step === 'nonStriker' && (
          <div className="bg-gray-800/50 rounded-lg px-3 py-2 mb-3 text-sm">
            <span className="text-gray-500">Striker: </span>
            <span className="text-emerald-400 font-medium">{strikerName}</span>
          </div>
        )}
        {step === 'bowler' && (
          <div className="bg-gray-800/50 rounded-lg px-3 py-2 mb-3 text-sm space-y-1">
            <div>
              <span className="text-gray-500">Striker: </span>
              <span className="text-emerald-400 font-medium">{strikerName}</span>
            </div>
            <div>
              <span className="text-gray-500">Non-Striker: </span>
              <span className="text-emerald-400 font-medium">{nonStrikerName}</span>
            </div>
          </div>
        )}

        {/* Input with autocomplete */}
        <div className="mb-3">
          <PlayerNameInput
            value={currentName}
            onChange={setCurrentName}
            placeholder="Enter player name..."
            dbPlayers={dbPlayers}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        <button
          onClick={handleConfirm}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          disabled={isSubmitting || !currentName.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 transition-colors"
        >
          {isSubmitting
            ? 'Starting Match...'
            : step === 'bowler'
            ? 'Start Scoring'
            : 'Next'}
        </button>

        {step !== 'striker' && !isSubmitting && (
          <button
            onClick={() => setStep(step === 'bowler' ? 'nonStriker' : 'striker')}
            className="w-full text-gray-400 hover:text-white text-sm mt-2 py-2"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Scoring Page ──────────────────────────────────────────────────────

export default function ScoringPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const { match, currentInnings, loading, error, subscribeToMatch, clear } = useMatchStore();
  const {
    currentOverBalls,
    pendingNewBowler,
    recordBall,
    undoLastBall,
    retireHurt,
    swapBatsmen,
    showWicketModal,
    showNewBatsmanModal,
    showNewBowlerModal,
    toggleWicketModal,
    toggleNewBatsmanModal,
    toggleNewBowlerModal,
    clearPendingNewBowler,
  } = useScoringStore();
  const { isScorer } = useAuthStore();

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ScoringTab>('live');

  // ── Local state ──────────────────────────────────────────────────────────
  const [extraType, setExtraType] = useState<ExtraType | null>(null);
  const [showExtrasModal, setShowExtrasModal] = useState(false);

  // Wicket modal state
  const [wicketType, setWicketType] = useState<WicketType>(WicketType.Bowled);
  const [fielderName, setFielderName] = useState('');
  const [batsmanOutId, setBatsmanOutId] = useState('');
  // Run Out extras
  const [runOutEnd, setRunOutEnd] = useState<'batting' | 'bowling'>('batting');
  const [runsBefore, setRunsBefore] = useState(0);

  const [scoringError, setScoringError] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newBowlerName, setNewBowlerName] = useState('');
  const [dbPlayers, setDbPlayers] = useState<Player[]>([]);
  const [showInitModal, setShowInitModal] = useState(false);

  // ── Subscribe ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (matchId) subscribeToMatch(matchId);
    return () => clear();
  }, [matchId, subscribeToMatch, clear]);

  useEffect(() => {
    getAllPlayers().then(setDbPlayers).catch(() => {});
  }, []);

  // Show init modal when match is in Setup state or has no players
  useEffect(() => {
    if (match && !loading) {
      const needsInit =
        match.status === MatchStatus.Setup ||
        !match.striker ||
        !match.nonStriker ||
        !match.currentBowler;
      setShowInitModal(needsInit);
    }
  }, [match, loading]);

  // Auto-set batsmanOut to striker when wicket modal opens (for non-RunOut types)
  useEffect(() => {
    if (showWicketModal && match?.striker) {
      setBatsmanOutId(match.striker.id);
      setWicketType(WicketType.Bowled);
      setFielderName('');
      setRunOutEnd('batting');
      setRunsBefore(0);
    }
  }, [showWicketModal, match?.striker]);

  // Keep active match updated in localStorage for quick resume
  useEffect(() => {
    if (match) {
      try {
        if (match.status === MatchStatus.Completed || match.status === MatchStatus.Abandoned) {
          localStorage.removeItem('cricket_active_match_id');
        } else {
          localStorage.setItem('cricket_active_match_id', match.id);
        }
      } catch (e) {
        console.warn('localStorage error:', e);
      }
    }
  }, [match]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-950">
        <div className="text-center px-8">
          <p className="text-red-400 text-lg mb-2">{error || 'Match not found'}</p>
          <button onClick={() => navigate('/')} className="text-emerald-400 text-sm underline">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentInnings) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-950">
        <p className="text-gray-400">Waiting for innings data...</p>
      </div>
    );
  }

  // ── Can score? ────────────────────────────────────────────────────────────
  const isReady = !!(match.striker && match.nonStriker && match.currentBowler && match.status === MatchStatus.Live);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRun = async (runs: number) => {
    if (!isReady) return;
    setScoringError('');
    try {
      await recordBall({
        matchId: match.id,
        match,
        innings: currentInnings,
        runsBat: runs,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });
    } catch (err: any) {
      setScoringError(err.message || 'Failed to record ball');
    }
  };

  const handleExtraTap = async (type: ExtraType) => {
    if (!isReady) return;
    setScoringError('');
    if (type === ExtraType.Wide) {
      try {
        await recordBall({
          matchId: match.id,
          match,
          innings: currentInnings,
          runsBat: 0,
          extras: { type: ExtraType.Wide, runs: 1 },
          isWicket: false,
          dismissal: null,
        });
      } catch (err: any) {
        setScoringError(err.message || 'Failed to record wide');
      }
    } else {
      setExtraType(type);
      setShowExtrasModal(true);
    }
  };

  const submitExtra = async (runs: number) => {
    if (!extraType || !isReady) return;
    try {
      await recordBall({
        matchId: match.id,
        match,
        innings: currentInnings,
        runsBat: extraType === ExtraType.NoBall ? runs : 0,
        extras: {
          type: extraType,
          runs: extraType === ExtraType.NoBall ? 1 : runs,
        },
        isWicket: false,
        dismissal: null,
      });
    } catch (err: any) {
      setScoringError(err.message || 'Failed to record extra');
    }
    setShowExtrasModal(false);
    setExtraType(null);
  };

  const submitWicket = async () => {
    if (!isReady) return;
    // For non-RunOut: striker is always out (batsmanOutId already set to striker.id in useEffect)
    // For RunOut: batsmanOutId comes from the "Who is out?" selector
    const actualRunsBat = wicketType === WicketType.RunOut ? runsBefore : 0;
    try {
      await recordBall({
        matchId: match.id,
        match,
        innings: currentInnings,
        runsBat: actualRunsBat,
        extras: { type: null, runs: 0 },
        isWicket: true,
        dismissal: {
          type: wicketType,
          batsmanOutId,
          fielderId: fielderName.trim() || null,
          newBatsmanId: null,
        },
      });
    } catch (err: any) {
      setScoringError(err.message || 'Failed to record wicket');
    }
    toggleWicketModal();
    setFielderName('');
    setWicketType(WicketType.Bowled);
  };

  const confirmNewBatsman = async () => {
    if (!newPlayerName.trim()) return;
    try {
      const player = await resolvePlayer(newPlayerName, dbPlayers);
      const isStrikerMissing = !match.striker;
      const newBatsman: ActiveBatsmanInfo = {
        id: player.id, name: player.name,
        runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
      };
      await updateMatch(match.id, {
        striker: isStrikerMissing ? newBatsman : match.striker,
        nonStriker: !isStrikerMissing && !match.nonStriker ? newBatsman : match.nonStriker,
      });
      // Add to team playerIds
      const battingTeamKey = currentInnings.battingTeam as 'team1' | 'team2';
      if (!match[battingTeamKey].playerIds.includes(player.id)) {
        await updateMatch(match.id, {
          [battingTeamKey]: {
            ...match[battingTeamKey],
            playerIds: [...match[battingTeamKey].playerIds, player.id],
          },
        });
      }
      // Add to batting card
      const existsInCard = currentInnings.battingCard.some((b: any) => b.playerId === player.id);
      if (!existsInCard) {
        await updateInnings(match.id, currentInnings.inningsNumber, {
          battingCard: [
            ...currentInnings.battingCard,
            {
              playerId: player.id,
              playerName: player.name,
              runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
              isOut: false, howOut: 'not out',
              battingPosition: currentInnings.battingCard.length + 1,
            },
          ],
        });
      }
      setNewPlayerName('');
      toggleNewBatsmanModal();

      // Bug #10 fix: if over ended on the same ball as wicket, open bowler modal now
      if (pendingNewBowler) {
        clearPendingNewBowler();
        setTimeout(() => toggleNewBowlerModal(), 100);
      }
    } catch (err) {
      console.error('Failed to add batsman:', err);
    }
  };

  const confirmNewBowler = async () => {
    if (!newBowlerName.trim()) return;
    try {
      const player = await resolvePlayer(newBowlerName, dbPlayers);
      if (match.currentBowler?.id === player.id) {
        alert('This bowler just bowled the last over. Choose a different bowler.');
        return;
      }
      const newBowler: ActiveBowlerInfo = {
        id: player.id, name: player.name,
        overs: 0, maidens: 0, runsConceded: 0, wickets: 0, economyRate: 0,
      };
      // Restore from bowling card if bowled before
      const prevCard = currentInnings.bowlingCard.find((b: any) => b.playerId === player.id);
      if (prevCard) {
        newBowler.overs = prevCard.overs;
        newBowler.maidens = prevCard.maidens;
        newBowler.runsConceded = prevCard.runsConceded;
        newBowler.wickets = prevCard.wickets;
        newBowler.economyRate = prevCard.economyRate;
      } else {
        // Add to bowling card
        await updateInnings(match.id, currentInnings.inningsNumber, {
          bowlingCard: [
            ...currentInnings.bowlingCard,
            {
              playerId: player.id,
              playerName: player.name,
              overs: 0, maidens: 0, runsConceded: 0, wickets: 0, economyRate: 0,
            },
          ],
        });
      }
      // Add to team playerIds
      const bowlingTeamKey = currentInnings.bowlingTeam as 'team1' | 'team2';
      if (!match[bowlingTeamKey].playerIds.includes(player.id)) {
        await updateMatch(match.id, {
          [bowlingTeamKey]: {
            ...match[bowlingTeamKey],
            playerIds: [...match[bowlingTeamKey].playerIds, player.id],
          },
        });
      }
      await updateMatch(match.id, { currentBowler: newBowler });
      setNewBowlerName('');
      toggleNewBowlerModal();
    } catch (err) {
      console.error('Failed to add bowler:', err);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${match.team1.name} vs ${match.team2.name}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const { extrasConfig } = match.settings;
  const battingTeamName = currentInnings.battingTeam === 'team1' ? match.team1.name : match.team2.name;

  // Partnership: rough estimate from current batsmen
  const partnership = (match.striker?.runs ?? 0) + (match.nonStriker?.runs ?? 0);
  const partnershipBalls = (match.striker?.balls ?? 0) + (match.nonStriker?.balls ?? 0);

  // Status line text
  const statusLine = match.currentInnings === 2 && match.score.target
    ? `${battingTeamName} needs ${match.score.target - match.score.runs} runs in ${(match.settings.totalOvers * 6) - match.score.legalBallsCount} balls`
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white overflow-hidden select-none">

      {/* ── Opening Players Modal ──────────────────────────────── */}
      <OpeningPlayersModal
        isOpen={showInitModal}
        match={match}
        currentInnings={currentInnings}
        dbPlayers={dbPlayers}
        onComplete={() => setShowInitModal(false)}
      />

      {/* ── Custom Header ──────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 h-12 flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate(`/match/${match.id}`)}
          className="p-1 text-gray-400 hover:text-white transition-colors -ml-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-white tracking-tight truncate max-w-[200px]">
          {match.team1.name} vs {match.team2.name}
        </h1>
        <button onClick={handleShare} className="p-1 text-gray-400 hover:text-white transition-colors -mr-1">
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
        {(['live', 'scorecard', 'overs'] as ScoringTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              activeTab === tab
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ══════════════════ LIVE TAB ══════════════════════════════ */}
      {activeTab === 'live' && (
        <>
          {/* Status line */}
          {statusLine && (
            <div className="bg-gray-900 px-4 py-1.5 text-xs text-yellow-400 font-medium shrink-0">
              {statusLine}
            </div>
          )}

          {/* Score Hero */}
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{battingTeamName}</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-white leading-none tracking-tight">
                {match.score.runs}
                <span className="text-gray-400 text-2xl">-{match.score.wickets}</span>
                <span className="text-base text-gray-400 font-normal ml-2">
                  ({oversToString(match.score.overs)})
                </span>
              </p>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">CRR</p>
                <p className="text-sm font-bold text-emerald-400">{match.score.currentRunRate.toFixed(2)}</p>
              </div>
            </div>
            {match.currentInnings === 2 && match.score.target && (
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>Target: <span className="text-white font-semibold">{match.score.target}</span></span>
                {match.score.requiredRunRate && (
                  <span>RRR: <span className="text-yellow-400 font-semibold">{match.score.requiredRunRate.toFixed(2)}</span></span>
                )}
              </div>
            )}
          </div>

          {/* P'SHIP + Batsmen + Bowler */}
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 shrink-0">
            {/* Partnership */}
            {match.striker && match.nonStriker && (
              <p className="text-[10px] text-gray-500 mb-1.5">
                P'SHIP <span className="text-gray-300 font-medium">{partnership}({partnershipBalls})</span>
              </p>
            )}

            {/* Batsmen table */}
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left font-medium pb-1">Batter</th>
                  <th className="text-right font-medium pb-1 pr-2">R</th>
                  <th className="text-right font-medium pb-1 pr-2">B</th>
                  <th className="text-right font-medium pb-1 pr-2">4s</th>
                  <th className="text-right font-medium pb-1 pr-2">6s</th>
                  <th className="text-right font-medium pb-1">SR</th>
                </tr>
              </thead>
              <tbody>
                {match.striker && (
                  <tr>
                    <td className="text-white font-medium py-0.5 flex items-center gap-1">
                      <span>🏏</span>
                      <span className="truncate max-w-[90px]">{match.striker.name}</span>
                    </td>
                    <td className="text-right text-white font-bold pr-2">{match.striker.runs}</td>
                    <td className="text-right text-gray-400 pr-2">{match.striker.balls}</td>
                    <td className="text-right text-blue-400 pr-2">{match.striker.fours}</td>
                    <td className="text-right text-violet-400 pr-2">{match.striker.sixes}</td>
                    <td className="text-right text-gray-400">{match.striker.strikeRate.toFixed(1)}</td>
                  </tr>
                )}
                {match.nonStriker && (
                  <tr>
                    <td className="text-gray-400 py-0.5 pl-5 truncate max-w-[90px]">{match.nonStriker.name}</td>
                    <td className="text-right text-gray-300 pr-2">{match.nonStriker.runs}</td>
                    <td className="text-right text-gray-500 pr-2">{match.nonStriker.balls}</td>
                    <td className="text-right text-blue-400/60 pr-2">{match.nonStriker.fours}</td>
                    <td className="text-right text-violet-400/60 pr-2">{match.nonStriker.sixes}</td>
                    <td className="text-right text-gray-500">{match.nonStriker.strikeRate.toFixed(1)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Bowler table */}
            {match.currentBowler && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600">
                    <th className="text-left font-medium pb-1">Bowler</th>
                    <th className="text-right font-medium pb-1 pr-2">O</th>
                    <th className="text-right font-medium pb-1 pr-2">M</th>
                    <th className="text-right font-medium pb-1 pr-2">R</th>
                    <th className="text-right font-medium pb-1 pr-2">W</th>
                    <th className="text-right font-medium pb-1">ER</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-white font-medium py-0.5 truncate max-w-[90px]">{match.currentBowler.name}</td>
                    <td className="text-right text-gray-400 pr-2">{oversToString(match.currentBowler.overs)}</td>
                    <td className="text-right text-gray-400 pr-2">{match.currentBowler.maidens}</td>
                    <td className="text-right text-gray-300 pr-2">{match.currentBowler.runsConceded}</td>
                    <td className="text-right text-emerald-400 font-semibold pr-2">{match.currentBowler.wickets}</td>
                    <td className="text-right text-gray-400">{match.currentBowler.economyRate.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* This Over */}
          <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0 mr-1">This over</span>
            {match.recentBalls.length === 0 && <span className="text-[10px] text-gray-600">—</span>}
            {match.recentBalls.map((b) => (
              <BallBubble key={b.ballId} {...b} />
            ))}
          </div>

          {/* Error Display */}
          {scoringError && (
            <div className="mx-3 my-1 bg-red-900/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-300 shrink-0 flex items-center justify-between">
              <span>{scoringError}</span>
              <button onClick={() => setScoringError('')} className="ml-2 text-red-400 hover:text-white font-bold">×</button>
            </div>
          )}

          {/* ── Scoring Keypad ──────────────────────────────────── */}
          <div className={cn(
            'flex-1 flex flex-col gap-2 px-3 py-2 overflow-hidden min-h-0',
            !isReady && 'opacity-40 pointer-events-none'
          )}>
            {/* Row 1: 0 1 2 3 */}
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => handleRun(r)}
                  className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 rounded-xl text-xl font-bold transition-transform h-14"
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Row 2: 4 6 Wd Nb */}
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleRun(4)}
                className="bg-blue-900/40 hover:bg-blue-900/60 active:scale-95 border border-blue-600 text-blue-300 rounded-xl text-xl font-bold transition-transform h-14"
              >
                4
              </button>
              <button
                onClick={() => handleRun(6)}
                className="bg-violet-900/40 hover:bg-violet-900/60 active:scale-95 border border-violet-600 text-violet-300 rounded-xl text-xl font-bold transition-transform h-14"
              >
                6
              </button>
              {extrasConfig.widesEnabled ? (
                <button
                  onClick={() => handleExtraTap(ExtraType.Wide)}
                  className="bg-orange-900/30 hover:bg-orange-900/50 active:scale-95 border border-orange-600 text-orange-300 rounded-xl text-base font-bold transition-transform h-14"
                >
                  Wd
                </button>
              ) : <div />}
              {extrasConfig.noBallsEnabled ? (
                <button
                  onClick={() => handleExtraTap(ExtraType.NoBall)}
                  className="bg-orange-900/30 hover:bg-orange-900/50 active:scale-95 border border-orange-600 text-orange-300 rounded-xl text-base font-bold transition-transform h-14"
                >
                  Nb
                </button>
              ) : <div />}
            </div>

            {/* Row 3: Bye / Lb (only if enabled) */}
            {(extrasConfig.byesEnabled || extrasConfig.legByesEnabled) && (
              <div className="grid grid-cols-4 gap-2">
                {extrasConfig.byesEnabled ? (
                  <button
                    onClick={() => handleExtraTap(ExtraType.Bye)}
                    className="bg-yellow-900/30 hover:bg-yellow-900/50 active:scale-95 border border-yellow-600 text-yellow-300 rounded-xl text-base font-bold transition-transform h-14"
                  >
                    Bye
                  </button>
                ) : <div />}
                {extrasConfig.legByesEnabled ? (
                  <button
                    onClick={() => handleExtraTap(ExtraType.LegBye)}
                    className="bg-yellow-900/30 hover:bg-yellow-900/50 active:scale-95 border border-yellow-600 text-yellow-300 rounded-xl text-base font-bold transition-transform h-14"
                  >
                    Lb
                  </button>
                ) : <div />}
                <div /><div />
              </div>
            )}

            {/* Wicket */}
            <button
              onClick={toggleWicketModal}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 rounded-xl font-bold text-lg transition-transform h-14 shrink-0"
            >
              🔴 WICKET
            </button>
          </div>

          {/* ── Sticky Action Bar ────────────────────────────────── */}
          <div
            className="bg-gray-900 border-t border-gray-800 flex items-center justify-around px-4 py-2 shrink-0"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={() => isReady && undoLastBall(match.id, match)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors',
                isReady ? 'text-gray-400 hover:text-white' : 'text-gray-700'
              )}
            >
              <Undo2 className="w-5 h-5" />
              <span className="text-[10px]">Undo</span>
            </button>
            <button
              onClick={() => isReady && swapBatsmen(match.id, match)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors',
                isReady ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-700'
              )}
            >
              <ArrowLeftRight className="w-5 h-5" />
              <span className="text-[10px]">Swap Strike</span>
            </button>
            <button
              onClick={() => isReady && match.striker && retireHurt(match.id, match, match.striker.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors',
                isReady ? 'text-gray-400 hover:text-amber-400' : 'text-gray-700'
              )}
            >
              <UserMinus className="w-5 h-5" />
              <span className="text-[10px]">Retire Hurt</span>
            </button>
          </div>
        </>
      )}

      {/* ══════════════════ SCORECARD TAB ════════════════════════ */}
      {activeTab === 'scorecard' && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Scorecard innings={currentInnings} matchSettings={match.settings} />
        </div>
      )}

      {/* ══════════════════ OVERS TAB ════════════════════════════ */}
      {activeTab === 'overs' && matchId && (
        <div className="flex-1 overflow-y-auto">
          <OversList matchId={matchId} match={match} />
        </div>
      )}

      {/* ══════════════════ MODALS ══════════════════════════════ */}

      {/* Extras Modal */}
      <Drawer.Root open={showExtrasModal} onOpenChange={(open) => !open && setShowExtrasModal(false)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/70 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-5 z-50">
            <div className="mx-auto w-12 h-1 rounded-full bg-gray-700 mb-4" />
            <Drawer.Title className="text-lg font-bold mb-4">
              {extraType === ExtraType.NoBall ? 'Runs off bat?' : `${extraType === ExtraType.Bye ? 'Bye' : 'Leg Bye'} runs?`}
            </Drawer.Title>
            <div className="grid grid-cols-4 gap-3">
              {(extraType === ExtraType.NoBall ? [0, 1, 2, 3, 4, 6] : [1, 2, 3, 4]).map((r) => (
                <button
                  key={r}
                  onClick={() => submitExtra(r)}
                  className="bg-gray-800 hover:bg-gray-700 h-14 rounded-xl text-xl font-bold active:scale-95"
                >
                  {r}
                </button>
              ))}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Wicket Modal */}
      <Drawer.Root open={showWicketModal} onOpenChange={(open) => !open && toggleWicketModal()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/70 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-5 z-50 max-h-[85dvh] overflow-y-auto">
            <div className="mx-auto w-12 h-1 rounded-full bg-gray-700 mb-4" />
            <Drawer.Title className="text-lg font-bold mb-4">How was the batter out?</Drawer.Title>

            {/* Dismissal type chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.values(WicketType).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setWicketType(t);
                    // Reset batsmanOutId to striker for non-RunOut
                    if (t !== WicketType.RunOut && match.striker) {
                      setBatsmanOutId(match.striker.id);
                    }
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors',
                    wicketType === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* "Who is out?" — only for Run Out */}
            {wicketType === WicketType.RunOut && (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Who is out?</p>
                <div className="flex gap-2">
                  {match.striker && (
                    <button
                      onClick={() => setBatsmanOutId(match.striker!.id)}
                      className={cn(
                        'flex-1 p-3 rounded-xl border text-center transition-colors',
                        batsmanOutId === match.striker.id
                          ? 'border-red-500 bg-red-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300'
                      )}
                    >
                      <p className="font-semibold text-sm">{match.striker.name}</p>
                      <p className="text-xs text-gray-400">Striker</p>
                    </button>
                  )}
                  {match.nonStriker && (
                    <button
                      onClick={() => setBatsmanOutId(match.nonStriker!.id)}
                      className={cn(
                        'flex-1 p-3 rounded-xl border text-center transition-colors',
                        batsmanOutId === match.nonStriker.id
                          ? 'border-red-500 bg-red-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300'
                      )}
                    >
                      <p className="font-semibold text-sm">{match.nonStriker.name}</p>
                      <p className="text-xs text-gray-400">Non-striker</p>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Run Out: end + runs before */}
            {wicketType === WicketType.RunOut && (
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">Run out end</p>
                  <div className="flex gap-2">
                    {(['batting', 'bowling'] as const).map((end) => (
                      <button
                        key={end}
                        onClick={() => setRunOutEnd(end)}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-colors',
                          runOutEnd === end
                            ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                            : 'border-gray-700 bg-gray-800 text-gray-300'
                        )}
                      >
                        {end === 'batting' ? 'Batting end' : 'Bowling end'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {runOutEnd === 'batting'
                      ? 'New batsman takes the strike'
                      : 'New batsman is non-striker'}
                  </p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">Runs completed before run out</p>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRunsBefore(r)}
                        className={cn(
                          'flex-1 py-2 rounded-xl border text-sm font-bold transition-colors',
                          runsBefore === r
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-gray-700 bg-gray-800 text-gray-300'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Fielder name — for Caught, RunOut, Stumped */}
            {[WicketType.Caught, WicketType.RunOut, WicketType.Stumped].includes(wicketType) && (
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-1">
                  {wicketType === WicketType.Caught ? 'Caught by' : wicketType === WicketType.Stumped ? 'Stumped by' : 'Run out by'}
                </label>
                <PlayerNameInput
                  value={fielderName}
                  onChange={setFielderName}
                  placeholder="Enter fielder's name"
                  dbPlayers={dbPlayers}
                />
              </div>
            )}

            <button
              onClick={submitWicket}
              disabled={wicketType === WicketType.RunOut && !batsmanOutId}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl disabled:opacity-40"
            >
              Confirm Wicket
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* New Batsman Modal */}
      <Drawer.Root open={showNewBatsmanModal} onOpenChange={(open) => !open && toggleNewBatsmanModal()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/70 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-5 z-50">
            <div className="mx-auto w-12 h-1 rounded-full bg-gray-700 mb-4" />
            <Drawer.Title className="text-lg font-bold mb-4">New Batsman</Drawer.Title>
            <div className="mb-3">
              <PlayerNameInput
                value={newPlayerName}
                onChange={setNewPlayerName}
                placeholder="Enter batsman's name..."
                dbPlayers={dbPlayers}
                autoFocus
              />
            </div>
            {match.retiredBatsmen && match.retiredBatsmen.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Retired players:</p>
                {match.retiredBatsmen.map((id) => {
                  const card = currentInnings.battingCard.find((b: any) => b.playerId === id);
                  if (!card) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setNewPlayerName(card.playerName)}
                      className="w-full text-left bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-2.5 text-amber-200 text-sm mb-1.5 hover:bg-amber-900/40"
                    >
                      {card.playerName} <span className="text-amber-400">({card.runs} runs)</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={confirmNewBatsman}
              disabled={!newPlayerName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-40"
            >
              Confirm Batsman
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* New Bowler Modal */}
      <Drawer.Root open={showNewBowlerModal} onOpenChange={(open) => !open && toggleNewBowlerModal()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/70 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-5 z-50">
            <div className="mx-auto w-12 h-1 rounded-full bg-gray-700 mb-4" />
            <Drawer.Title className="text-lg font-bold mb-4">New Bowler</Drawer.Title>
            {currentInnings.bowlingCard.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Previous bowlers:</p>
                {currentInnings.bowlingCard.map((b: any) => {
                  const isLast = match.currentBowler?.id === b.playerId;
                  return (
                    <button
                      key={b.playerId}
                      disabled={isLast}
                      onClick={() => setNewBowlerName(b.playerName)}
                      className={cn(
                        'w-full text-left rounded-lg px-4 py-2.5 text-sm mb-1.5 flex justify-between',
                        isLast ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'
                      )}
                    >
                      <span>{b.playerName}</span>
                      <span className="text-gray-500 font-mono text-xs">
                        {oversToString(b.overs)}-{b.maidens}-{b.runsConceded}-{b.wickets}
                        {isLast && <span className="ml-2 text-gray-600">(last)</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mb-3">
              <PlayerNameInput
                value={newBowlerName}
                onChange={setNewBowlerName}
                placeholder="Enter bowler's name..."
                dbPlayers={dbPlayers}
              />
            </div>
            <button
              onClick={confirmNewBowler}
              disabled={!newBowlerName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-40"
            >
              Confirm Bowler
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

    </div>
  );
}
