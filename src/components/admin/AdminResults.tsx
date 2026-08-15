import { useState, useEffect, useMemo } from 'react';
import { Trophy, Loader2, Medal, Award, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent } from '../../lib/types';
import { cn } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface ResultRow {
  id: string;
  name: string;
  club: string;
  time: string;
  event: string;
  age_group: string;
  position: number;
  created_at?: string;
}

export default function AdminResults({ settings }: Props) {
  const { events } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const eventMap = useMemo(
    () => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])),
    [events]
  );

  const selectedEvent = selectedEventId ? eventMap.get(selectedEventId) : undefined;

  const loadResults = async (eventId: string) => {
    if (!eventId) {
      setResults([]);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const event = eventMap.get(eventId);
      const eventName = event?.event_name || '';

      if (!eventName) {
        setResults([]);
        setMessage('Event name could not be found.');
        return;
      }

      // Results are saved automatically when an event is completed.
      // We only READ the results table here.
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('event', eventName)
        .order('position', { ascending: true });

      if (error) throw error;

      setResults((data || []) as ResultRow[]);
    } catch (error: any) {
      console.error('Error loading event results:', error);
      setResults([]);
      setMessage(`Could not load results: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      loadResults(selectedEventId);
    } else {
      setResults([]);
      setMessage('');
    }
  }, [selectedEventId, events]);

  const filteredResults = useMemo(() => {
    if (!search.trim()) return results;

    const q = search.toLowerCase();
    return results.filter(
      (result) =>
        result.name?.toLowerCase().includes(q) ||
        result.club?.toLowerCase().includes(q) ||
        result.age_group?.toLowerCase().includes(q)
    );
  }, [results, search]);

  const topThree = useMemo(
    () => results.filter((r) => r.position >= 1 && r.position <= 3).slice(0, 3),
    [results]
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Results Management</h1>
        <p className="text-slate-500 mt-1">
          View results automatically saved when each event is completed.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white"
            >
              <option value="">Choose an event...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.category} - {ev.event_name}
                </option>
              ))}
            </select>
          </div>

          {selectedEventId && (
            <button
              onClick={() => loadResults(selectedEventId)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </button>
          )}
        </div>

        {selectedEvent && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="font-bold text-slate-900">
              {selectedEvent.event_name}
            </div>
            <div className="text-sm text-slate-500">
              {selectedEvent.category}
            </div>
          </div>
        )}

        {message && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {message}
          </div>
        )}
      </div>

      {!selectedEventId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Select an event to view its results.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">
            No results have been saved for this event yet.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Complete the event in Live Race Console first.
          </p>
        </div>
      ) : (
        <div>
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {topThree.map((result, idx) => {
                const colors = [
                  'border-yellow-300',
                  'border-gray-300',
                  'border-orange-300',
                ];
                const medalText = [
                  'text-yellow-700',
                  'text-gray-700',
                  'text-orange-700',
                ];
                const medal =
                  result.position === 1
                    ? 'Gold'
                    : result.position === 2
                    ? 'Silver'
                    : 'Bronze';

                return (
                  <div
                    key={result.id}
                    className={cn(
                      'bg-white rounded-2xl shadow-lg p-6 text-center border-2',
                      colors[idx]
                    )}
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Medal className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {result.name}
                    </div>
                    <div className="text-sm text-slate-500">{result.club}</div>
                    <div className="text-xl font-mono font-bold text-slate-800 mt-2">
                      {result.time}
                    </div>
                    <div className={cn('text-sm font-semibold mt-1', medalText[idx])}>
                      {medal}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative mb-4">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, club or age group..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                {selectedEvent?.event_name} — Event Results
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Club
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Age Group
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Time
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                      Medal
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((result) => (
                    <tr
                      key={result.id}
                      className={cn(
                        'hover:bg-slate-50',
                        result.position <= 3 && 'bg-yellow-50/50'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                            result.position === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : result.position === 2
                              ? 'bg-gray-200 text-gray-700'
                              : result.position === 3
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {result.position}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-800">
                        {result.name}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {result.club}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {result.age_group}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                        {result.time}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {result.position <= 3 && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                              result.position === 1
                                ? 'bg-yellow-100 text-yellow-700'
                                : result.position === 2
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-orange-100 text-orange-700'
                            )}
                          >
                            <Award className="w-3 h-3" />
                            {result.position === 1
                              ? 'Gold'
                              : result.position === 2
                              ? 'Silver'
                              : 'Bronze'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
