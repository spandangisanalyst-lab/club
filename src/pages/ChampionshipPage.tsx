import { useState, useEffect } from 'react';
import { Medal, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SettingsMap, Club, SwimEvent, HeatEntry, Participant } from '../lib/types';
import { POINTS_EXCLUDED_GROUPS } from '../lib/constants';

interface Props {
  settings: SettingsMap;
}

interface ClubPoints {
  club: Club;
  points: number;
  gold: number;
  silver: number;
  bronze: number;
}

export default function ChampionshipPage({ settings }: Props) {
  const [standings, setStandings] = useState<ClubPoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, []);

  const loadStandings = async () => {
    setLoading(true);
    const pointsArr = (settings.championship_points || '7,5,4,3,2,1')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    // Get all entries with overall_rank
    const { data: entries } = await supabase
      .from('heat_entries')
      .select('*')
      .not('overall_rank', 'is', null)
      .order('overall_rank', { ascending: true });

    if (!entries || entries.length === 0) {
      setLoading(false);
      return;
    }

    // Get participants to map club_id
    const partIds = [...new Set(entries.map((e) => e.participant_id))];
    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .in('id', partIds);

    // Get heats and events to check age group
    const heatIds = [...new Set(entries.map((e) => e.heat_id))];
    const { data: heats } = await supabase.from('heats').select('*').in('id', heatIds);
    const eventIds = [...new Set((heats || []).map((h) => h.event_id))];
    const { data: events } = await supabase.from('events').select('*').in('id', eventIds);

    const partMap = new Map((participants || []).map((p) => [p.id, p] as [string, Participant]));
    const heatMap = new Map((heats || []).map((h) => [h.id, h]));
    const eventMap = new Map((events || []).map((e) => [e.id, e] as [string, SwimEvent]));

    // Get clubs
    const clubIds = [...new Set((participants || []).map((p) => p.club_id).filter(Boolean))];
    const { data: clubs } = await supabase.from('clubs').select('*').in('id', clubIds);
    const clubMap = new Map((clubs || []).map((c) => [c.id, c] as [string, Club]));

    const clubPointsMap = new Map<string, ClubPoints>();

    for (const entry of entries) {
      const participant = partMap.get(entry.participant_id);
      if (!participant || !participant.club_id) continue;
      const heat = heatMap.get(entry.heat_id);
      const event = heat ? eventMap.get(heat.event_id) : undefined;
      if (!event) continue;

      // Exclude U/10 groups from championship points
      if (POINTS_EXCLUDED_GROUPS.includes(event.age_group)) continue;

      const rank = entry.overall_rank!;
      if (rank < 1 || rank > pointsArr.length) continue;
      const points = pointsArr[rank - 1];

      const clubId = participant.club_id;
      if (!clubPointsMap.has(clubId)) {
        const club = clubMap.get(clubId);
        if (!club) continue;
        clubPointsMap.set(clubId, { club, points: 0, gold: 0, silver: 0, bronze: 0 });
      }
      const cp = clubPointsMap.get(clubId)!;
      cp.points += points;
      if (entry.medal === 'Gold') cp.gold++;
      if (entry.medal === 'Silver') cp.silver++;
      if (entry.medal === 'Bronze') cp.bronze++;
    }

    const sorted = Array.from(clubPointsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    setStandings(sorted);
    setLoading(false);
  };

  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Medal className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Club Championship</h1>
          <p className="text-slate-400">Overall standings across all age groups (U/10 excluded)</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : standings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Standings Yet</h3>
            <p className="text-slate-500">Championship standings will appear here once results are recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Podium for top 3 */}
            {standings.length >= 1 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[1, 0, 2].map((idx) => {
                  const s = standings[idx];
                  if (!s) return <div key={idx} />;
                  const position = idx + 1;
                  const heights = ['h-32', 'h-40', 'h-28'];
                  const colors = ['from-gray-300 to-gray-400', 'from-yellow-300 to-yellow-500', 'from-orange-300 to-orange-500'];
                  const textColors = ['text-gray-700', 'text-yellow-700', 'text-orange-700'];
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="text-center mb-3">
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colors[position - 1]} flex items-center justify-center mb-2 shadow-lg`}>
                          <span className={`text-2xl font-bold ${textColors[position - 1]}`}>{position}</span>
                        </div>
                        <div className="font-bold text-slate-800 text-sm truncate max-w-[120px]">{s.club.name}</div>
                        <div className="text-2xl font-bold text-cyan-600">{s.points}</div>
                        <div className="text-xs text-slate-500">points</div>
                      </div>
                      <div className={`w-full ${heights[position - 1]} bg-gradient-to-t ${colors[position - 1]} rounded-t-xl flex items-end justify-center pb-2`}>
                        <span className="text-white font-bold text-lg">{position === 1 ? '1st' : position === 2 ? '2nd' : '3rd'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                <h2 className="text-lg font-bold text-white">Full Standings</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Club</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Gold</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Silver</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Bronze</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {standings.map((s, idx) => (
                      <tr key={s.club.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                            idx === 1 ? 'bg-gray-200 text-gray-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{s.club.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">
                            <Medal className="w-4 h-4" /> {s.gold}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-gray-500 font-semibold">
                            <Medal className="w-4 h-4" /> {s.silver}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                            <Medal className="w-4 h-4" /> {s.bronze}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-cyan-600 text-lg">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-slate-500 text-center mt-4">
              Points system: 1st = {(settings.championship_points || '7,5,4,3,2,1').split(',')[0]} pts ·
              U/10 age group results are excluded from championship points.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
