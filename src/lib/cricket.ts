import { ExtraType, WicketType } from '../types/cricket';
import type { MatchResult } from '../types/cricket';

/**
 * Convert legal ball count to overs format. E.g., 87 balls → 14.3.
 */
export function formatOvers(legalBalls: number, ballsPerOver: number = 6): number {
  return Math.floor(legalBalls / ballsPerOver) + (legalBalls % ballsPerOver) / 10;
}

/**
 * Format overs number for display. E.g., 14.3 → '14.3', 15.0 → '15.0'
 */
export function oversToString(overs: number): string {
  return overs.toFixed(1);
}

/**
 * Calculate current run rate (runs per over). Return 0 if no balls bowled.
 */
export function calculateRunRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return Number(((runs / legalBalls) * 6).toFixed(2));
}

/**
 * Calculate required run rate. Return null if target already reached or no balls remaining.
 */
export function calculateRequiredRunRate(
  target: number,
  currentRuns: number,
  remainingBalls: number
): number | null {
  if (currentRuns >= target || remainingBalls <= 0) return null;
  return Number((((target - currentRuns) / remainingBalls) * 6).toFixed(2));
}

/**
 * Calculate batting strike rate. Return 0 if no balls faced.
 */
export function calculateStrikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return Number(((runs / balls) * 100).toFixed(2));
}

/**
 * Calculate bowling economy rate. Return 0 if no balls bowled.
 */
export function calculateEconomyRate(runsConceded: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return Number(((runsConceded / legalBalls) * 6).toFixed(2));
}

/**
 * Determine if strike should rotate after a delivery.
 * Strike rotates on odd runs off the bat.
 * For wides: no strike rotation.
 * For no-balls: rotate if odd runs off bat.
 * For byes/leg-byes: rotate if odd extra runs.
 */
export function shouldRotateStrike(
  runsBat: number,
  extras: { type: ExtraType | null; runs: number }
): boolean {
  if (extras.type === ExtraType.Wide) return false;
  if (extras.type === ExtraType.NoBall) return runsBat % 2 !== 0;
  if (extras.type === ExtraType.Bye || extras.type === ExtraType.LegBye) {
    return extras.runs % 2 !== 0;
  }
  return runsBat % 2 !== 0;
}

/**
 * Wides and no-balls are not legal deliveries.
 */
export function isLegalDelivery(extraType: ExtraType | null): boolean {
  return extraType !== ExtraType.Wide && extraType !== ExtraType.NoBall;
}

/**
 * Format a ball for the 'this over' display.
 * If wicket AND extra, show 'W' as priority.
 */
export function formatBallDisplay(ball: {
  runsBat: number;
  extras: { type: ExtraType | null; runs: number };
  isWicket: boolean;
  totalRuns: number;
}): string {
  if (ball.isWicket) return 'W';
  if (ball.extras.type) {
    if (ball.extras.type === ExtraType.Wide) {
      return ball.totalRuns > 1 ? `Wd+${ball.totalRuns}` : 'Wd';
    }
    if (ball.extras.type === ExtraType.NoBall) {
      return ball.runsBat > 0 ? `Nb+${ball.runsBat}` : 'Nb';
    }
    if (ball.extras.type === ExtraType.Bye) return `B${ball.extras.runs}`;
    if (ball.extras.type === ExtraType.LegBye) return `Lb${ball.extras.runs}`;
  }
  return ball.runsBat === 0 ? '0' : ball.runsBat.toString();
}

/**
 * Generate deterministic ball ID.
 */
export function generateBallId(innings: number, ballSequence: number): string {
  return `inn${innings}_b${ballSequence.toString().padStart(3, '0')}`;
}

/**
 * Determine match result after both innings.
 */
export function determineMatchResult(
  match: {
    team1: { name: string };
    team2: { name: string };
    toss: { winnerTeam: 'team1' | 'team2'; decision: 'bat' | 'bowl' } | null;
    settings: { totalOvers: number; playersPerSide: number };
  },
  innings1: { totalRuns: number; totalWickets: number; totalLegalBalls: number },
  innings2: { totalRuns: number; totalWickets: number; totalLegalBalls: number }
): MatchResult {
  let batFirstTeam = 'team1';
  let batSecondTeam = 'team2';

  if (match.toss) {
    if (match.toss.decision === 'bat') {
      batFirstTeam = match.toss.winnerTeam;
      batSecondTeam = match.toss.winnerTeam === 'team1' ? 'team2' : 'team1';
    } else {
      batSecondTeam = match.toss.winnerTeam;
      batFirstTeam = match.toss.winnerTeam === 'team1' ? 'team2' : 'team1';
    }
  }

  const batFirstName = batFirstTeam === 'team1' ? match.team1.name : match.team2.name;
  const batSecondName = batSecondTeam === 'team1' ? match.team1.name : match.team2.name;

  if (innings2.totalRuns > innings1.totalRuns) {
    const wicketsLeft = match.settings.playersPerSide - 1 - innings2.totalWickets;
    return {
      winner: batSecondTeam as 'team1' | 'team2',
      margin: `${wicketsLeft} wickets`,
      resultText: `${batSecondName} won by ${wicketsLeft} wickets`,
    };
  } else if (innings1.totalRuns > innings2.totalRuns) {
    const runsDiff = innings1.totalRuns - innings2.totalRuns;
    return {
      winner: batFirstTeam as 'team1' | 'team2',
      margin: `${runsDiff} runs`,
      resultText: `${batFirstName} won by ${runsDiff} runs`,
    };
  } else {
    return {
      winner: 'tie',
      margin: '0',
      resultText: 'Match tied',
    };
  }
}

/**
 * Format dismissal text.
 */
export function formatDismissal(
  wicketType: WicketType,
  bowlerName: string,
  fielderName?: string
): string {
  const fName = fielderName || 'Sub';
  switch (wicketType) {
    case WicketType.Bowled:
      return `b ${bowlerName}`;
    case WicketType.Caught:
      return `c ${fName} b ${bowlerName}`;
    case WicketType.RunOut:
      return `run out (${fName})`;
    case WicketType.Stumped:
      return `st ${fName} b ${bowlerName}`;
    case WicketType.HitWicket:
      return `hit wicket b ${bowlerName}`;
    default:
      return 'out';
  }
}

/**
 * Maximum wickets = playersPerSide - 1.
 */
export function getMaxWickets(playersPerSide: number): number {
  return playersPerSide - 1;
}

/**
 * Innings is complete when all overs are bowled OR all wickets have fallen.
 */
export function isInningsComplete(
  wickets: number,
  legalBalls: number,
  totalOvers: number,
  playersPerSide: number
): boolean {
  return wickets >= getMaxWickets(playersPerSide) || legalBalls >= totalOvers * 6;
}

/**
 * Match is complete when innings 2 is complete, or innings 2 surpasses the target.
 */
export function isMatchComplete(
  innings1Complete: boolean,
  innings2: { totalRuns: number } | null,
  target: number | null
): boolean {
  if (!innings1Complete || !innings2 || !target) return false;
  return innings2.totalRuns >= target;
}
