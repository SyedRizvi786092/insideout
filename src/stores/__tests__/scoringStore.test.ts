import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScoringStore } from '../scoringStore';
import {
  MatchStatus,
  InningsStatus,
  ExtraType,
  WicketType,
} from '@/types/cricket';
import type { Match, Innings } from '@/types/cricket';

// Mock firestore-service
vi.mock('@/lib/firestore-service', () => ({
  recordBallWithUpdates: vi.fn().mockResolvedValue(undefined),
  undoBallWithUpdates: vi.fn().mockResolvedValue(undefined),
  getLastBall: vi.fn().mockResolvedValue(null),
  updateMatch: vi.fn().mockResolvedValue(undefined),
}));

/** Helper: record N dot balls to advance currentOverBalls */
async function recordNDotBalls(n: number, match: Match, innings: Innings) {
  const store = useScoringStore.getState();
  for (let i = 0; i < n; i++) {
    await store.recordBall({
      matchId: match.id,
      match: {
        ...match,
        score: {
          ...match.score,
          legalBallsCount: useScoringStore.getState().currentOverBalls + (match.score.legalBallsCount ?? 0) - useScoringStore.getState().currentOverBalls,
        },
      },
      innings,
      runsBat: 0,
      extras: { type: null, runs: 0 },
      isWicket: false,
      dismissal: null,
    });
  }
}

describe('Scoring Store', () => {
  let mockMatch: Match;
  let mockInnings: Innings;

  beforeEach(() => {
    vi.clearAllMocks();
    useScoringStore.getState().reset();

    mockMatch = {
      id: 'match_123',
      seriesId: null,
      createdBy: 'user_1',
      scorerId: 'user_1',
      status: MatchStatus.Live,
      settings: {
        totalOvers: 10,
        playersPerSide: 6,
        extrasConfig: {
          widesEnabled: true,
          noBallsEnabled: true,
          byesEnabled: false,
          legByesEnabled: false,
        },
      },
      team1: { name: 'Warriors', playerIds: ['p1', 'p2'] },
      team2: { name: 'Titans', playerIds: ['p3', 'p4'] },
      toss: null,
      currentInnings: 1,
      score: {
        runs: 0,
        wickets: 0,
        overs: 0,
        legalBallsCount: 0,
        currentRunRate: 0,
        requiredRunRate: null,
        target: null,
      },
      striker: {
        id: 'p1',
        name: 'Batsman 1',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
      },
      nonStriker: {
        id: 'p2',
        name: 'Batsman 2',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
      },
      currentBowler: {
        id: 'p3',
        name: 'Bowler 1',
        overs: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        economyRate: 0,
      },
      recentBalls: [],
      lastBallId: null,
      retiredBatsmen: [],
      result: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockInnings = {
      inningsNumber: 1,
      matchId: 'match_123',
      battingTeam: 'team1',
      bowlingTeam: 'team2',
      totalRuns: 0,
      totalWickets: 0,
      totalOvers: 0,
      totalLegalBalls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      battingCard: [
        {
          playerId: 'p1',
          playerName: 'Batsman 1',
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          howOut: 'not out',
          battingPosition: 1,
        },
      ],
      bowlingCard: [
        {
          playerId: 'p3',
          playerName: 'Bowler 1',
          overs: 0,
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
          economyRate: 0,
        },
      ],
      fallOfWickets: [],
      status: InningsStatus.InProgress,
    };
  });

  // ─── Existing Tests ─────────────────────────────────────────────────────────

  it('throws an error if striker, nonStriker, or currentBowler is missing', async () => {
    mockMatch.striker = null;

    await expect(
      useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: mockMatch,
        innings: mockInnings,
        runsBat: 1,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      })
    ).rejects.toThrow('Missing active players');
  });

  it('records a dot ball (0 runs) correctly', async () => {
    const { recordBallWithUpdates } = await import('@/lib/firestore-service');

    await useScoringStore.getState().recordBall({
      matchId: 'match_123',
      match: mockMatch,
      innings: mockInnings,
      runsBat: 0,
      extras: { type: null, runs: 0 },
      isWicket: false,
      dismissal: null,
    });

    expect(recordBallWithUpdates).toHaveBeenCalledTimes(1);
    const payload = (recordBallWithUpdates as any).mock.calls[0][0];

    expect(payload.ball.runsBat).toBe(0);
    expect(payload.ball.totalRuns).toBe(0);
    expect(payload.ball.isLegalDelivery).toBe(true);
    expect(payload.matchUpdate.score.runs).toBe(0);
    expect(payload.matchUpdate.score.legalBallsCount).toBe(1);
    expect(payload.matchUpdate.score.overs).toBe(0.1);
  });

  it('records runs and handles strike rotation on odd runs', async () => {
    const { recordBallWithUpdates } = await import('@/lib/firestore-service');

    await useScoringStore.getState().recordBall({
      matchId: 'match_123',
      match: mockMatch,
      innings: mockInnings,
      runsBat: 1,
      extras: { type: null, runs: 0 },
      isWicket: false,
      dismissal: null,
    });

    const payload = (recordBallWithUpdates as any).mock.calls[0][0];
    expect(payload.matchUpdate.score.runs).toBe(1);
    // Strike should rotate: p2 becomes striker, p1 becomes nonStriker
    expect(payload.matchUpdate.striker.id).toBe('p2');
    expect(payload.matchUpdate.nonStriker.id).toBe('p1');
  });

  it('records a wide without incrementing legal balls or rotating strike', async () => {
    const { recordBallWithUpdates } = await import('@/lib/firestore-service');

    await useScoringStore.getState().recordBall({
      matchId: 'match_123',
      match: mockMatch,
      innings: mockInnings,
      runsBat: 0,
      extras: { type: ExtraType.Wide, runs: 1 },
      isWicket: false,
      dismissal: null,
    });

    const payload = (recordBallWithUpdates as any).mock.calls[0][0];
    expect(payload.ball.isLegalDelivery).toBe(false);
    expect(payload.matchUpdate.score.runs).toBe(1);
    expect(payload.matchUpdate.score.legalBallsCount).toBe(0);
    expect(payload.matchUpdate.score.overs).toBe(0);
    expect(payload.matchUpdate.striker.id).toBe('p1');
  });

  it('records a wicket and increments total wickets', async () => {
    const { recordBallWithUpdates } = await import('@/lib/firestore-service');

    await useScoringStore.getState().recordBall({
      matchId: 'match_123',
      match: mockMatch,
      innings: mockInnings,
      runsBat: 0,
      extras: { type: null, runs: 0 },
      isWicket: true,
      dismissal: {
        type: WicketType.Bowled,
        batsmanOutId: 'p1',
        fielderId: null,
        newBatsmanId: null,
      },
    });

    const payload = (recordBallWithUpdates as any).mock.calls[0][0];
    expect(payload.ball.isWicket).toBe(true);
    expect(payload.matchUpdate.score.wickets).toBe(1);
    expect(payload.matchUpdate.striker).toBeNull(); // Out batsman cleared to prompt new batsman
  });

  // ─── Phase I: New Tests ─────────────────────────────────────────────────────

  describe('Bowler overs calculation (Bug #9 fix)', () => {
    it('increments bowler overs correctly for consecutive balls: 0→0.1→0.2→…→1.0', async () => {
      const { recordBallWithUpdates } = await import('@/lib/firestore-service');

      const expectedOvers = [0.1, 0.2, 0.3, 0.4, 0.5, 1.0];

      for (let i = 0; i < 6; i++) {
        const state = useScoringStore.getState();
        // Update match with current bowler overs from previous call
        const prevPayload = i === 0 ? null : (recordBallWithUpdates as any).mock.calls[i - 1][0];
        const currentBowler = prevPayload ? prevPayload.matchUpdate.currentBowler : mockMatch.currentBowler;
        const currentScore = prevPayload ? prevPayload.matchUpdate.score : mockMatch.score;

        await state.recordBall({
          matchId: 'match_123',
          match: { ...mockMatch, currentBowler, score: currentScore },
          innings: mockInnings,
          runsBat: 0,
          extras: { type: null, runs: 0 },
          isWicket: false,
          dismissal: null,
        });

        const payload = (recordBallWithUpdates as any).mock.calls[i][0];
        expect(payload.matchUpdate.currentBowler.overs).toBe(expectedOvers[i]);
      }
    });

    it('does NOT use double formatOvers — 2.4 overs → next ball → 2.5', async () => {
      const { recordBallWithUpdates } = await import('@/lib/firestore-service');

      // Simulate bowler at 2.4 (=16 legal balls)
      const bowlerAt2_4 = { ...mockMatch.currentBowler!, overs: 2.4 };

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: { ...mockMatch, currentBowler: bowlerAt2_4 },
        innings: mockInnings,
        runsBat: 0,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      const payload = (recordBallWithUpdates as any).mock.calls[0][0];
      // rawBowlerBalls(2.4) = 2*6 + 4 = 16, +1 = 17, formatOvers(17) = 2.5
      expect(payload.matchUpdate.currentBowler.overs).toBe(2.5);
    });

    it('bowler overs correctly rolls over after 6 balls in an over: 0.5 → 1.0', async () => {
      const { recordBallWithUpdates } = await import('@/lib/firestore-service');

      const bowlerAt0_5 = { ...mockMatch.currentBowler!, overs: 0.5 };
      // Set store to ball 5 of the over (5 legal balls bowled = currentOverBalls=5)
      useScoringStore.setState({ currentOverBalls: 5, ballSequence: 6 });

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: {
          ...mockMatch,
          currentBowler: bowlerAt0_5,
          score: { ...mockMatch.score, legalBallsCount: 5 },
        },
        innings: mockInnings,
        runsBat: 0,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      const payload = (recordBallWithUpdates as any).mock.calls[0][0];
      // rawBowlerBalls(0.5) = 5, +1 = 6, formatOvers(6) = 1.0
      expect(payload.matchUpdate.currentBowler.overs).toBe(1.0);
    });
  });

  describe('Over lifecycle (Bug #10 fix)', () => {
    it('shows showNewBowlerModal after 6th legal ball', async () => {
      const store = useScoringStore.getState();
      // Manually set currentOverBalls to 5 (about to bowl 6th)
      useScoringStore.setState({ currentOverBalls: 5, ballSequence: 6 });

      await store.recordBall({
        matchId: 'match_123',
        match: { ...mockMatch, score: { ...mockMatch.score, legalBallsCount: 5 } },
        innings: mockInnings,
        runsBat: 0,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      expect(useScoringStore.getState().showNewBowlerModal).toBe(true);
      expect(useScoringStore.getState().currentOverBalls).toBe(0);
    });

    it('does NOT show showNewBowlerModal after 5th legal ball (not end of over)', async () => {
      useScoringStore.setState({ currentOverBalls: 4, ballSequence: 5 });

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: { ...mockMatch, score: { ...mockMatch.score, legalBallsCount: 4 } },
        innings: mockInnings,
        runsBat: 0,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      expect(useScoringStore.getState().showNewBowlerModal).toBe(false);
    });

    it('sets pendingNewBowler=true when wicket falls on last ball of over', async () => {
      useScoringStore.setState({ currentOverBalls: 5, ballSequence: 6 });

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: { ...mockMatch, score: { ...mockMatch.score, legalBallsCount: 5 } },
        innings: mockInnings,
        runsBat: 0,
        extras: { type: null, runs: 0 },
        isWicket: true,
        dismissal: {
          type: WicketType.Bowled,
          batsmanOutId: 'p1',
          fielderId: null,
          newBatsmanId: null,
        },
      });

      const state = useScoringStore.getState();
      expect(state.showNewBatsmanModal).toBe(true);
      expect(state.pendingNewBowler).toBe(true);
      expect(state.showNewBowlerModal).toBe(false); // Not shown yet — awaits batsman first
    });
  });

  describe('Strike rotation', () => {
    it('does NOT rotate on even runs (2)', async () => {
      const { recordBallWithUpdates } = await import('@/lib/firestore-service');

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: mockMatch,
        innings: mockInnings,
        runsBat: 2,
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      const payload = (recordBallWithUpdates as any).mock.calls[0][0];
      expect(payload.matchUpdate.striker.id).toBe('p1'); // No rotation
    });

    it('rotates strike at end of over regardless of runs scored', async () => {
      const { recordBallWithUpdates } = await import('@/lib/firestore-service');
      useScoringStore.setState({ currentOverBalls: 5, ballSequence: 6 });

      await useScoringStore.getState().recordBall({
        matchId: 'match_123',
        match: { ...mockMatch, score: { ...mockMatch.score, legalBallsCount: 5 } },
        innings: mockInnings,
        runsBat: 2, // Even — no bat rotation, but end-of-over always rotates
        extras: { type: null, runs: 0 },
        isWicket: false,
        dismissal: null,
      });

      const payload = (recordBallWithUpdates as any).mock.calls[0][0];
      // End of over: batsmen swap so p2 faces next over
      expect(payload.matchUpdate.striker.id).toBe('p2');
    });
  });

  describe('swapBatsmen action (Bug #14)', () => {
    it('swaps striker and nonStriker correctly', async () => {
      const { updateMatch } = await import('@/lib/firestore-service');

      await useScoringStore.getState().swapBatsmen('match_123', mockMatch);

      expect(updateMatch).toHaveBeenCalledWith('match_123', {
        striker: mockMatch.nonStriker,
        nonStriker: mockMatch.striker,
      });
    });

    it('does nothing if striker or nonStriker is null', async () => {
      const { updateMatch } = await import('@/lib/firestore-service');
      mockMatch.striker = null;

      await useScoringStore.getState().swapBatsmen('match_123', mockMatch);

      expect(updateMatch).not.toHaveBeenCalled();
    });
  });
});
