import { useState, useEffect, useMemo } from 'react';
import { Trophy, Medal, Loader2, Search, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SettingsMap, SwimEvent, HeatEntry, Participant, Club } from '../lib/types';
import { formatTime } from '../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface ResultRow {
  entry: HeatEntry;
  participant: Participant;
  club: Club | null;
  event: SwimEvent;
}

export default function ResultsPage({ settings }: Props) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setLoading(true);
    const { data: entries } = await supabase
      .from('heat_entries')
      .select('*')
      .not('finish_time_ms', 'is', null)
      .order('overall_rank', { ascending: true, nullsFirst: false });

    if (!entries || entries.length === 0) {
      setLoading(false);
      return;
    }

    const participantIds = [...new Set(entries.map((e) => e.participant_id))];
    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .in('id', participantIds);

    const clubIds = [...new Set((participants || []).map((p) => p.club_id).filter(Boolean))];
    const { data: clubs } = await supabase
      .from('clubs')
      .select('*')
      .in('id', clubIds);

    const { data: heats } = await supabase
      .from('heats')
      .select('*')
      .in('id', [...new Set(entries.map((e) => e.heat_id))]);

    const eventIds = [...new Set((heats || []).map((h) => h.event_id))];
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds);

    const partMap = new Map((participants || []).map((p) => [p.id, p]));
    const clubMap = new Map((clubs || []).map((c) => [c.id, c]));
    const heatMap = new Map((heats || []).map((h) => [h.id, h]));
    const eventMap = new Map((events || []).map((e) => [e.id, e]));

    const rows: ResultRow[] = entries
      .map((entry) => {
        const participant = partMap.get(entry.participant_id);
        const heat = heatMap.get(entry.heat_id);
        const event = heat ? eventMap.get(heat.event_id) : undefined;
        if (!participant || !event) return null;
        return {
          entry,
          participant,
          club: participant.club_id ? clubMap.get(participant.club_id) || null : null,
          event,
        };
      })
      .filter((r): r is ResultRow => r !== null);

    setResults(rows);
    setLoading(false);
  };

  const categories = useMemo(() => {
    const set = new Set(results.map((r) => r.event.category));
    return ['All', ...Array.from(set)];
  }, [results]);

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (filterCategory !== 'All' && r.event.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.participant.name.toLowerCase().includes(q) ||
          r.event.event_name.toLowerCase().includes(q) ||
          (r.club?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [results, filterCategory, search]);

  const groupedByEvent = useMemo(() => {
    const map: Record<string, ResultRow[]> = {};
    for (const r of filtered) {
      const key = r.event.event_name + ' (' + r.event.category + ')';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Trophy className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Results</h1>
          <p className="text-slate-400">{settings.site_title}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Search & filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, event, or club..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Results Yet</h3>
            <p className="text-slate-500">Results will be displayed here once the competition begins.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByEvent).map(([eventName, rows]) => (
              <div key={eventName} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                  <h2 className="text-lg font-bold text-white">{eventName}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {rows.map((r, idx) => {
                    const rank = r.entry.overall_rank || idx + 1;
                    const isTop3 = rank <= 3;
                    return (
                      <div key={r.entry.id} className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mr-4 ${
                          rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          rank === 2 ? 'bg-gray-200 text-gray-700' :
                          rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isTop3 ? <Medal className="w-5 h-5" /> : rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{r.participant.name}</div>
                          <div className="text-sm text-slate-500">{r.club?.name || 'Independent'}</div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-slate-800 font-mono font-semibold">
                            <Clock className="w-4 h-4 text-slate-400" />
                            {formatTime(r.entry.finish_time_ms)}
                          </div>
                          {r.entry.medal && (
                            <div className="text-xs font-medium mt-0.5" style={{ color: r.entry.medal === 'Gold' ? '#B8860B' : r.entry.medal === 'Silver' ? '#808080' : '#B87333' }}>
                              {r.entry.medal}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
