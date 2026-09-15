import { describe, it, expect } from 'vitest';
import {
  formatOvers,
  oversToString,
  calculateRunRate,
  calculateRequiredRunRate,
  calculateStrikeRate,
  calculateEconomyRate,
  shouldRotateStrike,
  isLegalDelivery,
  formatBallDisplay,
  generateBallId,
  determineMatchResult,
  formatDismissal,
  getMaxWickets,
  isInningsComplete,
  isMatchComplete,
} from '../cricket';
import { ExtraType, WicketType } from '@/types/cricket';

describe('Cricket Utility Functions', () => {
  describe('formatOvers', () => {
    it('converts legal ball count to overs correctly', () => {
      expect(formatOvers(0)).toBe(0);
      expect(formatOvers(5)).toBe(0.5);
      expect(formatOvers(6)).toBe(1.0);
      expect(formatOvers(87)).toBe(14.3);
      expect(formatOvers(120)).toBe(20.0);
    });
  });

  describe('oversToString', () => {
    it('formats overs for display with single decimal', () => {
      expect(oversToString(0)).toBe('0.0');
      expect(oversToString(14.3)).toBe('14.3');
      expect(oversToString(15)).toBe('15.0');
    });
  });

  describe('calculateRunRate', () => {
    it('returns 0 when 0 legal balls bowled', () => {
      expect(calculateRunRate(0, 0)).toBe(0);
      expect(calculateRunRate(10, 0)).toBe(0);
    });

    it('calculates run rate correctly', () => {
      // 36 runs in 36 balls (6 overs) = 6.00
      expect(calculateRunRate(36, 36)).toBe(6);
      // 45 runs in 30 balls (5 overs) = 9.00
      expect(calculateRunRate(45, 30)).toBe(9);
      // 10 runs in 7 balls = 8.57
      expect(calculateRunRate(10, 7)).toBe(8.57);
    });
  });

  describe('calculateRequiredRunRate', () => {
    it('returns null if target is already reached or remaining balls <= 0', () => {
      expect(calculateRequiredRunRate(100, 100, 30)).toBeNull();
      expect(calculateRequiredRunRate(100, 105, 30)).toBeNull();
      expect(calculateRequiredRunRate(100, 80, 0)).toBeNull();
    });

    it('calculates required run rate correctly', () => {
      // Need 30 runs from 30 balls = 6.00
      expect(calculateRequiredRunRate(100, 70, 30)).toBe(6);
      // Need 25 runs from 12 balls = 12.50
      expect(calculateRequiredRunRate(100, 75, 12)).toBe(12.5);
    });
  });

  describe('calculateStrikeRate', () => {
    it('returns 0 if 0 balls faced', () => {
      expect(calculateStrikeRate(0, 0)).toBe(0);
    });

    it('calculates strike rate accurately', () => {
      expect(calculateStrikeRate(50, 25)).toBe(200);
      expect(calculateStrikeRate(35, 28)).toBe(125);
      expect(calculateStrikeRate(10, 7)).toBe(142.86);
    });
  });

  describe('calculateEconomyRate', () => {
    it('returns 0 if 0 legal balls bowled', () => {
      expect(calculateEconomyRate(10, 0)).toBe(0);
    });

    it('calculates bowler economy correctly', () => {
      expect(calculateEconomyRate(24, 24)).toBe(6);
      expect(calculateEconomyRate(15, 18)).toBe(5);
      expect(calculateEconomyRate(20, 15)).toBe(8);
    });
  });

  describe('shouldRotateStrike', () => {
    it('rotates strike on odd runs off the bat for normal balls', () => {
      expect(shouldRotateStrike(1, { type: null, runs: 0 })).toBe(true);
      expect(shouldRotateStrike(3, { type: null, runs: 0 })).toBe(true);
      expect(shouldRotateStrike(0, { type: null, runs: 0 })).toBe(false);
      expect(shouldRotateStrike(2, { type: null, runs: 0 })).toBe(false);
      expect(shouldRotateStrike(4, { type: null, runs: 0 })).toBe(false);
      expect(shouldRotateStrike(6, { type: null, runs: 0 })).toBe(false);
    });

    it('does not rotate strike on wides', () => {
      expect(shouldRotateStrike(0, { type: ExtraType.Wide, runs: 1 })).toBe(false);
      expect(shouldRotateStrike(0, { type: ExtraType.Wide, runs: 2 })).toBe(false);
    });

    it('rotates on no-balls if runs off bat is odd', () => {
      expect(shouldRotateStrike(1, { type: ExtraType.NoBall, runs: 1 })).toBe(true);
      expect(shouldRotateStrike(0, { type: ExtraType.NoBall, runs: 1 })).toBe(false);
      expect(shouldRotateStrike(4, { type: ExtraType.NoBall, runs: 1 })).toBe(false);
    });

    it('rotates on byes / leg byes if extra runs are odd', () => {
      expect(shouldRotateStrike(0, { type: ExtraType.Bye, runs: 1 })).toBe(true);
      expect(shouldRotateStrike(0, { type: ExtraType.Bye, runs: 2 })).toBe(false);
      expect(shouldRotateStrike(0, { type: ExtraType.LegBye, runs: 3 })).toBe(true);
      expect(shouldRotateStrike(0, { type: ExtraType.LegBye, runs: 4 })).toBe(false);
    });
  });

  describe('isLegalDelivery', () => {
    it('returns false for wide and no-ball', () => {
      expect(isLegalDelivery(ExtraType.Wide)).toBe(false);
      expect(isLegalDelivery(ExtraType.NoBall)).toBe(false);
    });

    it('returns true for legal balls, byes, and leg-byes', () => {
      expect(isLegalDelivery(null)).toBe(true);
      expect(isLegalDelivery(ExtraType.Bye)).toBe(true);
      expect(isLegalDelivery(ExtraType.LegBye)).toBe(true);
    });
  });

  describe('formatBallDisplay', () => {
    it('prioritizes wicket', () => {
      expect(
        formatBallDisplay({
          runsBat: 0,
          extras: { type: null, runs: 0 },
          isWicket: true,
          totalRuns: 0,
        })
      ).toBe('W');
    });

    it('formats dot and runs correctly', () => {
      expect(formatBallDisplay({ runsBat: 0, extras: { type: null, runs: 0 }, isWicket: false, totalRuns: 0 })).toBe('0');
      expect(formatBallDisplay({ runsBat: 1, extras: { type: null, runs: 0 }, isWicket: false, totalRuns: 1 })).toBe('1');
      expect(formatBallDisplay({ runsBat: 4, extras: { type: null, runs: 0 }, isWicket: false, totalRuns: 4 })).toBe('4');
      expect(formatBallDisplay({ runsBat: 6, extras: { type: null, runs: 0 }, isWicket: false, totalRuns: 6 })).toBe('6');
    });

    it('formats extras properly', () => {
      expect(formatBallDisplay({ runsBat: 0, extras: { type: ExtraType.Wide, runs: 1 }, isWicket: false, totalRuns: 1 })).toBe('Wd');
      expect(formatBallDisplay({ runsBat: 0, extras: { type: ExtraType.Wide, runs: 2 }, isWicket: false, totalRuns: 2 })).toBe('Wd+2');
      expect(formatBallDisplay({ runsBat: 0, extras: { type: ExtraType.NoBall, runs: 1 }, isWicket: false, totalRuns: 1 })).toBe('Nb');
      expect(formatBallDisplay({ runsBat: 4, extras: { type: ExtraType.NoBall, runs: 1 }, isWicket: false, totalRuns: 5 })).toBe('Nb+4');
      expect(formatBallDisplay({ runsBat: 0, extras: { type: ExtraType.Bye, runs: 1 }, isWicket: false, totalRuns: 1 })).toBe('B1');
      expect(formatBallDisplay({ runsBat: 0, extras: { type: ExtraType.LegBye, runs: 2 }, isWicket: false, totalRuns: 2 })).toBe('Lb2');
    });
  });

  describe('generateBallId', () => {
    it('generates zero-padded ball id', () => {
      expect(generateBallId(1, 1)).toBe('inn1_b001');
      expect(generateBallId(1, 14)).toBe('inn1_b014');
      expect(generateBallId(2, 105)).toBe('inn2_b105');
    });
  });

  describe('determineMatchResult', () => {
    const matchConfig = {
      team1: { name: 'Warriors' },
      team2: { name: 'Titans' },
      toss: { winnerTeam: 'team1' as const, decision: 'bat' as const },
      settings: { totalOvers: 10, playersPerSide: 6 },
    };

    it('determines win by wickets when team batting second wins', () => {
      const inn1 = { totalRuns: 80, totalWickets: 5, totalLegalBalls: 60 };
      const inn2 = { totalRuns: 81, totalWickets: 2, totalLegalBalls: 45 };
      const result = determineMatchResult(matchConfig, inn1, inn2);

      // 6 players per side => 5 max wickets. 5 - 2 = 3 wickets left
      expect(result.winner).toBe('team2');
      expect(result.margin).toBe('3 wickets');
      expect(result.resultText).toBe('Titans won by 3 wickets');
    });

    it('determines win by runs when team batting first wins', () => {
      const inn1 = { totalRuns: 100, totalWickets: 3, totalLegalBalls: 60 };
      const inn2 = { totalRuns: 85, totalWickets: 5, totalLegalBalls: 60 };
      const result = determineMatchResult(matchConfig, inn1, inn2);

      expect(result.winner).toBe('team1');
      expect(result.margin).toBe('15 runs');
      expect(result.resultText).toBe('Warriors won by 15 runs');
    });

    it('determines tie when runs are equal', () => {
      const inn1 = { totalRuns: 90, totalWickets: 4, totalLegalBalls: 60 };
      const inn2 = { totalRuns: 90, totalWickets: 5, totalLegalBalls: 60 };
      const result = determineMatchResult(matchConfig, inn1, inn2);

      expect(result.winner).toBe('tie');
      expect(result.resultText).toBe('Match tied');
    });
  });

  describe('formatDismissal', () => {
    it('formats bowled, caught, run out, stumped, and hit wicket', () => {
      expect(formatDismissal(WicketType.Bowled, 'Bumrah')).toBe('b Bumrah');
      expect(formatDismissal(WicketType.Caught, 'Bumrah', 'Kohli')).toBe('c Kohli b Bumrah');
      expect(formatDismissal(WicketType.RunOut, 'Bumrah', 'Jadeja')).toBe('run out (Jadeja)');
      expect(formatDismissal(WicketType.Stumped, 'Ashwin', 'Dhoni')).toBe('st Dhoni b Ashwin');
      expect(formatDismissal(WicketType.HitWicket, 'Bumrah')).toBe('hit wicket b Bumrah');
    });
  });

  describe('getMaxWickets and isInningsComplete', () => {
    it('getMaxWickets returns playersPerSide - 1', () => {
      expect(getMaxWickets(6)).toBe(5);
      expect(getMaxWickets(11)).toBe(10);
    });

    it('isInningsComplete checks both wickets and overs', () => {
      // 6 players per side = 5 wickets max, 10 overs = 60 balls
      expect(isInningsComplete(5, 30, 10, 6)).toBe(true); // all out
      expect(isInningsComplete(2, 60, 10, 6)).toBe(true); // all overs bowled
      expect(isInningsComplete(4, 59, 10, 6)).toBe(false); // still in progress
    });

    it('isMatchComplete checks target achievement', () => {
      expect(isMatchComplete(true, { totalRuns: 82 }, 80)).toBe(true);
      expect(isMatchComplete(true, { totalRuns: 79 }, 80)).toBe(false);
      expect(isMatchComplete(false, { totalRuns: 85 }, 80)).toBe(false);
    });
  });
});
