import { useState, useEffect, useMemo } from 'react';
import { Trophy, Medal, Loader2, Search, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  SettingsMap,
  SwimEvent,
  HeatEntry,
  Participant,
  Club,
} from '../lib/types';
import { formatTime } from '../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface ResultRow {
  entry: HeatEntry & {
    finish_time_ms: number;
    overall_rank: number | null;
    medal: 'Gold' | 'Silver' | 'Bronze' | null;
  };
  participant: Participant;
  club: Club | null;
  event: SwimEvent;
}

/*
 * Convert the time saved by Live Race Console
 * e.g. "00:58.32" -> 58320 milliseconds
 */
const parseTimeToMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text) return null;

  // Already milliseconds
  if (/^\d+$/.test(text)) {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  // Format: MM:SS or MM:SS.xxx
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

export default function ResultsPage({ settings }: Props) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    loadResults();

    /*
     * Keep homepage results updated when the admin/live console
     * changes heat entries or heats.
     */
    const channel = supabase
      .channel('homepage-results-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'heat_entries',
        },
        () => {
          loadResults();
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
          loadResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadResults = async () => {
    setLoading(true);

    try {
      /*
       * IMPORTANT:
       *
       * Do NOT use:
       * .not('finish_time_ms', 'is', null)
       *
       * because Live Race Console saves the result in `time`.
       */
      const { data: entries, error: entriesError } = await supabase
        .from('heat_entries')
        .select('*');

      if (entriesError) {
        throw entriesError;
      }

      if (!entries || entries.length === 0) {
        setResults([]);
        return;
      }

      /*
       * Get all heats connected to these entries.
       */
      const heatIds = [
        ...new Set(
          entries
            .map((entry: any) => entry.heat_id)
            .filter(Boolean)
        ),
      ];

      if (heatIds.length === 0) {
        setResults([]);
        return;
      }

      const { data: heats, error: heatsError } = await supabase
        .from('heats')
        .select('*')
        .in('id', heatIds);

      if (heatsError) {
        throw heatsError;
      }

      if (!heats || heats.length === 0) {
        setResults([]);
        return;
      }

      /*
       * Only show results for completed/finished events.
       *
       * This prevents unfinished live races from appearing
       * on the public Results page.
       */
      const finishedHeatIds = new Set(
        heats
          .filter((heat: any) => heat.status === 'finished')
          .map((heat: any) => heat.id)
      );

      /*
       * If the Admin page has already declared the results,
       * the heat status will be "finished".
       */
      const finishedEntries = entries.filter((entry: any) =>
        finishedHeatIds.has(entry.heat_id)
      );

      if (finishedEntries.length === 0) {
        setResults([]);
        return;
      }

      /*
       * Participants
       */
      const participantIds = [
        ...new Set(
          finishedEntries
            .map((entry: any) => entry.participant_id)
            .filter(Boolean)
        ),
      ];

      const { data: participants, error: participantsError } =
        await supabase
          .from('participants')
          .select('*')
          .in('id', participantIds);

      if (participantsError) {
        throw participantsError;
      }

      /*
       * Clubs
       */
      const clubIds = [
        ...new Set(
          (participants || [])
            .map((p: any) => p.club_id)
            .filter(Boolean)
        ),
      ];

      let clubs: Club[] = [];

      if (clubIds.length > 0) {
        const { data: clubData, error: clubsError } =
          await supabase
            .from('clubs')
            .select('*')
            .in('id', clubIds);

        if (clubsError) {
          throw clubsError;
        }

        clubs = clubData || [];
      }

      /*
       * Events
       */
      const eventIds = [
        ...new Set(
          heats
            .filter((heat: any) => finishedHeatIds.has(heat.id))
            .map((heat: any) => heat.event_id)
            .filter(Boolean)
        ),
      ];

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      if (eventsError) {
        throw eventsError;
      }

      /*
       * Maps for quick lookup
       */
      const participantMap = new Map(
        (participants || []).map((p) => [p.id, p])
      );

      const clubMap = new Map(
        clubs.map((c) => [c.id, c])
      );

      const heatMap = new Map(
        heats.map((h) => [h.id, h])
      );

      const eventMap = new Map(
        (events || []).map((e) => [e.id, e])
      );

      /*
       * Build result rows.
       */
      const normalizedRows: ResultRow[] = [];

      for (const rawEntry of finishedEntries as any[]) {
        const participant = participantMap.get(
          rawEntry.participant_id
        );

        const heat = heatMap.get(rawEntry.heat_id);

        const event = heat
          ? eventMap.get(heat.event_id)
          : undefined;

        if (!participant || !event) {
          continue;
        }

        /*
         * Live Console normally saves:
         * entry.time
         *
         * But we also support:
         * finish_time
         * finish_time_ms
         */
        const timeMs = parseTimeToMs(
          rawEntry.time ??
          rawEntry.finish_time ??
          rawEntry.finish_time_ms
        );

        /*
         * Ignore entries without a valid finished time.
         */
        if (timeMs === null || timeMs <= 0) {
          continue;
        }

        normalizedRows.push({
          entry: {
            ...rawEntry,
            finish_time_ms: timeMs,
            overall_rank:
              rawEntry.overall_rank ?? null,
            medal:
              rawEntry.medal ?? null,
          },
          participant,
          club: participant.club_id
            ? clubMap.get(participant.club_id) || null
            : null,
          event,
        });
      }

      /*
       * Group entries by EVENT.
       *
       * This is important because the same swimmer may participate
       * in different events.
       */
      const grouped: Record<string, ResultRow[]> = {};

      for (const row of normalizedRows) {
        const eventId = String(row.event.id);

        if (!grouped[eventId]) {
          grouped[eventId] = [];
        }

        grouped[eventId].push(row);
      }

      /*
       * Sort each event separately.
       *
       * Prefer saved overall_rank from Admin Results.
       * If rank is missing, fall back to finish time.
       */
      const finalRows: ResultRow[] = [];

      Object.values(grouped).forEach((eventRows) => {
        eventRows.sort((a, b) => {
          if (
            a.entry.overall_rank !== null &&
            b.entry.overall_rank !== null
          ) {
            return (
              a.entry.overall_rank -
              b.entry.overall_rank
            );
          }

          return (
            a.entry.finish_time_ms -
            b.entry.finish_time_ms
          );
        });

        /*
         * If Admin has already declared rankings,
         * preserve them.
         *
         * Otherwise calculate them from time.
         */
        const hasSavedRanks = eventRows.some(
          (row) => row.entry.overall_rank !== null
        );

        if (!hasSavedRanks) {
          eventRows.forEach((row, index) => {
            row.entry.overall_rank = index + 1;

            row.entry.medal =
              index === 0
                ? 'Gold'
                : index === 1
                ? 'Silver'
                : index === 2
                ? 'Bronze'
                : null;
          });
        }

        finalRows.push(...eventRows);
      });

      /*
       * Sort events/results consistently.
       */
      finalRows.sort((a, b) => {
        const eventA =
          `${a.event.category || ''}-${a.event.event_name || ''}`;

        const eventB =
          `${b.event.category || ''}-${b.event.event_name || ''}`;

        if (eventA !== eventB) {
          return eventA.localeCompare(eventB);
        }

        return (
          (a.entry.overall_rank || 999999) -
          (b.entry.overall_rank || 999999)
        );
      });

      setResults(finalRows);
    } catch (error) {
      console.error('Error loading homepage results:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Categories
   */
  const categories = useMemo(() => {
    const categorySet = new Set(
      results
        .map((r) => r.event.category)
        .filter(Boolean)
    );

    return ['All', ...Array.from(categorySet)];
  }, [results]);

  /*
   * Search + category filtering
   */
  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (
        filterCategory !== 'All' &&
        r.event.category !== filterCategory
      ) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();

        return (
          r.participant.name
            .toLowerCase()
            .includes(q) ||
          (r.event.event_name || '')
            .toLowerCase()
            .includes(q) ||
          (r.event.category || '')
            .toLowerCase()
            .includes(q) ||
          (r.club?.name || '')
            .toLowerCase()
            .includes(q)
        );
      }

      return true;
    });
  }, [results, filterCategory, search]);

  /*
   * Group public results by event.
   */
  const groupedByEvent = useMemo(() => {
    const map: Record<string, ResultRow[]> = {};

    for (const r of filtered) {
      const eventName =
        `${r.event.event_name || r.event.title || r.event.name || 'Event'} (${r.event.category || 'General'})`;

      if (!map[eventName]) {
        map[eventName] = [];
      }

      map[eventName].push(r);
    }

    /*
     * Always sort swimmers by their declared position.
     */
    Object.values(map).forEach((rows) => {
      rows.sort((a, b) => {
        return (
          (a.entry.overall_rank || 999999) -
          (b.entry.overall_rank || 999999)
        );
      });
    });

    return map;
  }, [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Trophy className="w-12 h-12 text-cyan-400 mx-auto mb-4" />

          <h1 className="text-4xl font-bold text-white mb-2">
            Results
          </h1>

          <p className="text-slate-400">
            {settings.site_title}
          </p>
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
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search by name, event, or club..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value)
            }
            className="px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
          >
            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : results.length === 0 ? (

          /* No results */
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">

            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Results Yet
            </h3>

            <p className="text-slate-500">
              Results will be displayed here once an event
              has been completed.
            </p>
          </div>

        ) : filtered.length === 0 ? (

          /* Search returned nothing */
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">

            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />

            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Matching Results
            </h3>

            <p className="text-slate-500">
              Try changing your search or category filter.
            </p>
          </div>

        ) : (

          /* Results */
          <div className="space-y-6">

            {Object.entries(groupedByEvent).map(
              ([eventName, rows]) => (

                <div
                  key={eventName}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200"
                >

                  {/* Event heading */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">

                    <h2 className="text-lg font-bold text-white">
                      {eventName}
                    </h2>

                  </div>

                  {/* Swimmers */}
                  <div className="divide-y divide-slate-100">

                    {rows.map((r, idx) => {

                      const rank =
                        r.entry.overall_rank ||
                        idx + 1;

                      const isTop3 =
                        rank <= 3;

                      const medal =
                        r.entry.medal ||
                        (
                          rank === 1
                            ? 'Gold'
                            : rank === 2
                            ? 'Silver'
                            : rank === 3
                            ? 'Bronze'
                            : null
                        );

                      return (
                        <div
                          key={r.entry.id}
                          className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors"
                        >

                          {/* Rank */}
                          <div
                            className={`
                              w-10 h-10
                              rounded-full
                              flex items-center
                              justify-center
                              font-bold
                              text-sm
                              shrink-0
                              mr-4
                              ${
                                rank === 1
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : rank === 2
                                  ? 'bg-gray-200 text-gray-700'
                                  : rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            `}
                          >
                            {isTop3 ? (
                              <Medal className="w-5 h-5" />
                            ) : (
                              rank
                            )}
                          </div>

                          {/* Participant */}
                          <div className="flex-1 min-w-0">

                            <div className="font-semibold text-slate-800 truncate">
                              {r.participant.name}
                            </div>

                            <div className="text-sm text-slate-500">
                              {r.club?.name ||
                                'Independent'}
                            </div>

                          </div>

                          {/* Time */}
                          <div className="text-right">

                            <div className="flex items-center gap-1.5 text-slate-800 font-mono font-semibold">

                              <Clock className="w-4 h-4 text-slate-400" />

                              {formatTime(
                                r.entry.finish_time_ms
                              )}

                            </div>

                            {medal && (
                              <div
                                className="text-xs font-medium mt-0.5"
                                style={{
                                  color:
                                    medal === 'Gold'
                                      ? '#B8860B'
                                      : medal === 'Silver'
                                      ? '#808080'
                                      : '#B87333',
                                }}
                              >
                                {medal}
                              </div>
                            )}

                          </div>

                        </div>
                      );
                    })}

                  </div>
                </div>
              )
            )}

          </div>
        )}
      </div>
    </div>
  );
}
