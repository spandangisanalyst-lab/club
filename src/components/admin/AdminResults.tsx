import { useState, useEffect, useMemo } from 'react';
import { Trophy, Loader2, Medal, Award, Search, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent, Heat, HeatEntry, Participant, Club } from '../../lib/types';
import { formatTime, cn } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

export default function AdminResults({ settings }: Props) {
  const { events } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [heats, setHeats] = useState<Heat[]>([]);
  const [entries, setEntries] = useState<HeatEntry[]>([]);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [clubs, setClubs] = useState<Map<string, Club>>(new Map());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])), [events]);

  useEffect(() => {
    loadCompletedEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) loadData(selectedEventId);
    else { setHeats([]); setEntries([]); }
  }, [selectedEventId]);

  const loadCompletedEvents = async () => {
    const { data, error } = await supabase
      .from('heats')
      .select('event_id')
      .eq('status', 'finished');

    if (error) {
      console.error('Error loading completed events:', error);
      setCompletedEventIds(new Set());
      return;
    }

    setCompletedEventIds(new Set((data || []).map((row) => String(row.event_id))));
  };

  const loadData = async (eventId: string) => {
    setLoading(true);
    setMessage('');
    const { data: h } = await supabase.from('heats').select('*').eq('event_id', eventId).order('heat_number', { ascending: true });
    setHeats((h || []) as Heat[]);

    if (h && h.length > 0) {
      const { data: e } = await supabase.from('heat_entries').select('*').in('heat_id', h.map((x) => x.id));
      setEntries((e || []) as HeatEntry[]);
      const partIds = [...new Set((e || []).map((x) => x.participant_id))];
      if (partIds.length > 0) {
        const { data: parts } = await supabase.from('participants').select('*').in('id', partIds);
        setParticipants(new Map((parts || []).map((p) => [p.id, p] as [string, Participant])));
        const clubIds = [...new Set((parts || []).map((p) => p.club_id).filter(Boolean))];
        if (clubIds.length > 0) {
          const { data: cls } = await supabase.from('clubs').select('*').in('id', clubIds);
          setClubs(new Map((cls || []).map((c) => [c.id, c] as [string, Club])));
        }
      }
    } else {
      setEntries([]);
    }
    setLoading(false);
  };

  const declareResults = async () => {
    if (!selectedEventId) return;
    setProcessing(true);
    setMessage('');
    try {
      // Get all entries with finish times for this event's heats
      const finishedEntries = entries.filter((e) => e.finish_time_ms !== null);

      if (finishedEntries.length === 0) {
        setMessage('No finished entries to declare results for.');
        setProcessing(false);
        return;
      }

      // Sort by finish time ascending (fastest first)
      finishedEntries.sort((a, b) => (a.finish_time_ms || 0) - (b.finish_time_ms || 0));

      // Assign overall ranks
      for (let i = 0; i < finishedEntries.length; i++) {
        const rank = i + 1;
        let medal: 'Gold' | 'Silver' | 'Bronze' | null = null;
        if (rank === 1) medal = 'Gold';
        else if (rank === 2) medal = 'Silver';
        else if (rank === 3) medal = 'Bronze';

        await supabase.from('heat_entries').update({
          overall_rank: rank,
          medal,
        }).eq('id', finishedEntries[i].id);
      }

      // Mark heats as finished
      for (const heat of heats) {
        await supabase.from('heats').update({ status: 'finished' }).eq('id', heat.id);
      }

      setMessage(`Results declared! Top 3 fastest swimmers identified. ${finishedEntries.length} total finishers ranked.`);
      await loadData(selectedEventId);
      await loadCompletedEvents();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const clearResults = async () => {
    if (!selectedEventId) return;
    if (!confirm('Clear all results for this event? This removes rankings and medals.')) return;
    const heatIds = heats.map((h) => h.id);
    await supabase.from('heat_entries').update({ overall_rank: null, medal: null }).in('heat_id', heatIds);
    setMessage('Results cleared.');
    await loadData(selectedEventId);
    await loadCompletedEvents();
  };

  const entriesWithResults = useMemo(() => {
    return entries
      .filter((e) => e.finish_time_ms !== null)
      .sort((a, b) => (a.finish_time_ms || 0) - (b.finish_time_ms || 0));
  }, [entries]);

  const filteredResults = useMemo(() => {
    if (!search) return entriesWithResults;
    const q = search.toLowerCase();
    return entriesWithResults.filter((e) => {
      const part = participants.get(e.participant_id);
      return part?.name.toLowerCase().includes(q);
    });
  }, [entriesWithResults, search, participants]);

  const hasResults = entriesWithResults.some((e) => e.overall_rank !== null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Results Management</h1>
        <p className="text-slate-500 mt-1">Review timing data and auto-declare top 3 winners</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200 mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Event</label>
        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
          <option value="">Choose a completed event...</option>
          {events
            .filter((ev) => completedEventIds.has(String(ev.id)))
            .map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.category} - {ev.event_name}
              </option>
            ))}
        </select>

        {selectedEventId && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={declareResults} disabled={processing || entriesWithResults.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Declare Top 3 Results
            </button>
            {hasResults && (
              <button onClick={clearResults} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                Clear Results
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </div>
        )}
      </div>

      {!selectedEventId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Select an event to view and manage results.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : entriesWithResults.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No finished entries yet. Use the Live Timer to record race times first.</p>
        </div>
      ) : (
        <div>
          {hasResults && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {entriesWithResults.slice(0, 3).map((entry, idx) => {
                const part = participants.get(entry.participant_id);
                const club = part && part.club_id ? clubs.get(part.club_id) : null;
                const medal = entry.medal;
                const colors = ['from-yellow-400 to-yellow-600', 'from-gray-300 to-gray-500', 'from-orange-400 to-orange-600'];
                const medalText = ['text-yellow-700', 'text-gray-700', 'text-orange-700'];
                return (
                  <div key={entry.id} className={cn('bg-white rounded-2xl shadow-lg p-6 text-center border-2', idx === 0 ? 'border-yellow-300' : idx === 1 ? 'border-gray-300' : 'border-orange-300')}>
                    <div className={cn('w-16 h-16 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center mx-auto mb-3 shadow-lg', colors[idx])}>
                      <Medal className={cn('w-8 h-8 text-white', medalText[idx])} />
                    </div>
                    <div className="text-lg font-bold text-slate-900">{part?.name || 'Unknown'}</div>
                    <div className="text-sm text-slate-500">{club?.name || 'No club'}</div>
                    <div className="text-xl font-mono font-bold text-slate-800 mt-2">{formatTime(entry.finish_time_ms)}</div>
                    <div className={cn('text-sm font-semibold mt-1', medalText[idx])}>{medal}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative mb-4">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white" />
          </div>

          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">All Finishers (sorted by time)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lane</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Club</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Time</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Medal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((entry, idx) => {
                    const part = participants.get(entry.participant_id);
                    const club = part && part.club_id ? clubs.get(part.club_id) : null;
                    const rank = entry.overall_rank || idx + 1;
                    return (
                      <tr key={entry.id} className={cn('hover:bg-slate-50', rank <= 3 && 'bg-yellow-50/50')}>
                        <td className="px-4 py-3">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm', rank === 1 ? 'bg-yellow-100 text-yellow-700' : rank === 2 ? 'bg-gray-200 text-gray-700' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                            {rank}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{entry.lane_number || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{part?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-slate-600">{club?.name || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatTime(entry.finish_time_ms)}</td>
                        <td className="px-4 py-3 text-center">
                          {entry.medal && (
                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', entry.medal === 'Gold' ? 'bg-yellow-100 text-yellow-700' : entry.medal === 'Silver' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700')}>
                              <Award className="w-3 h-3" /> {entry.medal}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
