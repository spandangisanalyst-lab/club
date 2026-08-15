import { useState, useEffect, useMemo } from 'react';
import { Trophy, Loader2, Medal, Award, Search, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent, Heat, HeatEntry, Participant, Club } from '../../lib/types';
import { formatTime, cn } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

type ResultEntry = HeatEntry & {
  finish_time_ms: number | null;
  overall_rank: number | null;
  medal: 'Gold' | 'Silver' | 'Bronze' | null;
};

export default function AdminResults({ settings }: Props) {
  const { events } = useEvents();

  const [selectedEventId, setSelectedEventId] = useState('');
  const [completedEvents, setCompletedEvents] = useState<SwimEvent[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [entries, setEntries] = useState<ResultEntry[]>([]);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [clubs, setClubs] = useState<Map<string, Club>>(new Map());

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const eventMap = useMemo(
    () => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])),
    [events]
  );

  // Convert the time saved by Live Race Console ("00:00.00")
  // into milliseconds for sorting and displaying results.
  const parseTimeToMs = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;

    const text = String(value).trim();

    if (!text) return null;

    // Already milliseconds
    if (/^\d+$/.test(text)) {
      const numberValue = Number(text);
      return Number.isFinite(numberValue) ? numberValue : null;
    }

    const match = text.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);

    if (!match) return null;

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = (match[3] || '0').padEnd(3, '0');

    const milliseconds = Number(fraction);

    return (
      minutes * 60 * 1000 +
      seconds * 1000 +
      milliseconds
    );
  };

  const loadCompletedEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('heats')
        .select('event_id, status, events(*)')
        .eq('status', 'finished');

      if (error) throw error;

      const unique = new Map<string, SwimEvent>();

      (data || []).forEach((heat: any) => {
        const event = Array.isArray(heat.events)
          ? heat.events[0]
          : heat.events;

        if (
          event &&
          heat.event_id &&
          !unique.has(String(heat.event_id))
        ) {
          unique.set(
            String(heat.event_id),
            event as SwimEvent
          );
        }
      });

      setCompletedEvents(
        Array.from(unique.values())
      );
    } catch (error) {
      console.error(
        'Error loading completed events:',
        error
      );

      setCompletedEvents([]);
    }
  };

  useEffect(() => {
    loadCompletedEvents();

    const channel = supabase
      .channel('results-panel-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'heat_entries',
        },
        () => {
          if (selectedEventId) {
            loadData(selectedEventId);
          }

          loadCompletedEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'heats',
        },
        () => {
          if (selectedEventId) {
            loadData(selectedEventId);
          }

          loadCompletedEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      loadData(selectedEventId);
    } else {
      setHeats([]);
      setEntries([]);
      setParticipants(new Map());
      setClubs(new Map());
    }
  }, [selectedEventId]);

  const loadData = async (eventId: string) => {
    setLoading(true);
    setMessage('');

    try {
      const { data: h, error: heatsError } = await supabase
        .from('heats')
        .select('*')
        .eq('event_id', eventId)
        .order('heat_number', {
          ascending: true,
        });

      if (heatsError) throw heatsError;

      const loadedHeats = (h || []) as Heat[];

      setHeats(loadedHeats);

      if (loadedHeats.length === 0) {
        setEntries([]);
        setParticipants(new Map());
        setClubs(new Map());
        return;
      }

      const heatIds = loadedHeats.map(
        (heat) => heat.id
      );

      const {
        data: rawEntries,
        error: entriesError,
      } = await supabase
        .from('heat_entries')
        .select('*')
        .in('heat_id', heatIds);

      if (entriesError) throw entriesError;

      const raw = rawEntries || [];

      const partIds = [
        ...new Set(
          raw
            .map((entry: any) => entry.participant_id)
            .filter(Boolean)
        ),
      ];

      let participantMap =
        new Map<string, Participant>();

      let clubMap =
        new Map<string, Club>();

      if (partIds.length > 0) {
        const {
          data: parts,
          error: participantsError,
        } = await supabase
          .from('participants')
          .select('*')
          .in('id', partIds);

        if (participantsError) {
          throw participantsError;
        }

        participantMap = new Map(
          (parts || []).map(
            (p) =>
              [p.id, p] as [
                string,
                Participant
              ]
          )
        );

        const clubIds = [
          ...new Set(
            (parts || [])
              .map((p: any) => p.club_id)
              .filter(Boolean)
          ),
        ];

        if (clubIds.length > 0) {
          const {
            data: cls,
            error: clubsError,
          } = await supabase
            .from('clubs')
            .select('*')
            .in('id', clubIds);

          if (clubsError) {
            throw clubsError;
          }

          clubMap = new Map(
            (cls || []).map(
              (c) =>
                [c.id, c] as [
                  string,
                  Club
                ]
            )
          );
        }
      }

      setParticipants(participantMap);
      setClubs(clubMap);

      /*
       * IMPORTANT:
       * AdminEventConsole saves:
       *
       * heat_id
       * participant_id
       * lane
       * time
       *
       * It does NOT save finish_time_ms.
       *
       * Therefore this panel converts "time" into milliseconds
       * instead of expecting a finish_time_ms column.
       */
      const normalized: ResultEntry[] = raw
        .map((entry: any) => {
          const timeMs = parseTimeToMs(
            entry.time ??
            entry.finish_time ??
            entry.finish_time_ms
          );

          return {
            ...entry,
            finish_time_ms: timeMs,
            overall_rank:
              entry.overall_rank ?? null,
            medal: entry.medal ?? null,
          };
        })
        .filter(
          (entry) =>
            entry.finish_time_ms !== null &&
            entry.finish_time_ms > 0
        );

      // Keep the fastest result for a swimmer if the swimmer
      // appeared in more than one heat.
      const fastestByParticipant =
        new Map<string, ResultEntry>();

      normalized.forEach((entry) => {
        const participantId =
          String(entry.participant_id);

        const existing =
          fastestByParticipant.get(
            participantId
          );

        if (
          !existing ||
          (entry.finish_time_ms || Infinity) <
            (existing.finish_time_ms || Infinity)
        ) {
          fastestByParticipant.set(
            participantId,
            entry
          );
        }
      });

      const sorted = Array.from(
        fastestByParticipant.values()
      ).sort(
        (a, b) =>
          (a.finish_time_ms || Infinity) -
          (b.finish_time_ms || Infinity)
      );

      const ranked: ResultEntry[] =
        sorted.map((entry, index) => ({
          ...entry,
          overall_rank: index + 1,
          medal:
            index === 0
              ? 'Gold'
              : index === 1
              ? 'Silver'
              : index === 2
              ? 'Bronze'
              : null,
        }));

      setEntries(ranked);
    } catch (error: any) {
      console.error(
        'Error loading results:',
        error
      );

      setMessage(
        `Error loading results: ${
          error?.message || 'Unknown error'
        }`
      );

      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const declareResults = async () => {
    if (!selectedEventId) return;

    if (entries.length === 0) {
      setMessage(
        'No finished entries to declare results for.'
      );
      return;
    }

    setProcessing(true);
    setMessage('');

    try {
      const ranked = [...entries].sort(
        (a, b) =>
          (a.finish_time_ms || Infinity) -
          (b.finish_time_ms || Infinity)
      );

      for (
        let i = 0;
        i < ranked.length;
        i++
      ) {
        const rank = i + 1;

        const medal =
          rank === 1
            ? 'Gold'
            : rank === 2
            ? 'Silver'
            : rank === 3
            ? 'Bronze'
            : null;

        await supabase
          .from('heat_entries')
          .update({
            overall_rank: rank,
            medal,
          })
          .eq('id', ranked[i].id);
      }

      const heatIds =
        heats.map((heat) => heat.id);

      if (heatIds.length > 0) {
        await supabase
          .from('heats')
          .update({
            status: 'finished',
          })
          .in('id', heatIds);
      }

      setMessage(
        `Results declared! ${ranked.length} swimmers ranked.`
      );

      await loadData(
        selectedEventId
      );
      await loadCompletedEvents();
    } catch (err: any) {
      setMessage(
        `Error: ${
          err?.message ||
          'Unable to declare results'
        }`
      );
    } finally {
      setProcessing(false);
    }
  };

  const clearResults = async () => {
    if (!selectedEventId) return;

    if (
      !confirm(
        'Clear all saved rankings and medals for this event?'
      )
    ) {
      return;
    }

    try {
      const heatIds =
        heats.map((heat) => heat.id);

      if (heatIds.length === 0) return;

      const {
        error,
      } = await supabase
        .from('heat_entries')
        .update({
          overall_rank: null,
          medal: null,
        })
        .in(
          'heat_id',
          heatIds
        );

      if (error) throw error;

      setMessage(
        'Saved rankings and medals cleared.'
      );

      await loadData(
        selectedEventId
      );
    } catch (error: any) {
      setMessage(
        `Error clearing results: ${
          error?.message || 'Unknown error'
        }`
      );
    }
  };

  const entriesWithResults =
    useMemo(
      () =>
        [...entries].sort(
          (a, b) =>
            (a.finish_time_ms ||
              Infinity) -
            (b.finish_time_ms ||
              Infinity)
        ),
      [entries]
    );

  const filteredResults =
    useMemo(() => {
      if (!search.trim()) {
        return entriesWithResults;
      }

      const q =
        search.toLowerCase();

      return entriesWithResults.filter(
        (entry) => {
          const part =
            participants.get(
              entry.participant_id
            );

          const club =
            part?.club_id
              ? clubs.get(
                  part.club_id
                )
              : null;

          return (
            part?.name
              ?.toLowerCase()
              .includes(q) ||
            club?.name
              ?.toLowerCase()
              .includes(q)
          );
        }
      );
    }, [
      entriesWithResults,
      search,
      participants,
      clubs,
    ]);

  const hasResults =
    entriesWithResults.length > 0;

  const selectedEvent =
    eventMap.get(
      selectedEventId
    ) ||
    completedEvents.find(
      (event) =>
        String(event.id) ===
        String(selectedEventId)
    );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Results Management
        </h1>

        <p className="text-slate-500 mt-1">
          View results for completed swimming events
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200 mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Select Event
        </label>

        <select
          value={selectedEventId}
          onChange={(e) =>
            setSelectedEventId(
              e.target.value
            )
          }
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white"
        >
          <option value="">
            Choose a completed event...
          </option>

          {completedEvents.map(
            (ev) => (
              <option
                key={ev.id}
                value={ev.id}
              >
                {ev.category ||
                  'Event'}{' '}
                -{' '}
                {ev.event_name ||
                  ev.title ||
                  ev.name}
              </option>
            )
          )}
        </select>

        {selectedEventId && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={
                declareResults
              }
              disabled={
                processing ||
                entriesWithResults.length ===
                  0
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trophy className="w-4 h-4" />
              )}

              Declare Top 3 Results
            </button>

            {hasResults && (
              <button
                onClick={
                  clearResults
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Clear Results
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {message}
          </div>
        )}
      </div>

      {!selectedEventId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

          <p className="text-slate-500">
            Select a completed event to view its results.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : entriesWithResults.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

          <p className="text-slate-500">
            No finished entries found for this event.
          </p>

          <p className="text-xs text-slate-400 mt-2">
            Results appear automatically after the Live Race Console saves a heat.
          </p>
        </div>
      ) : (
        <div>
          {hasResults && (
            <div className="mb-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedEvent?.event_name ||
                    selectedEvent?.title ||
                    selectedEvent?.name ||
                    'Event Results'}
                </h2>

                <p className="text-sm text-slate-500">
                  {selectedEvent?.category ||
                    'Swimming Event'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {entriesWithResults
                  .slice(0, 3)
                  .map(
                    (entry, idx) => {
                      const part =
                        participants.get(
                          entry.participant_id
                        );

                      const club =
                        part?.club_id
                          ? clubs.get(
                              part.club_id
                            )
                          : null;

                      const medal =
                        idx === 0
                          ? 'Gold'
                          : idx === 1
                          ? 'Silver'
                          : 'Bronze';

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

                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            'bg-white rounded-2xl shadow-lg p-6 text-center border-2',
                            colors[idx]
                          )}
                        >
                          <div
                            className={cn(
                              'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg',
                              idx === 0
                                ? 'bg-yellow-400'
                                : idx === 1
                                ? 'bg-gray-400'
                                : 'bg-orange-500'
                            )}
                          >
                            <Medal className="w-8 h-8 text-white" />
                          </div>

                          <div
                            className={cn(
                              'text-xs font-bold uppercase tracking-wider mb-1',
                              medalText[idx]
                            )}
                          >
                            Position {idx + 1}
                          </div>

                          <div className="text-lg font-bold text-slate-900">
                            {part?.name ||
                              'Unknown'}
                          </div>

                          <div className="text-sm text-slate-500">
                            {club?.name ||
                              'No club'}
                          </div>

                          <div className="text-xl font-mono font-bold text-slate-800 mt-2">
                            {formatTime(
                              entry.finish_time_ms
                            )}
                          </div>

                          <div
                            className={cn(
                              'text-sm font-semibold mt-1',
                              medalText[idx]
                            )}
                          >
                            {medal}
                          </div>
                        </div>
                      );
                    }
                  )}
              </div>
            </div>
          )}

          <div className="relative mb-4">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by name or club..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                All Finishers — Sorted by Position
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
                      Lane
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
                  {filteredResults.map(
                    (entry, idx) => {
                      const part =
                        participants.get(
                          entry.participant_id
                        );

                      const club =
                        part?.club_id
                          ? clubs.get(
                              part.club_id
                            )
                          : null;

                      const rank =
                        entry.overall_rank ||
                        idx + 1;

                      const medal =
                        rank === 1
                          ? 'Gold'
                          : rank === 2
                          ? 'Silver'
                          : rank === 3
                          ? 'Bronze'
                          : null;

                      return (
                        <tr
                          key={entry.id}
                          className={cn(
                            'hover:bg-slate-50',
                            rank <= 3 &&
                              'bg-yellow-50/50'
                          )}
                        >
                          <td className="px-4 py-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                                rank === 1
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : rank === 2
                                  ? 'bg-gray-200 text-gray-700'
                                  : rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {rank}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {entry.lane ??
                              entry.lane_number ??
                              '-'}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-800">
                            {part?.name ||
                              'Unknown'}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {club?.name ||
                              '-'}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                            {formatTime(
                              entry.finish_time_ms
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {medal && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                                  medal === 'Gold'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : medal === 'Silver'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-orange-100 text-orange-700'
                                )}
                              >
                                <Award className="w-3 h-3" />
                                {medal}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
