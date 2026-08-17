import { useState, useEffect, useRef, useMemo } from 'react';
import { Award, Loader2, Search, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  SettingsMap,
  Participant,
  Club,
  SwimEvent,
  HeatEntry,
} from '../lib/types';
import { formatTime, downloadDataUrl } from '../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface CertData {
  participant: Participant;
  club: Club | null;
  event: SwimEvent;
  entry: HeatEntry & {
    finish_time_ms: number;
    overall_rank: number | null;
    medal: 'Gold' | 'Silver' | 'Bronze' | null;
  };
}

/*
 * Same time parser used by Results page.
 *
 * Supports:
 * 00:58.32
 * 01:02.45
 * milliseconds
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

  // MM:SS or MM:SS.xxx
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

export default function CertificatePage({ settings }: Props) {
  /*
   * ============================================================
   * SEARCH / FILTER STATE
   * ============================================================
   */

  const [search, setSearch] = useState('');

  const [selectedEvent, setSelectedEvent] =
    useState('All');

  const [selectedGroup, setSelectedGroup] =
    useState('All');

  const [allResults, setAllResults] =
    useState<CertData[]>([]);

  const [loading, setLoading] = useState(true);

  const [searched, setSearched] =
    useState(false);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  /*
   * ============================================================
   * LOAD SAME DATA USED BY RESULTS PAGE
   * ============================================================
   */

  useEffect(() => {
    loadResults();

    /*
     * Keep certificates updated when results change.
     */
    const channel = supabase
      .channel('certificate-results-live')

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

  /*
   * ============================================================
   * LOAD RESULTS
   * ============================================================
   */

  const loadResults = async () => {
    setLoading(true);

    try {
      /*
       * Get all heat entries.
       *
       * Same as Results page.
       */
      const {
        data: entries,
        error: entriesError,
      } = await supabase
        .from('heat_entries')
        .select('*');

      if (entriesError) {
        throw entriesError;
      }

      if (!entries || entries.length === 0) {
        setAllResults([]);
        return;
      }

      /*
       * Get connected heats.
       */
      const heatIds = [
        ...new Set(
          entries
            .map((entry: any) => entry.heat_id)
            .filter(Boolean)
        ),
      ];

      if (heatIds.length === 0) {
        setAllResults([]);
        return;
      }

      const {
        data: heats,
        error: heatsError,
      } = await supabase
        .from('heats')
        .select('*')
        .in('id', heatIds);

      if (heatsError) {
        throw heatsError;
      }

      if (!heats || heats.length === 0) {
        setAllResults([]);
        return;
      }

      /*
       * ONLY FINISHED HEATS
       *
       * Same rule as Results page.
       */
      const finishedHeatIds = new Set(
        heats
          .filter(
            (heat: any) =>
              heat.status === 'finished'
          )
          .map((heat: any) => heat.id)
      );

      const finishedEntries =
        entries.filter((entry: any) =>
          finishedHeatIds.has(entry.heat_id)
        );

      if (finishedEntries.length === 0) {
        setAllResults([]);
        return;
      }

      /*
       * PARTICIPANTS
       */
      const participantIds = [
        ...new Set(
          finishedEntries
            .map(
              (entry: any) =>
                entry.participant_id
            )
            .filter(Boolean)
        ),
      ];

      const {
        data: participants,
        error: participantsError,
      } = await supabase
        .from('participants')
        .select('*')
        .in('id', participantIds);

      if (participantsError) {
        throw participantsError;
      }

      /*
       * CLUBS
       */
      const clubIds = [
        ...new Set(
          (participants || [])
            .map(
              (participant: any) =>
                participant.club_id
            )
            .filter(Boolean)
        ),
      ];

      let clubs: Club[] = [];

      if (clubIds.length > 0) {
        const {
          data: clubData,
          error: clubsError,
        } = await supabase
          .from('clubs')
          .select('*')
          .in('id', clubIds);

        if (clubsError) {
          throw clubsError;
        }

        clubs = clubData || [];
      }

      /*
       * EVENTS
       */
      const eventIds = [
        ...new Set(
          heats
            .filter((heat: any) =>
              finishedHeatIds.has(heat.id)
            )
            .map(
              (heat: any) =>
                heat.event_id
            )
            .filter(Boolean)
        ),
      ];

      const {
        data: events,
        error: eventsError,
      } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      if (eventsError) {
        throw eventsError;
      }

      /*
       * MAPS
       */
      const participantMap =
        new Map(
          (participants || []).map(
            (participant: Participant) => [
              participant.id,
              participant,
            ]
          )
        );

      const clubMap =
        new Map(
          clubs.map((club: Club) => [
            club.id,
            club,
          ])
        );

      const heatMap =
        new Map(
          heats.map((heat: any) => [
            heat.id,
            heat,
          ])
        );

      const eventMap =
        new Map(
          (events || []).map(
            (event: SwimEvent) => [
              event.id,
              event,
            ]
          )
        );

      /*
       * ========================================================
       * BUILD CERTIFICATE RESULTS
       * ========================================================
       */

      const rows: CertData[] = [];

      for (
        const rawEntry of finishedEntries as any[]
      ) {
        const participant =
          participantMap.get(
            rawEntry.participant_id
          );

        const heat =
          heatMap.get(
            rawEntry.heat_id
          );

        const event = heat
          ? eventMap.get(
              heat.event_id
            )
          : undefined;

        if (!participant || !event) {
          continue;
        }

        /*
         * IMPORTANT:
         *
         * Results page uses:
         *
         * entry.time
         *
         * and falls back to:
         *
         * finish_time
         * finish_time_ms
         */
        const timeMs =
          parseTimeToMs(
            rawEntry.time ??
              rawEntry.finish_time ??
              rawEntry.finish_time_ms
          );

        /*
         * Ignore entries without
         * valid finishing time.
         */
        if (
          timeMs === null ||
          timeMs <= 0
        ) {
          continue;
        }

        rows.push({
          participant,
          club: participant.club_id
            ? clubMap.get(
                participant.club_id
              ) || null
            : null,
          event,
          entry: {
            ...rawEntry,

            finish_time_ms:
              timeMs,

            overall_rank:
              rawEntry.overall_rank ??
              null,

            medal:
              rawEntry.medal ??
              null,
          },
        });
      }

      /*
       * Sort exactly like Results page:
       *
       * Event
       * then rank
       */
      rows.sort((a, b) => {
        const eventA =
          `${a.event.category || ''}-${a.event.event_name || ''}`;

        const eventB =
          `${b.event.category || ''}-${b.event.event_name || ''}`;

        if (eventA !== eventB) {
          return eventA.localeCompare(
            eventB
          );
        }

        return (
          (a.entry.overall_rank ||
            999999) -
          (b.entry.overall_rank ||
            999999)
        );
      });

      setAllResults(rows);
    } catch (error) {
      console.error(
        'Error loading certificate results:',
        error
      );

      setAllResults([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * EVENT DROPDOWN OPTIONS
   * ============================================================
   */

  const eventOptions = useMemo(() => {
    const map =
      new Map<string, string>();

    allResults.forEach((r) => {
      if (r.event.id) {
        map.set(
          String(r.event.id),
          r.event.event_name ||
            r.event.title ||
            r.event.name ||
            'Event'
        );
      }
    });

    return Array.from(
      map.entries()
    ).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [allResults]);

  /*
   * ============================================================
   * AGE GROUP DROPDOWN OPTIONS
   * ============================================================
   */

  const groupOptions = useMemo(() => {
    const groups =
      new Set<string>();

    allResults.forEach((r) => {
      const group =
        (r.event as any).age_group;

      if (group) {
        groups.add(
          String(group)
        );
      }
    });

    return Array.from(groups).sort(
      (a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
        })
    );
  }, [allResults]);

  /*
   * ============================================================
   * FILTER RESULTS
   * ============================================================
   */

  const results = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    return allResults.filter((r) => {
      /*
       * NAME SEARCH
       */
      if (
        q &&
        !r.participant.name
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

      /*
       * EVENT FILTER
       */
      if (
        selectedEvent !== 'All' &&
        String(r.event.id) !==
          selectedEvent
      ) {
        return false;
      }

      /*
       * AGE GROUP FILTER
       */
      if (
        selectedGroup !== 'All' &&
        String(
          (r.event as any).age_group ||
            ''
        ) !== selectedGroup
      ) {
        return false;
      }

      return true;
    });
  }, [
    allResults,
    search,
    selectedEvent,
    selectedGroup,
  ]);

  /*
   * ============================================================
   * SEARCH BUTTON
   * ============================================================
   */

  const handleSearch = () => {
    setSearched(true);
  };

    const generateCertificate = (
    data: CertData
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    /*
     * ============================================================
     * LOAD THE ACTUAL CERTIFICATE TEMPLATE
     * ============================================================
     */

    const image = new Image();

    image.onload = async () => {
  /*
   * Use the exact dimensions of certificate.png
   */
  const W = image.naturalWidth;
  const H = image.naturalHeight;

  canvas.width = W;
  canvas.height = H;

  /*
   * Wait for Montserrat to load before drawing text.
   */
  await document.fonts.load('500 27px Montserrat');

  /*
   * Draw the original certificate template
   * as the complete background.
   */
  ctx.drawImage(
    image,
    0,
    0,
    W,
    H
  );

      /*
       * ========================================================
       * HELPER
       * Draw centered text with automatic size reduction
       * ========================================================
       */

      const drawCenteredText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        fontSize: number,
        fontFamily: string,
        color: string,
        weight = 'normal'
      ) => {
        let size = fontSize;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;

        while (size > 12) {
          ctx.font =
            `${weight} ${size}px ${fontFamily}`;

          if (
            ctx.measureText(text).width <=
            maxWidth
          ) {
            break;
          }

          size -= 1;
        }

        ctx.fillText(
          text,
          x,
          y
        );
      };

      /*
       * ========================================================
       * SCALE
       *
       * Your template is designed around 1536 × 1024.
       * These values automatically scale if the PNG is different.
       * ========================================================
       */

      const scaleX = W / 1491;
      const scaleY = H / 1055;

      /*
       * ========================================================
       * 1. PLAYER NAME
       *
       * Position: centre of the name line
       * ========================================================
       */

      drawCenteredText(
        data.participant.name,
        W * (745 / 1491),
        H * (490 / 1055),
        W * (850 / 1491),
        58 * scaleY,
        'Georgia, serif',
        '#10265f',
        'bold'
      );

      /*
       * ========================================================
       * 2. EVENT
       *
       * ========================================================
       */

      const eventName =
        data.event.event_name ||
        'Event';

      drawCenteredText(
        eventName,
        W * (343 / 1491),
        H * (665 / 1055),
        W * (300 / 1491),
        27 * scaleY,
        'Montserrat, Arial, sans-serif',
        '#111827',
        '500'
      );

      /*
       * ========================================================
       * 3. AGE GROUP
       *
       * ========================================================
       */

      const ageGroup =
        (data.event as any)?.age_group ||
        '—';

      drawCenteredText(
        String(ageGroup),
        W * (745 / 1491),
        H * (665 / 1055),
        W * (300 / 1491),
        27 * scaleY,
        'Montserrat, Arial, sans-serif',
        '#111827',
        '500'
      );

      /*
       * ========================================================
       * 4. POSITION
       *
       * ========================================================
       */

      const position =
        data.entry.overall_rank;

      let positionText = '—';

      if (position) {
        const suffix =
          position === 1
            ? 'st'
            : position === 2
            ? 'nd'
            : position === 3
            ? 'rd'
            : 'th';

        positionText =
          `${position}${suffix} Position`;
      }

      drawCenteredText(
        positionText,
        W * (1140 / 1491),
        H * (665 / 1055),
        W * (300 / 1491),
        27 * scaleY,
        'Montserrat, Arial, sans-serif',
        '#111827',
        '500'
      );

      /*
       * ========================================================
       * DOWNLOAD PNG
       * ========================================================
       */

      const dataUrl =
        canvas.toDataURL(
          'image/png'
        );

      downloadDataUrl(
        dataUrl,
        `Certificate_${data.participant.name.replace(
          /\s+/g,
          '_'
        )}_${eventName.replace(
          /\s+/g,
          '_'
        )}.png`
      );
    };

    /*
     * IMPORTANT:
     *
     * certificate.png must be inside:
     *
     * public/images/certificate.png
     *
     * Because public files are served from /images/...
     */
    image.src =
      '/images/certificate.png';
  };
  /*
   * ============================================================
   * CLEAR FILTERS
   * ============================================================
   */

  const clearFilters = () => {
    setSearch('');
    setSelectedEvent('All');
    setSelectedGroup('All');
    setSearched(false);
  };

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <div>

      {/* Header */}
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">

          <Award className="w-12 h-12 text-cyan-400 mx-auto mb-4" />

          <h1 className="text-4xl font-bold text-white mb-2">
            Certificate Download
          </h1>

          <p className="text-slate-400">
            Search participants and download
            their certificates
          </p>

        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* =================================================
            SEARCH & FILTER SECTION
        ================================================== */}

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-cyan-600" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Find Certificate
              </h2>

              <p className="text-sm text-slate-500">
                Search by participant, event or age group
              </p>
            </div>

          </div>

          {/* Name Search */}
          <div className="mb-4">

            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Search by Name
            </label>

            <div className="flex gap-3">

              <div className="relative flex-1">

                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    handleSearch()
                  }
                  placeholder="Enter participant name..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
                />

              </div>

              <button
                onClick={handleSearch}
                className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
              >
                Search
              </button>

            </div>

          </div>

          {/* Event + Group Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Event */}
            <div>

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Search by Event
              </label>

              <select
                value={selectedEvent}
                onChange={(e) => {
                  setSelectedEvent(
                    e.target.value
                  );
                  setSearched(true);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
              >

                <option value="All">
                  All Events
                </option>

                {eventOptions.map(
                ([id, name]) => {
                  const result = allResults.find(
                    (r) =>
                      String(r.event.id) === id
                  );
                  const gender =
                    (result?.event as any)?.gender ||
                    (result?.event as any)?.sex ||
                    '';
                  const ageGroup =
                    (result?.event as any)?.age_group ||
                    '';
                  return (
                    <option
                      key={id}
                      value={id}
                      >
                      {name}
                      {gender
                      ? ` (${gender})`
                      : ''}
                      {ageGroup
                      ? ` - ${ageGroup}`
                      : ''}
                    </option>
                  );
                }
              )}
        
            </select>
        
          
          </div>   
                
            

            {/* Age Group */}
            <div>

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Search by Age Group
              </label>

              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(
                    e.target.value
                  );
                  setSearched(true);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
              >

                <option value="All">
                  All Age Groups
                </option>

                {groupOptions.map(
                  (group) => (
                    <option
                      key={group}
                      value={group}
                    >
                      {group}
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

          {/* Clear */}
          {(search ||
            selectedEvent !== 'All' ||
            selectedGroup !== 'All') && (

            <div className="mt-4 flex justify-end">

              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-slate-500 hover:text-cyan-600 transition-colors"
              >
                Clear Filters
              </button>

            </div>

          )}

        </div>

        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">

            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />

          </div>
        )}

        {/* Results */}
        {!loading &&
          searched &&
          results.length === 0 && (

            <div className="text-center py-20 bg-white rounded-2xl shadow-lg">

              <Award className="w-16 h-16 text-slate-300 mx-auto mb-4" />

              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No Results Found
              </h3>

              <p className="text-slate-500">
                No completed results match
                your search or filters.
              </p>

            </div>
          )}

        {/* Certificate Results */}
        {!loading &&
          results.length > 0 && (

            <div className="space-y-4">

              <div className="flex items-center justify-between">

                <h3 className="text-lg font-semibold text-slate-700">
                  {results.length}{' '}
                  Certificate
                  {results.length !== 1
                    ? 's'
                    : ''}{' '}
                  Found
                </h3>

              </div>

              {results.map((r) => (

                <div
                  key={r.entry.id}
                  className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-4 border border-slate-200 hover:shadow-xl transition-shadow"
                >

                  {/* Medal */}
                  <div
                    className={`
                      w-12 h-12
                      rounded-full
                      flex items-center
                      justify-center
                      shrink-0
                      ${
                        r.entry.medal ===
                        'Gold'
                          ? 'bg-yellow-100'
                          : r.entry.medal ===
                            'Silver'
                          ? 'bg-gray-200'
                          : r.entry.medal ===
                            'Bronze'
                          ? 'bg-orange-100'
                          : 'bg-cyan-100'
                      }
                    `}
                  >

                    <Award
                      className={`
                        w-6 h-6
                        ${
                          r.entry.medal ===
                          'Gold'
                            ? 'text-yellow-600'
                            : r.entry.medal ===
                              'Silver'
                            ? 'text-gray-600'
                            : r.entry.medal ===
                              'Bronze'
                            ? 'text-orange-600'
                            : 'text-cyan-600'
                        }
                      `}
                    />

                  </div>

                  {/* Participant + Event */}
                  <div className="flex-1 min-w-0">

                    <div className="font-semibold text-slate-800 truncate">
                      {r.participant.name}
                    </div>

                    <div className="text-sm text-slate-500 truncate">
                      {r.event.event_name}
                    </div>

                    <div className="text-xs text-slate-400 mt-1">

                      {r.event.category}

                      {(r.event as any)
                        .age_group && (
                        <>
                          {' · '}
                          {(r.event as any)
                            .age_group}
                        </>
                      )}

                      {' · '}

                      {r.entry.medal
                        ? `${r.entry.medal} Medal`
                        : `Rank ${
                            r.entry
                              .overall_rank ||
                            '-'
                          }`}

                      {r.entry
                        .finish_time_ms &&
                        ` · ${formatTime(
                          r.entry
                            .finish_time_ms
                        )}`}

                    </div>

                  </div>

                  {/* Download */}
                  <button
                    onClick={() =>
                      generateCertificate(r)
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors shrink-0"
                  >

                    <Download className="w-4 h-4" />

                    <span className="hidden sm:inline">
                      Download
                    </span>

                  </button>

                </div>

              ))}

            </div>
          )}

      </div>
    </div>
  );
}
