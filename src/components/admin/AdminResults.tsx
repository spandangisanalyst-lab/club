import { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Loader2,
  Medal,
  Award,
  Search,
  AlertCircle,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';

import type { SettingsMap } from '../../lib/types';

interface Props {
  settings: SettingsMap;
}

interface ResultRecord {
  id: string;
  event_id: string;
  event_name: string | null;
  age_group: string | null;
  participant_id: string | null;
  name: string | null;
  club: string | null;
  time: string | null;
  position: number | null;
  created_at: string;
}

interface CompletedEvent {
  key: string;
  event_id: string;
  event_name: string;
  age_group: string;
}

export default function AdminResults({ settings }: Props) {
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [selectedEventKey, setSelectedEventKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  // =========================================================
  // LOAD COMPLETED RESULTS
  // =========================================================

  const loadResults = async () => {
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setResults((data || []) as ResultRecord[]);
    } catch (error: any) {
      console.error('Error loading results:', error);

      setMessage(
        error?.message || 'Failed to load completed results.'
      );

      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD ON PAGE OPEN
  // =========================================================

  useEffect(() => {
    loadResults();

    // Automatically refresh when results are added/changed
    const channel = supabase
      .channel('admin-results-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'results',
        },
        () => {
          loadResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // =========================================================
  // CREATE EVENT + AGE GROUP LIST
  // =========================================================

  const completedEvents = useMemo<CompletedEvent[]>(() => {
    const map = new Map<string, CompletedEvent>();

    results.forEach((result) => {
      if (!result.event_id) return;

      const eventName =
        result.event_name?.trim() || 'Unknown Event';

      const ageGroup =
        result.age_group?.trim() || 'Unknown Age Group';

      const key = `${result.event_id}__${ageGroup}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          event_id: String(result.event_id),
          event_name: eventName,
          age_group: ageGroup,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const eventCompare = a.event_name.localeCompare(
        b.event_name
      );

      if (eventCompare !== 0) {
        return eventCompare;
      }

      return a.age_group.localeCompare(b.age_group);
    });
  }, [results]);

  // =========================================================
  // SELECTED EVENT
  // =========================================================

  const selectedEvent = useMemo(() => {
    return completedEvents.find(
      (event) => event.key === selectedEventKey
    );
  }, [completedEvents, selectedEventKey]);

  // =========================================================
  // RESULTS FOR SELECTED EVENT + AGE GROUP
  // =========================================================

  const selectedResults = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    return results
      .filter(
        (result) =>
          String(result.event_id) ===
            String(selectedEvent.event_id) &&
          String(result.age_group || '').trim() ===
            String(selectedEvent.age_group || '').trim()
      )
      .sort((a, b) => {
        return (
          Number(a.position || 999999) -
          Number(b.position || 999999)
        );
      });
  }, [results, selectedEvent]);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredResults = useMemo(() => {
    if (!search.trim()) {
      return selectedResults;
    }

    const query = search.toLowerCase().trim();

    return selectedResults.filter((result) => {
      const name = (result.name || '').toLowerCase();
      const club = (result.club || '').toLowerCase();

      return (
        name.includes(query) ||
        club.includes(query)
      );
    });
  }, [selectedResults, search]);

  // =========================================================
  // TOP 3
  // =========================================================

  const topThree = useMemo(() => {
    return selectedResults
      .filter(
        (result) =>
          result.position !== null &&
          Number(result.position) <= 3
      )
      .sort(
        (a, b) =>
          Number(a.position) - Number(b.position)
      )
      .slice(0, 3);
  }, [selectedResults]);

  // =========================================================
  // MEDAL HELPERS
  // =========================================================

  const getMedalName = (position: number | null) => {
    if (position === 1) return 'Gold';
    if (position === 2) return 'Silver';
    if (position === 3) return 'Bronze';
    return '';
  };

  const getMedalClasses = (position: number | null) => {
    if (position === 1) {
      return {
        border: 'border-yellow-300',
        icon: 'text-yellow-600',
        badge: 'bg-yellow-100 text-yellow-700',
        circle: 'bg-yellow-100 text-yellow-700',
      };
    }

    if (position === 2) {
      return {
        border: 'border-gray-300',
        icon: 'text-gray-500',
        badge: 'bg-gray-100 text-gray-700',
        circle: 'bg-gray-200 text-gray-700',
      };
    }

    return {
      border: 'border-orange-300',
      icon: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-700',
      circle: 'bg-orange-100 text-orange-700',
    };
  };

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Results Management
        </h1>

        <p className="text-slate-500 mt-1">
          View completed event-wise swimming results.
        </p>
      </div>

      {/* EVENT SELECTOR */}
      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200">

        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-cyan-600" />

          <label className="text-sm font-semibold text-slate-700">
            Select Completed Event
          </label>
        </div>

        <select
          value={selectedEventKey}
          onChange={(e) => {
            setSelectedEventKey(e.target.value);
            setSearch('');
          }}
          className="w-full px-3 py-3 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white"
        >
          <option value="">
            Choose a completed event...
          </option>

          {completedEvents.map((event) => (
            <option
              key={event.key}
              value={event.key}
            >
              {event.event_name} — {event.age_group}
            </option>
          ))}
        </select>

        {completedEvents.length === 0 && !loading && (
          <div className="mt-3 text-sm text-slate-500">
            No completed events are available yet.
          </div>
        )}

        {/* ERROR / MESSAGE */}
        {message && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />

            <span>{message}</span>
          </div>
        )}
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : !selectedEvent ? (

        /* NOTHING SELECTED */
        <div className="text-center py-20 bg-white rounded-2xl shadow-md border border-slate-200">

          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

          <p className="text-slate-500">
            Select a completed event to view its results.
          </p>

        </div>

      ) : (

        <div>

          {/* EVENT TITLE */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 mb-6">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedEvent.event_name}
                </h2>

                <p className="text-cyan-600 font-semibold mt-1">
                  {selectedEvent.age_group}
                </p>
              </div>

              <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold text-sm">
                Completed
              </div>

            </div>

          </div>

          {/* NO RESULTS */}
          {selectedResults.length === 0 ? (

            <div className="text-center py-20 bg-white rounded-2xl shadow-md border border-slate-200">

              <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

              <p className="text-slate-500">
                No results found for this event.
              </p>

            </div>

          ) : (

            <>

              {/* TOP 3 */}
              {topThree.length > 0 && (

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                  {topThree.map((result) => {

                    const position =
                      Number(result.position);

                    const medal =
                      getMedalName(position);

                    const classes =
                      getMedalClasses(position);

                    return (
                      <div
                        key={result.id}
                        className={`bg-white rounded-2xl shadow-lg p-6 text-center border-2 ${classes.border}`}
                      >

                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm ${classes.circle}`}
                        >
                          <Medal
                            className={`w-8 h-8 ${classes.icon}`}
                          />
                        </div>

                        <div className="text-lg font-bold text-slate-900">
                          {result.name || 'Unknown Swimmer'}
                        </div>

                        <div className="text-sm text-slate-500 mt-1">
                          {result.club || 'No Club'}
                        </div>

                        <div className="text-xl font-mono font-bold text-slate-800 mt-2">
                          {result.time || '-'}
                        </div>

                        <div
                          className={`inline-flex mt-2 px-3 py-1 rounded-full text-xs font-bold ${classes.badge}`}
                        >
                          {medal}
                        </div>

                      </div>
                    );
                  })}

                </div>

              )}

              {/* SEARCH */}
              <div className="relative mb-4">

                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search by swimmer or club..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white"
                />

              </div>

              {/* RESULTS TABLE */}
              <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">

                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

                    <div>
                      <h3 className="font-bold text-slate-800">
                        Event Results
                      </h3>

                      <p className="text-sm text-slate-500">
                        {selectedEvent.event_name} —{' '}
                        {selectedEvent.age_group}
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-slate-600">
                      {selectedResults.length} Swimmer
                      {selectedResults.length !== 1
                        ? 's'
                        : ''}
                    </div>

                  </div>

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

                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                          Time
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                          Medal
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {filteredResults.map((result, index) => {

                        const position =
                          Number(
                            result.position ||
                              index + 1
                          );

                        const medal =
                          getMedalName(position);

                        return (

                          <tr
                            key={result.id}
                            className={`hover:bg-slate-50 ${
                              position <= 3
                                ? 'bg-yellow-50/50'
                                : ''
                            }`}
                          >

                            {/* POSITION */}
                            <td className="px-4 py-3">

                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                                  position === 1
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : position === 2
                                    ? 'bg-gray-200 text-gray-700'
                                    : position === 3
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {position}
                              </div>

                            </td>

                            {/* NAME */}
                            <td className="px-4 py-3">

                              <div className="font-semibold text-slate-800">
                                {result.name ||
                                  'Unknown Swimmer'}
                              </div>

                            </td>

                            {/* CLUB */}
                            <td className="px-4 py-3 text-slate-600">
                              {result.club || '-'}
                            </td>

                            {/* TIME */}
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                              {result.time || '-'}
                            </td>

                            {/* MEDAL */}
                            <td className="px-4 py-3 text-center">

                              {medal && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    position === 1
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : position === 2
                                      ? 'bg-gray-100 text-gray-700'
                                      : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  <Award className="w-3 h-3" />

                                  {medal}
                                </span>
                              )}

                            </td>

                          </tr>

                        );

                      })}

                    </tbody>

                  </table>

                </div>

                {/* SEARCH EMPTY */}
                {filteredResults.length === 0 &&
                  search.trim() && (
                    <div className="p-8 text-center text-slate-500">
                      No swimmers found for "{search}".
                    </div>
                  )}

              </div>

            </>

          )}

        </div>

      )}

    </div>
  );
}
