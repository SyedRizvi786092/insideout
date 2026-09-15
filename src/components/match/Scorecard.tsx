import type { Innings, MatchSettings } from '@/types/cricket';
import { oversToString } from '@/lib/cricket';

interface ScorecardProps {
  innings: Innings;
  matchSettings: MatchSettings;
}

export default function Scorecard({ innings, matchSettings }: ScorecardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Batting Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Batting</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3 font-medium">Batter</th>
                <th className="text-right py-2 px-2 font-medium">R</th>
                <th className="text-right py-2 px-2 font-medium">B</th>
                <th className="text-right py-2 px-2 font-medium">4s</th>
                <th className="text-right py-2 px-2 font-medium">6s</th>
                <th className="text-right py-2 px-3 font-medium">SR</th>
              </tr>
            </thead>
            <tbody>
              {innings.battingCard.map((entry) => (
                <tr key={entry.playerId} className="border-b border-gray-800/50 last:border-0">
                  <td className="py-2 px-3">
                    <p className="text-white font-medium truncate max-w-[100px]">
                      {entry.playerName}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {entry.isOut ? entry.howOut : 'not out'}
                    </p>
                  </td>
                  <td className="text-right py-2 px-2 text-white font-semibold">
                    {entry.runs}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-400">
                    {entry.balls}
                  </td>
                  <td className="text-right py-2 px-2 text-blue-400">
                    {entry.fours}
                  </td>
                  <td className="text-right py-2 px-2 text-violet-400">
                    {entry.sixes}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-400">
                    {entry.strikeRate.toFixed(1)}
                  </td>
                </tr>
              ))}
              {innings.battingCard.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-600 text-xs">
                    No batters yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Extras & Total */}
        <div className="border-t border-gray-800 px-3 py-2 flex justify-between text-xs">
          <span className="text-gray-500">
            Extras: <span className="text-gray-300">{innings.extras.total}</span>
            <span className="text-gray-600 ml-1">
              (Wd {innings.extras.wides}, Nb {innings.extras.noBalls}
              {innings.extras.byes > 0 && `, B ${innings.extras.byes}`}
              {innings.extras.legByes > 0 && `, Lb ${innings.extras.legByes}`})
            </span>
          </span>
        </div>
        <div className="border-t border-gray-800 px-3 py-2 flex justify-between text-sm">
          <span className="text-white font-semibold">Total</span>
          <span className="text-white font-bold">
            {innings.totalRuns}/{innings.totalWickets}
            <span className="text-gray-400 text-xs font-normal ml-1">
              ({oversToString(innings.totalOvers)} ov)
            </span>
          </span>
        </div>
      </div>

      {/* Bowling Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Bowling</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3 font-medium">Bowler</th>
                <th className="text-right py-2 px-2 font-medium">O</th>
                <th className="text-right py-2 px-2 font-medium">M</th>
                <th className="text-right py-2 px-2 font-medium">R</th>
                <th className="text-right py-2 px-2 font-medium">W</th>
                <th className="text-right py-2 px-3 font-medium">Econ</th>
              </tr>
            </thead>
            <tbody>
              {innings.bowlingCard.map((entry) => (
                <tr key={entry.playerId} className="border-b border-gray-800/50 last:border-0">
                  <td className="py-2 px-3 text-white font-medium truncate max-w-[100px]">
                    {entry.playerName}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-400">
                    {oversToString(entry.overs)}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-400">
                    {entry.maidens}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-300">
                    {entry.runsConceded}
                  </td>
                  <td className="text-right py-2 px-2 text-emerald-400 font-semibold">
                    {entry.wickets}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-400">
                    {entry.economyRate.toFixed(2)}
                  </td>
                </tr>
              ))}
              {innings.bowlingCard.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-600 text-xs">
                    No bowlers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fall of Wickets */}
      {innings.fallOfWickets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Fall of Wickets</h3>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
            {innings.fallOfWickets.map((fow) => (
              <span key={fow.wicketNumber} className="text-xs text-gray-400">
                <span className="text-gray-300 font-medium">
                  {fow.score}/{fow.wicketNumber}
                </span>
                {' '}
                <span className="text-gray-600">
                  ({fow.batsmanName}, {oversToString(fow.overs)} ov)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
