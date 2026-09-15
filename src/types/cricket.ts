// ============================================================
// Cricket Scorer — Core Type Definitions
// ============================================================

// --- Enums ---

export enum MatchStatus {
  Setup = 'setup',
  Live = 'live',
  InningsBreak = 'innings_break',
  Completed = 'completed',
  Abandoned = 'abandoned',
}

export enum InningsStatus {
  InProgress = 'in_progress',
  Completed = 'completed',
}

export enum ExtraType {
  Wide = 'wide',
  NoBall = 'noBall',
  Bye = 'bye',
  LegBye = 'legBye',
}

export enum WicketType {
  Bowled = 'bowled',
  Caught = 'caught',
  RunOut = 'run_out',
  Stumped = 'stumped',
  HitWicket = 'hit_wicket',
}

export enum TossDecision {
  Bat = 'bat',
  Bowl = 'bowl',
}

export enum UserRole {
  Admin = 'admin',
  Approved = 'approved',
  Pending = 'pending',
  Guest = 'guest',
}

// --- Configuration ---

export interface ExtrasConfig {
  widesEnabled: boolean;    // default: true
  noBallsEnabled: boolean;  // default: true
  byesEnabled: boolean;     // default: false
  legByesEnabled: boolean;  // default: false
}

export const DEFAULT_EXTRAS_CONFIG: ExtrasConfig = {
  widesEnabled: true,
  noBallsEnabled: true,
  byesEnabled: false,
  legByesEnabled: false,
};

// --- Player Types ---

export interface Player {
  id: string;
  name: string;
  linkedUserId: string | null;
  photoURL: string | null;
  isRegistered: boolean;
  createdAt: Date;
  lifetimeStats: LifetimeStats;
}

export interface LifetimeStats {
  matches: number;
  batting: {
    innings: number;
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    highestScore: number;
    notOuts: number;
    average: number;
    strikeRate: number;
  };
  bowling: {
    innings: number;
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    bestFigures: string; // e.g. "3/15"
    average: number;
    economyRate: number;
  };
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
  };
}

export const EMPTY_LIFETIME_STATS: LifetimeStats = {
  matches: 0,
  batting: {
    innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
    highestScore: 0, notOuts: 0, average: 0, strikeRate: 0,
  },
  bowling: {
    innings: 0, overs: 0, maidens: 0, runsConceded: 0, wickets: 0,
    bestFigures: '0/0', average: 0, economyRate: 0,
  },
  fielding: { catches: 0, runOuts: 0, stumpings: 0 },
};

// --- User Types ---

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: UserRole;
  linkedPlayerId: string | null;
  createdAt: Date;
}

// --- Team Types ---

export interface Team {
  name: string;
  playerIds: string[];
}

// --- Match Types ---

export interface TossInfo {
  winnerTeam: 'team1' | 'team2';
  decision: TossDecision;
}

export interface MatchSettings {
  totalOvers: number;       // 1-20
  playersPerSide: number;
  extrasConfig: ExtrasConfig;
}

export interface ActiveBatsmanInfo {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

export interface ActiveBowlerInfo {
  id: string;
  name: string;
  overs: number;        // e.g. 3.4
  maidens: number;
  runsConceded: number;
  wickets: number;
  economyRate: number;
}

export interface RecentBallDisplay {
  ballId: string;
  display: string;       // '0', '1', '4', '6', 'W', 'Wd', 'Nb', 'Wd+1', etc.
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
}

export interface ScoreSummary {
  runs: number;
  wickets: number;
  overs: number;           // e.g. 16.4
  legalBallsCount: number; // e.g. 100
  currentRunRate: number;
  requiredRunRate: number | null;
  target: number | null;
}

export interface MatchResult {
  winner: 'team1' | 'team2' | 'tie' | null;
  margin: string;          // e.g. "5 wickets", "23 runs"
  resultText: string;      // e.g. "Team A won by 5 wickets"
}

export interface Match {
  id: string;
  seriesId: string | null;
  createdBy: string;         // UID of match creator
  scorerId: string;          // UID of current scorer
  status: MatchStatus;
  settings: MatchSettings;
  team1: Team;
  team2: Team;
  toss: TossInfo | null;
  currentInnings: 1 | 2;
  score: ScoreSummary;
  striker: ActiveBatsmanInfo | null;
  nonStriker: ActiveBatsmanInfo | null;
  currentBowler: ActiveBowlerInfo | null;
  recentBalls: RecentBallDisplay[];
  lastBallId: string | null;
  retiredBatsmen: string[];   // playerIds who retired hurt (can return)
  result: MatchResult | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Innings Types ---

export interface BattingCardEntry {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  howOut: string;            // e.g. "c Kohli b Bumrah" or "not out" or "retired hurt"
  battingPosition: number;
}

export interface BowlingCardEntry {
  playerId: string;
  playerName: string;
  overs: number;             // e.g. 4.0
  maidens: number;
  runsConceded: number;
  wickets: number;
  economyRate: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;             // team score when wicket fell
  overs: number;             // overs when wicket fell
  batsmanId: string;
  batsmanName: string;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  total: number;
}

export interface Innings {
  inningsNumber: 1 | 2;
  matchId: string;
  battingTeam: 'team1' | 'team2';
  bowlingTeam: 'team1' | 'team2';
  totalRuns: number;
  totalWickets: number;
  totalOvers: number;         // e.g. 16.4
  totalLegalBalls: number;
  extras: ExtrasBreakdown;
  battingCard: BattingCardEntry[];
  bowlingCard: BowlingCardEntry[];
  fallOfWickets: FallOfWicket[];
  status: InningsStatus;
}

// --- Ball Types ---

export interface BallExtras {
  type: ExtraType | null;
  runs: number;
}

export interface Dismissal {
  type: WicketType;
  batsmanOutId: string;
  fielderId: string | null;    // for caught, run out, stumped
  newBatsmanId: string | null; // who comes in next
}

/** Snapshot of the match state BEFORE this ball was bowled (for undo) */
export interface PreviousState {
  runs: number;
  wickets: number;
  overs: number;
  legalBallsCount: number;
  strikerId: string;
  nonStrikerId: string;
  striker: ActiveBatsmanInfo;
  nonStriker: ActiveBatsmanInfo;
  bowler: ActiveBowlerInfo;
  recentBalls: RecentBallDisplay[];
}

export interface Ball {
  id: string;                  // e.g. 'inn1_b087'
  innings: 1 | 2;
  overNumber: number;
  ballInOver: number;          // legal ball number in current over
  ballSequence: number;        // strictly incrementing across all balls
  batsmanId: string;
  bowlerId: string;
  runsBat: number;             // runs off the bat (0, 1, 2, 3, 4, 6)
  extras: BallExtras;
  totalRuns: number;           // runsBat + extras.runs
  isLegalDelivery: boolean;    // false if wide or no-ball
  isWicket: boolean;
  dismissal: Dismissal | null;
  previousState: PreviousState;
  timestamp: Date;
}

// --- Series Types ---

export interface SeriesStandings {
  [teamName: string]: {
    played: number;
    won: number;
    lost: number;
    tied: number;
  };
}

export interface Series {
  id: string;
  name: string;
  createdBy: string;
  status: 'active' | 'completed';
  matchIds: string[];
  standings: SeriesStandings;
  createdAt: Date;
}

// --- Player Match Stats ---

export interface PlayerMatchStats {
  playerId: string;
  matchId: string;
  batting: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    isOut: boolean;
    howOut: string;
    battingPosition: number;
  } | null;
  bowling: {
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    economyRate: number;
  } | null;
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
  };
}
