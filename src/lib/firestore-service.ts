import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Match,
  Innings,
  Ball,
  Player,
  Series,
  PlayerMatchStats,
  AppUser,
  MatchSettings,
  Team,
  TossInfo,
  ScoreSummary,
  ActiveBatsmanInfo,
  ActiveBowlerInfo,
  RecentBallDisplay,
  MatchResult,
  ExtrasBreakdown,
  BattingCardEntry,
  BowlingCardEntry,
  FallOfWicket,
  PreviousState,
  BallExtras,
  Dismissal,
} from '../types/cricket';
import {
  MatchStatus,
  InningsStatus,
  DEFAULT_EXTRAS_CONFIG,
  EMPTY_LIFETIME_STATS,
} from '../types/cricket';

// ============================================================
// Helper: Convert Firestore timestamps to Dates
// ============================================================

function toDate(timestamp: Timestamp | Date | undefined): Date {
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date();
}

// ============================================================
// PLAYERS
// ============================================================

const playersCol = collection(db, 'players');

/** Create a new player (called when a new name is entered during match setup) */
export async function createPlayer(name: string): Promise<string> {
  const playerRef = doc(playersCol);
  const player: Omit<Player, 'id' | 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    name,
    linkedUserId: null,
    photoURL: null,
    isRegistered: false,
    createdAt: serverTimestamp() as any,
    lifetimeStats: EMPTY_LIFETIME_STATS,
  };
  await setDoc(playerRef, player);
  return playerRef.id;
}

/** Get all players for autocomplete */
export async function getAllPlayers(): Promise<Player[]> {
  const snapshot = await getDocs(query(playersCol, orderBy('name')));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: toDate(d.data().createdAt),
  })) as Player[];
}

/** Search players by name prefix (for autocomplete) */
export async function searchPlayers(namePrefix: string): Promise<Player[]> {
  const allPlayers = await getAllPlayers();
  const lower = namePrefix.toLowerCase();
  return allPlayers.filter((p) => p.name.toLowerCase().includes(lower));
}

/** Subscribe to all players */
export function onPlayersSnapshot(callback: (players: Player[]) => void): Unsubscribe {
  return onSnapshot(query(playersCol, orderBy('name')), (snapshot) => {
    const players = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt),
    })) as Player[];
    callback(players);
  });
}

// ============================================================
// USERS
// ============================================================

const usersCol = collection(db, 'users');

/** Create or update user profile */
export async function upsertUser(user: Partial<AppUser> & { uid: string }): Promise<void> {
  const userRef = doc(usersCol, user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    await updateDoc(userRef, { ...user, updatedAt: serverTimestamp() });
  } else {
    await setDoc(userRef, {
      ...user,
      linkedPlayerId: null,
      createdAt: serverTimestamp(),
    });
  }
}

/** Get user by ID */
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(usersCol, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data(), createdAt: toDate(snap.data().createdAt) } as AppUser;
}

// ============================================================
// MATCHES
// ============================================================

const matchesCol = collection(db, 'matches');

/** Create a new match */
export async function createMatch(data: {
  createdBy: string;
  settings: MatchSettings;
  team1: Team;
  team2: Team;
  toss: TossInfo | null;
  seriesId?: string;
}): Promise<string> {
  const matchRef = doc(matchesCol);
  const initialScore: ScoreSummary = {
    runs: 0,
    wickets: 0,
    overs: 0,
    legalBallsCount: 0,
    currentRunRate: 0,
    requiredRunRate: null,
    target: null,
  };

  const match = {
    seriesId: data.seriesId || null,
    createdBy: data.createdBy,
    scorerId: data.createdBy,
    status: MatchStatus.Setup,
    settings: data.settings,
    team1: data.team1,
    team2: data.team2,
    toss: data.toss,
    currentInnings: 1,
    score: initialScore,
    striker: null,
    nonStriker: null,
    currentBowler: null,
    recentBalls: [],
    lastBallId: null,
    retiredBatsmen: [],
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(matchRef, match);
  return matchRef.id;
}

/** Get a match by ID */
export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(matchesCol, matchId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as Match;
}

/** Subscribe to a match (real-time) */
export function onMatchSnapshot(
  matchId: string,
  callback: (match: Match | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(matchesCol, matchId),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          id: snapshot.id,
          ...data,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        } as Match);
      } else {
        callback(null);
      }
    },
  );
}

/** Get all live matches */
export function onLiveMatchesSnapshot(
  callback: (matches: Match[]) => void,
): Unsubscribe {
  const q = query(
    matchesCol,
    where('status', 'in', [MatchStatus.Setup, MatchStatus.Live, MatchStatus.InningsBreak]),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt),
      updatedAt: toDate(d.data().updatedAt),
    })) as Match[];
    callback(matches);
  });
}

/** Get completed matches (for history) */
export async function getCompletedMatches(limitCount = 50): Promise<Match[]> {
  const q = query(
    matchesCol,
    where('status', '==', MatchStatus.Completed),
    orderBy('updatedAt', 'desc'),
    limit(limitCount),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Match[];
}

/** Update match document (partial update) */
export async function updateMatch(
  matchId: string,
  data: Partial<Omit<Match, 'id'>>,
): Promise<void> {
  await updateDoc(doc(matchesCol, matchId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Start the match (move from setup to live) */
export async function startMatch(
  matchId: string,
  striker: ActiveBatsmanInfo,
  nonStriker: ActiveBatsmanInfo,
  bowler: ActiveBowlerInfo,
): Promise<void> {
  await updateDoc(doc(matchesCol, matchId), {
    status: MatchStatus.Live,
    striker,
    nonStriker,
    currentBowler: bowler,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// INNINGS
// ============================================================

/** Create an innings document */
export async function createInnings(
  matchId: string,
  inningsNumber: 1 | 2,
  battingTeam: 'team1' | 'team2',
  bowlingTeam: 'team1' | 'team2',
): Promise<void> {
  const inningsRef = doc(db, 'matches', matchId, 'innings', String(inningsNumber));
  const innings: Omit<Innings, 'matchId'> = {
    inningsNumber,
    battingTeam,
    bowlingTeam,
    totalRuns: 0,
    totalWickets: 0,
    totalOvers: 0,
    totalLegalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    status: InningsStatus.InProgress,
  };
  await setDoc(inningsRef, { ...innings, matchId });
}

/** Get innings data */
export async function getInnings(
  matchId: string,
  inningsNumber: 1 | 2,
): Promise<Innings | null> {
  const snap = await getDoc(doc(db, 'matches', matchId, 'innings', String(inningsNumber)));
  if (!snap.exists()) return null;
  return snap.data() as Innings;
}

/** Subscribe to innings (real-time) */
export function onInningsSnapshot(
  matchId: string,
  inningsNumber: 1 | 2,
  callback: (innings: Innings | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'matches', matchId, 'innings', String(inningsNumber)),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Innings);
      } else {
        callback(null);
      }
    },
  );
}

/** Update innings document */
export async function updateInnings(
  matchId: string,
  inningsNumber: 1 | 2,
  data: Partial<Innings>,
): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId, 'innings', String(inningsNumber)), data);
}

// ============================================================
// BALLS
// ============================================================

/** Record a ball (delivery) */
export async function recordBall(
  matchId: string,
  ball: Ball,
): Promise<void> {
  const ballRef = doc(db, 'matches', matchId, 'balls', ball.id);
  await setDoc(ballRef, {
    ...ball,
    timestamp: serverTimestamp(),
  });
}

/** Delete a ball (for undo) */
export async function deleteBall(
  matchId: string,
  ballId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'matches', matchId, 'balls', ballId));
}

/** Get the last ball recorded */
export async function getLastBall(
  matchId: string,
  lastBallId: string,
): Promise<Ball | null> {
  const snap = await getDoc(doc(db, 'matches', matchId, 'balls', lastBallId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    timestamp: toDate(data.timestamp),
  } as Ball;
}

/** Get all balls for an innings (for scorecard) */
export async function getInningsBalls(
  matchId: string,
  inningsNumber: 1 | 2,
): Promise<Ball[]> {
  const q = query(
    collection(db, 'matches', matchId, 'balls'),
    where('innings', '==', inningsNumber),
    orderBy('ballSequence', 'asc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    timestamp: toDate(d.data().timestamp),
  })) as Ball[];
}

// ============================================================
// BATCH OPERATIONS — Record a ball + update match + update innings atomically
// ============================================================

export interface RecordBallPayload {
  matchId: string;
  ball: Ball;
  matchUpdate: Partial<Match>;
  inningsUpdate: Partial<Innings>;
}

/** Atomically record a ball, update the match snapshot, and update the innings */
export async function recordBallWithUpdates(payload: RecordBallPayload): Promise<void> {
  const batch = writeBatch(db);

  // 1. Write the ball document
  const ballRef = doc(db, 'matches', payload.matchId, 'balls', payload.ball.id);
  batch.set(ballRef, { ...payload.ball, timestamp: serverTimestamp() });

  // 2. Update the match snapshot
  const matchRef = doc(matchesCol, payload.matchId);
  batch.update(matchRef, { ...payload.matchUpdate, updatedAt: serverTimestamp() });

  // 3. Update the innings
  const inningsRef = doc(
    db,
    'matches',
    payload.matchId,
    'innings',
    String(payload.ball.innings),
  );
  batch.update(inningsRef, payload.inningsUpdate);

  await batch.commit();
}

/** Atomically undo a ball: delete ball doc + restore match state + restore innings */
export async function undoBallWithUpdates(
  matchId: string,
  ballId: string,
  inningsNumber: 1 | 2,
  matchRestore: Partial<Match>,
  inningsRestore: Partial<Innings>,
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete the ball
  batch.delete(doc(db, 'matches', matchId, 'balls', ballId));

  // 2. Restore match state
  batch.update(doc(matchesCol, matchId), { ...matchRestore, updatedAt: serverTimestamp() });

  // 3. Restore innings state
  batch.update(doc(db, 'matches', matchId, 'innings', String(inningsNumber)), inningsRestore);

  await batch.commit();
}

// ============================================================
// PLAYER MATCH STATS
// ============================================================

/** Set player match stats */
export async function setPlayerMatchStats(
  matchId: string,
  playerId: string,
  stats: PlayerMatchStats,
): Promise<void> {
  await setDoc(doc(db, 'matches', matchId, 'playerStats', playerId), stats);
}

/** Get player match stats */
export async function getPlayerMatchStats(
  matchId: string,
  playerId: string,
): Promise<PlayerMatchStats | null> {
  const snap = await getDoc(doc(db, 'matches', matchId, 'playerStats', playerId));
  if (!snap.exists()) return null;
  return snap.data() as PlayerMatchStats;
}

// ============================================================
// SERIES
// ============================================================

const seriesCol = collection(db, 'series');

/** Create a new series */
export async function createSeries(data: {
  name: string;
  createdBy: string;
}): Promise<string> {
  const seriesRef = doc(seriesCol);
  await setDoc(seriesRef, {
    name: data.name,
    createdBy: data.createdBy,
    status: 'active',
    matchIds: [],
    standings: {},
    createdAt: serverTimestamp(),
  });
  return seriesRef.id;
}

/** Transfer scoring rights to another user */
export async function transferScorer(
  matchId: string,
  newScorerId: string,
): Promise<void> {
  await updateDoc(doc(matchesCol, matchId), {
    scorerId: newScorerId,
    updatedAt: serverTimestamp(),
  });
}
