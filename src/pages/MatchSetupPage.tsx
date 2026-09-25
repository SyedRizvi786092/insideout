import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { createMatch, createInnings, getAllPlayers, createPlayer } from '@/lib/firestore-service';
import { DEFAULT_EXTRAS_CONFIG, TossDecision } from '@/types/cricket';
import type { Player, ExtrasConfig } from '@/types/cricket';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ── Toggle Component ──────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (c: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
    <span className="text-gray-200">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-emerald-600' : 'bg-gray-700'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

// ── Player Input with Autocomplete ────────────────────────────────────────────

function PlayerInput({
  value,
  onChange,
  dbPlayers,
  index,
}: {
  value: string;
  onChange: (v: string) => void;
  dbPlayers: Player[];
  index: number;
}) {
  const [focused, setFocused] = useState(false);
  const filtered = dbPlayers.filter(
    (p) => p.name.toLowerCase().includes(value.toLowerCase()) && p.name.toLowerCase() !== value.toLowerCase()
  );

  return (
    <div className="relative mb-3">
      <div className="flex items-center gap-3">
        <span className="text-gray-500 w-5 text-right text-sm">{index + 1}.</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          placeholder="Player Name"
        />
      </div>
      {focused && value && filtered.length > 0 && (
        <div className="absolute z-10 left-8 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="px-3 py-2 text-white hover:bg-gray-700 cursor-pointer"
              onClick={() => onChange(p.name)}
            >
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ── Form State ──────────────────────────────────────────────────────────────
  const [team1Name, setTeam1Name] = useState('Team A');
  const [team2Name, setTeam2Name] = useState('Team B');
  const [oversRaw, setOversRaw] = useState('10');
  const [playersRaw, setPlayersRaw] = useState('6');

  const overs = parseInt(oversRaw);
  const playersPerSide = parseInt(playersRaw);

  const [extras, setExtras] = useState<ExtrasConfig>(DEFAULT_EXTRAS_CONFIG);

  const [tossWinner, setTossWinner] = useState<'team1' | 'team2' | null>(null);
  const [tossDecision, setTossDecision] = useState<TossDecision | null>(null);
  const [skipToss, setSkipToss] = useState(true); // Default: skip toss
  const [batsFirstTeam, setBatsFirstTeam] = useState<'team1' | 'team2'>('team1'); // Used when toss is skipped

  const [quickStart, setQuickStart] = useState(true);
  const [showPlayers, setShowPlayers] = useState(false);

  const [team1Players, setTeam1Players] = useState<string[]>(Array(6).fill(''));
  const [team2Players, setTeam2Players] = useState<string[]>(Array(6).fill(''));

  const [dbPlayers, setDbPlayers] = useState<Player[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getAllPlayers().then(setDbPlayers).catch(console.error);
  }, []);

  useEffect(() => {
    const count = playersPerSide;
    setTeam1Players((prev) => {
      if (prev.length < count) return [...prev, ...Array(count - prev.length).fill('')];
      return prev.slice(0, count);
    });
    setTeam2Players((prev) => {
      if (prev.length < count) return [...prev, ...Array(count - prev.length).fill('')];
      return prev.slice(0, count);
    });
  }, [playersPerSide]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const isOversValid = overs >= 1 && overs <= 20;
  const isPlayersValid = playersPerSide >= 2 && playersPerSide <= 16;
  const hasTossOrBattingFirst = !skipToss ? (tossWinner !== null && tossDecision !== null) : true;
  const canStart = isOversValid && isPlayersValid && hasTossOrBattingFirst;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateExtra = (key: keyof ExtrasConfig, value: boolean) => {
    setExtras((prev) => ({ ...prev, [key]: value }));
  };

  const updatePlayerName = (team: 1 | 2, index: number, val: string) => {
    if (team === 1) {
      const arr = [...team1Players];
      arr[index] = val;
      setTeam1Players(arr);
    } else {
      const arr = [...team2Players];
      arr[index] = val;
      setTeam2Players(arr);
    }
  };


  // ── Start Match ─────────────────────────────────────────────────────────────
  const handleStartMatch = async () => {
    if (!canStart) return;
    setIsStarting(true);
    setErrorMsg('');

    try {
      // Resolve player names to IDs
      const resolvePlayers = async (names: string[]) => {
        if (quickStart) return [];
        const ids: string[] = [];
        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed) continue;
          const existing = dbPlayers.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
          if (existing) {
            ids.push(existing.id);
          } else {
            const newId = await createPlayer(trimmed);
            ids.push(newId);
          }
        }
        return ids;
      };

      const team1Ids = await resolvePlayers(team1Players);
      const team2Ids = await resolvePlayers(team2Players);

      // Determine batting order
      let battingTeam: 'team1' | 'team2' = 'team1';
      let bowlingTeam: 'team1' | 'team2' = 'team2';
      let tossInfo: { winnerTeam: 'team1' | 'team2'; decision: TossDecision } | null = null;

      if (!skipToss && tossWinner && tossDecision) {
        tossInfo = { winnerTeam: tossWinner, decision: tossDecision };
        if (tossDecision === TossDecision.Bat) {
          battingTeam = tossWinner;
          bowlingTeam = tossWinner === 'team1' ? 'team2' : 'team1';
        } else {
          bowlingTeam = tossWinner;
          battingTeam = tossWinner === 'team1' ? 'team2' : 'team1';
        }
      } else {
        // Toss skipped — use direct batting first choice
        battingTeam = batsFirstTeam;
        bowlingTeam = batsFirstTeam === 'team1' ? 'team2' : 'team1';
      }

      const matchId = await createMatch({
        createdBy: user?.uid || 'anonymous',
        settings: {
          totalOvers: overs,
          playersPerSide,
          extrasConfig: extras,
        },
        team1: { name: team1Name.trim() || 'Team A', playerIds: team1Ids },
        team2: { name: team2Name.trim() || 'Team B', playerIds: team2Ids },
        toss: tossInfo,
      });

      await createInnings(matchId, 1, battingTeam, bowlingTeam);

      try {
        localStorage.setItem('cricket_active_match_id', matchId);
      } catch (e) {
        console.warn('Could not save active match to localStorage:', e);
      }

      navigate(`/match/${matchId}`);
    } catch (err) {
      console.error('Failed to start match:', err);
      setErrorMsg('Failed to create match. Please try again.');
      setIsStarting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageContainer className="pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">New Match</h1>
        <p className="text-gray-400 text-sm mt-1">Configure your match settings</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* ── Teams ──────────────────────────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Teams</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Team 1</label>
              <input
                type="text"
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                placeholder="Team A"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Team 2</label>
              <input
                type="text"
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                placeholder="Team B"
              />
            </div>
          </div>
        </section>

        {/* ── Match Settings ─────────────────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Match Setup</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Overs</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={oversRaw}
                onChange={(e) => setOversRaw(e.target.value)}
                className={cn(
                  'w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-white focus:outline-none',
                  isOversValid ? 'border-gray-700 focus:border-emerald-500' : 'border-red-500'
                )}
              />
              {!isOversValid && <p className="text-xs text-red-400 mt-1">Must be 1–20</p>}
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Players Per Side</label>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={16}
                value={playersRaw}
                onChange={(e) => setPlayersRaw(e.target.value)}
                className={cn(
                  'w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-white focus:outline-none',
                  isPlayersValid ? 'border-gray-700 focus:border-emerald-500' : 'border-red-500'
                )}
              />
              {!isPlayersValid && <p className="text-xs text-red-400 mt-1">Must be 2–16</p>}
            </div>
          </div>
        </section>

        {/* ── Extras ──────────────────────────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Extras Allowed</h2>
          <Toggle checked={extras.widesEnabled} onChange={(v) => updateExtra('widesEnabled', v)} label="Wides" />
          <Toggle checked={extras.noBallsEnabled} onChange={(v) => updateExtra('noBallsEnabled', v)} label="No Balls" />
          <Toggle checked={extras.byesEnabled} onChange={(v) => updateExtra('byesEnabled', v)} label="Byes" />
          <Toggle checked={extras.legByesEnabled} onChange={(v) => updateExtra('legByesEnabled', v)} label="Leg Byes" />
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Toss</h2>

          {/* Toggle: Skip Toss or Enter Toss Result */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSkipToss(true)}
              className={cn(
                'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                skipToss ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-300'
              )}
            >
              Skip Toss
            </button>
            <button
              type="button"
              onClick={() => setSkipToss(false)}
              className={cn(
                'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                !skipToss ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-300'
              )}
            >
              Enter Toss Result
            </button>
          </div>

          {skipToss ? (
            /* Direct batting first */
            <div>
              <label className="block text-sm text-gray-400 mb-2">Who bats first?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBatsFirstTeam('team1')}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    batsFirstTeam === 'team1'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {team1Name || 'Team 1'}
                </button>
                <button
                  type="button"
                  onClick={() => setBatsFirstTeam('team2')}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    batsFirstTeam === 'team2'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {team2Name || 'Team 2'}
                </button>
              </div>
            </div>
          ) : (
            /* Toss */
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Who won the toss?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTossWinner('team1')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      tossWinner === 'team1'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                    )}
                  >
                    {team1Name || 'Team 1'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTossWinner('team2')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      tossWinner === 'team2'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                    )}
                  >
                    {team2Name || 'Team 2'}
                  </button>
                </div>
              </div>
              {tossWinner && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Chose to...</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTossDecision(TossDecision.Bat)}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                        tossDecision === TossDecision.Bat
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                      )}
                    >
                      Bat
                    </button>
                    <button
                      type="button"
                      onClick={() => setTossDecision(TossDecision.Bowl)}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                        tossDecision === TossDecision.Bowl
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                      )}
                    >
                      Bowl
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Players ────────────────────────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowPlayers(!showPlayers)}
          >
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Players</h2>
            <div className="p-1 bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors">
              {showPlayers ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          {showPlayers && (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <Toggle checked={quickStart} onChange={setQuickStart} label="Quick Start (Add players later)" />

              {!quickStart && (
                <div className="mt-4 space-y-6">
                  <div>
                    <h3 className="text-emerald-400 font-medium mb-3">{team1Name || 'Team 1'}</h3>
                    {team1Players.map((val, i) => (
                      <PlayerInput
                        key={`t1-${i}`}
                        index={i}
                        value={val}
                        onChange={(v) => updatePlayerName(1, i, v)}
                        dbPlayers={dbPlayers}
                      />
                    ))}
                  </div>
                  <div>
                    <h3 className="text-emerald-400 font-medium mb-3">{team2Name || 'Team 2'}</h3>
                    {team2Players.map((val, i) => (
                      <PlayerInput
                        key={`t2-${i}`}
                        index={i}
                        value={val}
                        onChange={(v) => updatePlayerName(2, i, v)}
                        dbPlayers={dbPlayers}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Error Message ──────────────────────────────────────── */}
      {errorMsg && (
        <div className="mt-4 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* ── Start Button ──────────────────────────────────────── */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleStartMatch}
          disabled={isStarting || !canStart}
          className={cn(
            'w-full font-bold text-lg py-4 rounded-xl transition-colors shadow-lg',
            canStart
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          )}
        >
          {isStarting ? 'Creating Match...' : 'Start Match'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={isStarting}
          className="w-full mt-3 py-3 rounded-xl border border-gray-700 bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white font-medium text-base transition-colors"
        >
          Cancel
        </button>
        {!canStart && !isStarting && (
          <p className="text-center text-xs text-gray-500 mt-2">
            {!isOversValid && 'Overs must be 1–20. '}
            {!isPlayersValid && 'Players must be 2–16. '}
            {!hasTossOrBattingFirst && 'Select toss winner and decision. '}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
