import { create } from 'zustand';
import {
  Match,
  Innings,
  Ball,
  BallExtras,
  Dismissal,
  PreviousState,
  RecentBallDisplay,
  ExtraType,
  InningsStatus,
} from '@/types/cricket';
import {
  recordBallWithUpdates,
  undoBallWithUpdates,
  getLastBall,
  updateMatch,
} from '@/lib/firestore-service';
import {
  calculateRunRate,
  calculateRequiredRunRate,
  calculateStrikeRate,
  calculateEconomyRate,
  formatOvers,
  formatBallDisplay,
  generateBallId,
  shouldRotateStrike,
  isInningsComplete,
  isLegalDelivery,
} from '@/lib/cricket';

interface RecordBallParams {
  matchId: string;
  match: Match;
  innings: Innings;
  runsBat: number;
  extras: BallExtras;
  isWicket: boolean;
  dismissal: Dismissal | null;
}

interface ScoringState {
  isScoring: boolean;
  ballSequence: number;
  currentOverBalls: number;
  showWicketModal: boolean;
  showNewBatsmanModal: boolean;
  showNewBowlerModal: boolean;
  showExtrasModal: boolean;
  /** True when the over ended on the same ball as a wicket — after new batsman is confirmed, new bowler modal must open */
  pendingNewBowler: boolean;

  recordBall: (params: RecordBallParams) => Promise<void>;
  undoLastBall: (matchId: string, match: Match) => Promise<void>;
  startNewOver: () => void;
  retireHurt: (matchId: string, match: Match, batsmanId: string) => Promise<void>;
  swapBatsmen: (matchId: string, match: Match) => Promise<void>;

  setScoring: (isScoring: boolean) => void;
  toggleWicketModal: () => void;
  toggleExtrasModal: () => void;
  toggleNewBatsmanModal: () => void;
  toggleNewBowlerModal: () => void;
  clearPendingNewBowler: () => void;
  reset: () => void;
}

/**
 * Convert display-format overs (e.g. 2.4) to raw legal ball count (e.g. 16).
 * formatOvers stores balls-in-over as tenths, not sixths, so we parse accordingly.
 */
function rawBowlerBalls(overs: number): number {
  return Math.floor(overs) * 6 + Math.round((overs % 1) * 10);
}

export const useScoringStore = create<ScoringState>((set, get) => ({
  isScoring: false,
  ballSequence: 1,
  currentOverBalls: 0,
  showWicketModal: false,
  showNewBatsmanModal: false,
  showNewBowlerModal: false,
  showExtrasModal: false,
  pendingNewBowler: false,

  recordBall: async ({
    matchId,
    match,
    innings,
    runsBat,
    extras,
    isWicket,
    dismissal,
  }) => {
    if (!match.striker || !match.nonStriker || !match.currentBowler) {
      throw new Error('Missing active players');
    }

    const isLegal = isLegalDelivery(extras.type);

    // Total runs for this delivery
    let totalRuns = runsBat;
    if (extras.type === ExtraType.Wide || extras.type === ExtraType.NoBall) {
      totalRuns += extras.runs || 1; // Wide/NB default to 1 run penalty + any extras
    } else if (extras.type === ExtraType.Bye || extras.type === ExtraType.LegBye) {
      totalRuns += extras.runs;
    }

    // Previous State Snapshot
    const previousState: PreviousState = {
      runs: match.score.runs,
      wickets: match.score.wickets,
      overs: match.score.overs,
      legalBallsCount: match.score.legalBallsCount,
      strikerId: match.striker.id,
      nonStrikerId: match.nonStriker.id,
      striker: { ...match.striker },
      nonStriker: { ...match.nonStriker },
      bowler: { ...match.currentBowler },
      recentBalls: [...match.recentBalls],
    };

    const { ballSequence, currentOverBalls } = get();

    // Calculate new legal balls and overs
    const newLegalBallsCount = isLegal ? match.score.legalBallsCount + 1 : match.score.legalBallsCount;
    const newOvers = formatOvers(newLegalBallsCount);

    // Create the Ball object
    const ballId = generateBallId(match.currentInnings, ballSequence);
    const overNumber = Math.floor(newLegalBallsCount / 6);

    const ball: Ball = {
      id: ballId,
      innings: match.currentInnings,
      overNumber,
      ballInOver: isLegal ? currentOverBalls + 1 : currentOverBalls,
      ballSequence,
      batsmanId: match.striker.id,
      bowlerId: match.currentBowler.id,
      runsBat,
      extras,
      totalRuns,
      isLegalDelivery: isLegal,
      isWicket,
      dismissal,
      previousState,
      timestamp: new Date(),
    };

    // Calculate new team score
    const newTeamRuns = match.score.runs + totalRuns;
    const newWickets = isWicket ? match.score.wickets + 1 : match.score.wickets;

    // Run Rates
    const currentRunRate = calculateRunRate(newTeamRuns, newLegalBallsCount);
    const requiredRunRate = match.score.target
      ? calculateRequiredRunRate(match.score.target, newTeamRuns, (match.settings.totalOvers * 6) - newLegalBallsCount)
      : null;

    // Batting Updates (Striker)
    const runsForBatsman = (extras.type === ExtraType.Wide || extras.type === ExtraType.Bye || extras.type === ExtraType.LegBye) ? 0 : runsBat;
    const ballsFacedForBatsman = extras.type === ExtraType.Wide ? 0 : 1;

    const newStriker = { ...match.striker };
    newStriker.runs += runsForBatsman;
    newStriker.balls += ballsFacedForBatsman;
    if (runsForBatsman === 4) newStriker.fours += 1;
    if (runsForBatsman === 6) newStriker.sixes += 1;
    newStriker.strikeRate = calculateStrikeRate(newStriker.runs, newStriker.balls);

    // Bowling Updates — FIX: compute raw ball count first, THEN increment once
    const newBowler = { ...match.currentBowler };
    const runsAgainstBowler = (extras.type === ExtraType.Bye || extras.type === ExtraType.LegBye) ? 0 : totalRuns;
    newBowler.runsConceded += runsAgainstBowler;
    if (isLegal) {
      // rawBowlerBalls converts display format (e.g. 2.4) to raw count (e.g. 16)
      // then we add 1 and convert back to display format — no double-call
      newBowler.overs = formatOvers(rawBowlerBalls(newBowler.overs) + 1);
    }
    if (isWicket && dismissal?.type !== 'run_out') {
      newBowler.wickets += 1;
    }
    const totalBowlerLegalBalls = rawBowlerBalls(newBowler.overs);
    newBowler.economyRate = calculateEconomyRate(newBowler.runsConceded, totalBowlerLegalBalls);

    // Strike Rotation
    const rotate = shouldRotateStrike(runsBat, extras);
    let nextStriker = rotate ? match.nonStriker : newStriker;
    let nextNonStriker = rotate ? newStriker : match.nonStriker;

    // Handle end of over rotation
    const isEndOfOver = isLegal && (currentOverBalls + 1) === 6;
    if (isEndOfOver) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    // Recent Balls Display
    const ballDisplay: RecentBallDisplay = {
      ballId,
      display: formatBallDisplay({ runsBat, extras, isWicket, totalRuns }),
      isWicket,
      isBoundary: runsBat === 4 || runsBat === 6,
      isExtra: extras.type !== null,
    };

    const newRecentBalls = [...match.recentBalls, ballDisplay];

    // Update Innings Data
    const newBattingCard = [...innings.battingCard];
    const updateBattingCard = (activeBatsman: typeof match.striker, isOut: boolean, howOut: string) => {
      const idx = newBattingCard.findIndex(b => b.playerId === activeBatsman.id);
      if (idx >= 0) {
        newBattingCard[idx] = {
          ...newBattingCard[idx],
          runs: activeBatsman.runs,
          balls: activeBatsman.balls,
          fours: activeBatsman.fours,
          sixes: activeBatsman.sixes,
          strikeRate: activeBatsman.strikeRate,
          isOut,
          howOut: isOut ? howOut : newBattingCard[idx].howOut,
        };
      }
    };

    let howOut = 'not out';
    if (isWicket && dismissal) {
      const bowlerName = match.currentBowler.name;
      const fielderName = dismissal.fielderId; // stores the fielder's display name
      switch (dismissal.type) {
        case 'bowled':
          howOut = `b ${bowlerName}`;
          break;
        case 'caught':
          howOut = fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
          break;
        case 'stumped':
          howOut = fielderName ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`;
          break;
        case 'run_out':
          howOut = fielderName ? `Run Out (${fielderName})` : 'Run Out';
          break;
        case 'hit_wicket':
          howOut = `Hit Wicket b ${bowlerName}`;
          break;
      }
    }

    updateBattingCard(newStriker, isWicket && dismissal?.batsmanOutId === newStriker.id, howOut);
    if (isWicket && dismissal?.batsmanOutId === nextNonStriker.id) {
      // Non-striker is only out via run out; include fielder name if available
      const runOutText = dismissal.fielderId ? `Run Out (${dismissal.fielderId})` : 'Run Out';
      updateBattingCard(nextNonStriker, true, runOutText);
    }

    const newBowlingCard = [...innings.bowlingCard];
    const bowlerIdx = newBowlingCard.findIndex(b => b.playerId === newBowler.id);
    if (bowlerIdx >= 0) {
      newBowlingCard[bowlerIdx] = {
        ...newBowlingCard[bowlerIdx],
        overs: newBowler.overs,
        runsConceded: newBowler.runsConceded,
        wickets: newBowler.wickets,
        economyRate: newBowler.economyRate,
      };
    } else {
      newBowlingCard.push({
        playerId: newBowler.id,
        playerName: newBowler.name,
        overs: newBowler.overs,
        maidens: 0,
        runsConceded: newBowler.runsConceded,
        wickets: newBowler.wickets,
        economyRate: newBowler.economyRate,
      });
    }

    const newExtrasBreakdown = { ...innings.extras };
    if (extras.type === ExtraType.Wide) newExtrasBreakdown.wides += extras.runs || 1;
    if (extras.type === ExtraType.NoBall) newExtrasBreakdown.noBalls += extras.runs || 1;
    if (extras.type === ExtraType.Bye) newExtrasBreakdown.byes += extras.runs;
    if (extras.type === ExtraType.LegBye) newExtrasBreakdown.legByes += extras.runs;
    newExtrasBreakdown.total = newExtrasBreakdown.wides + newExtrasBreakdown.noBalls + newExtrasBreakdown.byes + newExtrasBreakdown.legByes;

    const newFallOfWickets = [...innings.fallOfWickets];
    if (isWicket && dismissal) {
      const batsmanOutId = dismissal.batsmanOutId;
      const batsmanOutName = batsmanOutId === newStriker.id ? newStriker.name : match.nonStriker.name;
      newFallOfWickets.push({
        wicketNumber: newWickets,
        score: newTeamRuns,
        overs: newOvers,
        batsmanId: batsmanOutId,
        batsmanName: batsmanOutName,
      });
    }

    const inningsComplete = isInningsComplete(newWickets, newLegalBallsCount, match.settings.totalOvers, match.settings.playersPerSide);

    // Build updates
    const matchUpdate: Partial<Match> = {
      score: {
        runs: newTeamRuns,
        wickets: newWickets,
        overs: newOvers,
        legalBallsCount: newLegalBallsCount,
        currentRunRate,
        requiredRunRate,
        target: match.score.target,
      },
      striker: isWicket && dismissal?.batsmanOutId === nextStriker.id ? null : nextStriker,
      nonStriker: isWicket && dismissal?.batsmanOutId === nextNonStriker.id ? null : nextNonStriker,
      currentBowler: newBowler,
      recentBalls: isEndOfOver ? [] : newRecentBalls,
      lastBallId: ballId,
    };

    const inningsUpdate: Partial<Innings> = {
      totalRuns: newTeamRuns,
      totalWickets: newWickets,
      totalOvers: newOvers,
      totalLegalBalls: newLegalBallsCount,
      extras: newExtrasBreakdown,
      battingCard: newBattingCard,
      bowlingCard: newBowlingCard,
      fallOfWickets: newFallOfWickets,
      status: inningsComplete ? InningsStatus.Completed : InningsStatus.InProgress,
    };

    await recordBallWithUpdates({
      matchId,
      ball,
      matchUpdate,
      inningsUpdate,
    });

    set({
      ballSequence: ballSequence + 1,
      currentOverBalls: isEndOfOver ? 0 : (isLegal ? currentOverBalls + 1 : currentOverBalls),
      showWicketModal: false,
      showExtrasModal: false,
    });

    if (inningsComplete) {
      // No modals when innings is over
      return;
    }

    if (isWicket && isEndOfOver) {
      // Both conditions: show new batsman first, then new bowler
      set({ showNewBatsmanModal: true, pendingNewBowler: true });
    } else if (isWicket) {
      set({ showNewBatsmanModal: true });
    } else if (isEndOfOver) {
      set({ showNewBowlerModal: true });
    }
  },

  undoLastBall: async (matchId: string, match: Match) => {
    if (!match.lastBallId) return;

    const lastBall = await getLastBall(matchId, match.lastBallId);
    if (!lastBall) return;

    const { previousState } = lastBall;

    // Reconstruct match restore
    const matchRestore: Partial<Match> = {
      score: {
        ...match.score,
        runs: previousState.runs,
        wickets: previousState.wickets,
        overs: previousState.overs,
        legalBallsCount: previousState.legalBallsCount,
      },
      striker: previousState.striker,
      nonStriker: previousState.nonStriker,
      currentBowler: previousState.bowler,
      recentBalls: previousState.recentBalls,
      lastBallId: null,
    };

    const inningsRestore: Partial<Innings> = {
      totalRuns: previousState.runs,
      totalWickets: previousState.wickets,
      totalOvers: previousState.overs,
      totalLegalBalls: previousState.legalBallsCount,
    };

    await undoBallWithUpdates(matchId, lastBall.id, lastBall.innings, matchRestore, inningsRestore);

    set((state) => ({
      ballSequence: Math.max(1, state.ballSequence - 1),
      currentOverBalls: lastBall.ballInOver > 0 ? (lastBall.isLegalDelivery ? lastBall.ballInOver - 1 : lastBall.ballInOver) : 0,
    }));
  },

  startNewOver: () => {
    set({ currentOverBalls: 0, showNewBowlerModal: true });
  },

  retireHurt: async (matchId: string, match: Match, batsmanId: string) => {
    const retiredBatsmen = [...(match.retiredBatsmen || []), batsmanId];

    const isStriker = match.striker?.id === batsmanId;
    const matchUpdate: Partial<Match> = {
      retiredBatsmen,
      striker: isStriker ? null : match.striker,
      nonStriker: !isStriker ? null : match.nonStriker,
    };

    await updateMatch(matchId, matchUpdate);

    set({ showNewBatsmanModal: true });
  },

  swapBatsmen: async (matchId: string, match: Match) => {
    if (!match.striker || !match.nonStriker) return;
    await updateMatch(matchId, {
      striker: match.nonStriker,
      nonStriker: match.striker,
    });
  },

  setScoring: (isScoring) => set({ isScoring }),
  toggleWicketModal: () => set((s) => ({ showWicketModal: !s.showWicketModal })),
  toggleExtrasModal: () => set((s) => ({ showExtrasModal: !s.showExtrasModal })),
  toggleNewBatsmanModal: () => set((s) => ({ showNewBatsmanModal: !s.showNewBatsmanModal })),
  toggleNewBowlerModal: () => set((s) => ({ showNewBowlerModal: !s.showNewBowlerModal })),
  clearPendingNewBowler: () => set({ pendingNewBowler: false }),
  reset: () => set({
    isScoring: false,
    ballSequence: 1,
    currentOverBalls: 0,
    showWicketModal: false,
    showNewBatsmanModal: false,
    showNewBowlerModal: false,
    showExtrasModal: false,
    pendingNewBowler: false,
  }),
}));
