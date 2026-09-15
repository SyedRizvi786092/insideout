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
});
