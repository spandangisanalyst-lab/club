import { useState, useEffect } from 'react';
import { Medal, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  SettingsMap,
  Club,
  SwimEvent,
  Participant,
} from '../lib/types';

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

/*
 * ============================================================
 * CHAMPIONSHIP POINT SYSTEM
 * ============================================================
 *
 * Gold   = 5 points
 * Silver = 3 points
 * Bronze = 1 point
 *
 * Under 10 = 0 championship points
 */
const MEDAL_POINTS = {
  Gold: 5,
  Silver: 3,
  Bronze: 1,
};

/*
 * Detect Under-10 age groups.
 *
 * This supports common formats such as:
 * U/10
 * U10
 * Under 10
 * UNDER 10
 * Under-10
 */
const isUnder10 = (ageGroup: unknown): boolean => {
  if (!ageGroup) return false;

  const value = String(ageGroup)
    .toLowerCase()
    .replace(/[\s_-]/g, '');

  return (
    value === 'u/10'.replace('/', '') ||
    value === 'u10' ||
    value === 'under10' ||
    value.includes('under10')
  );
};

export default function ChampionshipPage({
  settings,
}: Props) {
  const [standings, setStandings] = useState<ClubPoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, []);

  const loadStandings = async () => {
    setLoading(true);

    try {
      /*
       * ========================================================
       * GET DECLARED RESULTS
       * ========================================================
       *
       * Only entries with an overall_rank are considered.
       */
      const { data: entries, error: entriesError } =
        await supabase
          .from('heat_entries')
          .select('*')
          .not('overall_rank', 'is', null)
          .order('overall_rank', {
            ascending: true,
          });

      if (entriesError) {
        throw entriesError;
      }

      if (!entries || entries.length === 0) {
        setStandings([]);
        return;
      }

      /*
       * ========================================================
       * PARTICIPANTS
       * ========================================================
       */
      const participantIds = [
        ...new Set(
          entries
            .map((entry: any) => entry.participant_id)
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
       * ========================================================
       * HEATS
       * ========================================================
       */
      const heatIds = [
        ...new Set(
          entries
            .map((entry: any) => entry.heat_id)
            .filter(Boolean)
        ),
      ];

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

      /*
       * ========================================================
       * EVENTS
       * ========================================================
       */
      const eventIds = [
        ...new Set(
          (heats || [])
            .map((heat: any) => heat.event_id)
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
       * ========================================================
       * CLUBS
       * ========================================================
       */
      const clubIds = [
        ...new Set(
          (participants || [])
            .map((participant: any) => participant.club_id)
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
       * ========================================================
       * MAPS
       * ========================================================
       */
      const participantMap = new Map(
        (participants || []).map(
          (participant: Participant) => [
            participant.id,
            participant,
          ]
        )
      );

      const heatMap = new Map(
        (heats || []).map((heat: any) => [
          heat.id,
          heat,
        ])
      );

      const eventMap = new Map(
        (events || []).map(
          (event: SwimEvent) => [
            event.id,
            event,
          ]
        )
      );

      const clubMap = new Map(
        clubs.map((club: Club) => [
          club.id,
          club,
        ])
      );

      /*
       * ========================================================
       * CALCULATE CLUB POINTS
       * ========================================================
       */
      const clubPointsMap =
        new Map<string, ClubPoints>();

      for (const entry of entries as any[]) {
        const participant = participantMap.get(
          entry.participant_id
        );

        if (!participant || !participant.club_id) {
          continue;
        }

        const heat = heatMap.get(
          entry.heat_id
        );

        if (!heat) {
          continue;
        }

        const event = eventMap.get(
          heat.event_id
        );

        if (!event) {
          continue;
        }

        /*
         * ======================================================
         * UNDER 10 EXCLUSION
         * ======================================================
         *
         * Under-10 swimmers receive NO championship points.
         *
         * Their results can still exist normally.
         */
        if (isUnder10(event.age_group)) {
          continue;
        }

        /*
         * ======================================================
         * MEDAL
         * ======================================================
         */
        const medal = entry.medal;

        /*
         * Only Gold, Silver and Bronze score points.
         */
        if (
          medal !== 'Gold' &&
          medal !== 'Silver' &&
          medal !== 'Bronze'
        ) {
          continue;
        }

        const points =
          MEDAL_POINTS[medal];

        const clubId =
          participant.club_id;

        /*
         * Create club record if it doesn't exist.
         */
        if (!clubPointsMap.has(clubId)) {
          const club = clubMap.get(clubId);

          if (!club) {
            continue;
          }

          clubPointsMap.set(
            clubId,
            {
              club,
              points: 0,
              gold: 0,
              silver: 0,
              bronze: 0,
            }
          );
        }

        const clubPoints =
          clubPointsMap.get(clubId)!;

        /*
         * Add championship points.
         */
        clubPoints.points += points;

        /*
         * Count medals.
         */
        if (medal === 'Gold') {
          clubPoints.gold++;
        }

        if (medal === 'Silver') {
          clubPoints.silver++;
        }

        if (medal === 'Bronze') {
          clubPoints.bronze++;
        }
      }

      /*
       * ========================================================
       * SORT CLUBS
       * ========================================================
       *
       * 1. Total points
       * 2. Gold medals
       * 3. Silver medals
       * 4. Bronze medals
       */
      const sorted = Array.from(
        clubPointsMap.values()
      ).sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.gold !== a.gold) {
          return b.gold - a.gold;
        }

        if (b.silver !== a.silver) {
          return b.silver - a.silver;
        }

        return b.bronze - a.bronze;
      });

      setStandings(sorted);
    } catch (error) {
      console.error(
        'Error loading championship standings:',
        error
      );

      setStandings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ======================================================
          PREMIUM HEADER
      ======================================================= */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">

        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-400 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-20 text-center">

          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md shadow-2xl mb-6">
            <Trophy className="w-10 h-10 text-yellow-300" />
          </div>

          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-10 bg-cyan-400/60" />
            <span className="text-cyan-300 text-xs font-bold uppercase tracking-[0.25em]">
              Championship Standings
            </span>
            <div className="h-px w-10 bg-cyan-400/60" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
            Club Championship
          </h1>

          <p className="max-w-2xl mx-auto text-slate-300 text-sm sm:text-base">
            Overall club standings based on championship points
          </p>

        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">

        {loading ? (

          /* ==================================================
             LOADING
          =================================================== */
          <div className="flex flex-col items-center justify-center py-24">

            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center mb-5">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>

            <p className="text-sm font-semibold text-slate-500">
              Loading championship standings...
            </p>

          </div>

        ) : standings.length === 0 ? (

          /* ==================================================
             NO STANDINGS
          =================================================== */
          <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-200">

            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-slate-100 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-slate-300" />
            </div>

            <h3 className="text-xl font-bold text-slate-700 mb-2">
              No Standings Yet
            </h3>

            <p className="text-slate-500 max-w-md mx-auto px-4">
              Championship standings will appear here once
              results are recorded.
            </p>

          </div>

        ) : (

          <div className="space-y-10">

            {/* =================================================
                PODIUM
            ================================================== */}
            {standings.length >= 1 && (

              <section>

                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Top Clubs
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-5 items-end">

                  {[1, 0, 2].map((idx) => {

                    const s = standings[idx];

                    if (!s) {
                      return (
                        <div key={idx} />
                      );
                    }

                    const position = idx + 1;

                    const heights = [
                      'h-32 sm:h-40',
                      'h-40 sm:h-52',
                      'h-28 sm:h-36',
                    ];

                    const colors = [
                      'from-slate-300 via-gray-300 to-slate-400',
                      'from-yellow-200 via-yellow-400 to-amber-500',
                      'from-orange-300 via-orange-400 to-orange-600',
                    ];

                    const textColors = [
                      'text-slate-700',
                      'text-yellow-900',
                      'text-orange-900',
                    ];

                    const podiumBorder = [
                      'border-slate-300',
                      'border-yellow-300',
                      'border-orange-300',
                    ];

                    const medals = ['🥈', '🥇', '🥉'];

                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center min-w-0"
                      >

                        {/* Club information */}
                        <div className="text-center mb-4 w-full">

                          <div
                            className={`
                              relative mx-auto
                              w-16 h-16 sm:w-20 sm:h-20
                              rounded-full
                              bg-gradient-to-br
                              ${colors[position - 1]}
                              border-4
                              ${podiumBorder[position - 1]}
                              flex items-center
                              justify-center
                              shadow-xl
                            `}
                          >
                            <span className="text-2xl sm:text-3xl">
                              {medals[position - 1]}
                            </span>

                            <span
                              className={`
                                absolute -bottom-2 -right-1
                                w-7 h-7
                                rounded-full
                                bg-white
                                border-2
                                ${podiumBorder[position - 1]}
                                flex items-center justify-center
                                text-xs font-black
                                ${textColors[position - 1]}
                                shadow-md
                              `}
                            >
                              {position}
                            </span>
                          </div>

                          <div className="mt-4 font-extrabold text-slate-800 text-xs sm:text-sm truncate px-1">
                            {s.club.name}
                          </div>

                          <div className="flex items-baseline justify-center gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-black text-cyan-600">
                              {s.points}
                            </span>

                            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
                              pts
                            </span>
                          </div>

                        </div>

                        {/* Podium block */}
                        <div
                          className={`
                            w-full
                            ${heights[position - 1]}
                            bg-gradient-to-t
                            ${colors[position - 1]}
                            rounded-t-2xl
                            border-t border-x
                            ${podiumBorder[position - 1]}
                            flex items-end
                            justify-center
                            pb-3
                            shadow-lg
                            relative overflow-hidden
                          `}
                        >

                          <div className="absolute inset-0 bg-white/10" />

                          <span className="relative text-white drop-shadow font-black text-sm sm:text-lg">
                            {position === 1
                              ? '1st'
                              : position === 2
                              ? '2nd'
                              : '3rd'}
                          </span>

                        </div>

                      </div>
                    );
                  })}

                </div>

              </section>
            )}

            {/* =================================================
                FULL STANDINGS
            ================================================== */}
            <section className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">

              {/* Table header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 sm:px-7 py-5">

                <div className="absolute right-0 top-0 w-40 h-40 bg-cyan-400/10 rounded-full blur-2xl" />

                <div className="relative flex items-center gap-3">

                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <Medal className="w-5 h-5 text-cyan-300" />
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      Full Standings
                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Club championship leaderboard
                    </p>
                  </div>

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full min-w-[650px]">

                  <thead>

                    <tr className="bg-slate-50 border-b border-slate-200">

                      <th className="px-5 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        Rank
                      </th>

                      <th className="px-5 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        Club
                      </th>

                      <th className="px-5 py-4 text-center text-[11px] font-black text-yellow-600 uppercase tracking-wider">
                        Gold
                      </th>

                      <th className="px-5 py-4 text-center text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        Silver
                      </th>

                      <th className="px-5 py-4 text-center text-[11px] font-black text-orange-600 uppercase tracking-wider">
                        Bronze
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-black text-cyan-600 uppercase tracking-wider">
                        Points
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {standings.map((s, idx) => (

                      <tr
                        key={s.club.id}
                        className={`
                          transition-all duration-200
                          ${
                            idx === 0
                              ? 'bg-yellow-50/50 hover:bg-yellow-50'
                              : 'hover:bg-slate-50'
                          }
                        `}
                      >

                        {/* Rank */}
                        <td className="px-5 py-4">

                          <div
                            className={`
                              w-9 h-9
                              rounded-xl
                              flex items-center
                              justify-center
                              font-black
                              text-sm
                              shadow-sm
                              ${
                                idx === 0
                                  ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-yellow-950'
                                  : idx === 1
                                  ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-700'
                                  : idx === 2
                                  ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            `}
                          >
                            {idx + 1}
                          </div>

                        </td>

                        {/* Club */}
                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            {idx < 3 && (
                              <span className="text-xl">
                                {idx === 0
                                  ? '🥇'
                                  : idx === 1
                                  ? '🥈'
                                  : '🥉'}
                              </span>
                            )}

                            <div
                              className={`
                                font-bold
                                ${
                                  idx === 0
                                    ? 'text-slate-900'
                                    : 'text-slate-800'
                                }
                              `}
                            >
                              {s.club.name}
                            </div>

                          </div>

                        </td>

                        {/* Gold */}
                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex items-center justify-center min-w-10 px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold">

                            <Medal className="w-4 h-4 mr-1" />

                            {s.gold}

                          </span>

                        </td>

                        {/* Silver */}
                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex items-center justify-center min-w-10 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold">

                            <Medal className="w-4 h-4 mr-1" />

                            {s.silver}

                          </span>

                        </td>

                        {/* Bronze */}
                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex items-center justify-center min-w-10 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-bold">

                            <Medal className="w-4 h-4 mr-1" />

                            {s.bronze}

                          </span>

                        </td>

                        {/* Points */}
                        <td className="px-5 py-4 text-right">

                          <div className="inline-flex items-center gap-1.5">

                            <span className="text-xl font-black text-cyan-600">
                              {s.points}
                            </span>

                            <span className="text-xs font-semibold text-slate-400">
                              pts
                            </span>

                          </div>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </section>

            {/* =================================================
                POINT SYSTEM RULES
            ================================================== */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden">

              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 sm:px-7 py-5">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-300" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      Championship Point System
                    </h3>

                    <p className="text-xs text-slate-400">
                      How club championship points are awarded
                    </p>
                  </div>

                </div>

              </div>

              <div className="p-5 sm:p-7">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">

                  {/* Gold */}
                  <div className="group bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg">

                    <div className="text-4xl mb-2">
                      🥇
                    </div>

                    <div className="font-black text-yellow-800">
                      Gold
                    </div>

                    <div className="text-2xl font-black text-yellow-700 mt-1">
                      5 Points
                    </div>

                  </div>

                  {/* Silver */}
                  <div className="group bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-200 rounded-2xl p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg">

                    <div className="text-4xl mb-2">
                      🥈
                    </div>

                    <div className="font-black text-slate-700">
                      Silver
                    </div>

                    <div className="text-2xl font-black text-slate-600 mt-1">
                      3 Points
                    </div>

                  </div>

                  {/* Bronze */}
                  <div className="group bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg">

                    <div className="text-4xl mb-2">
                      🥉
                    </div>

                    <div className="font-black text-orange-800">
                      Bronze
                    </div>

                    <div className="text-2xl font-black text-orange-700 mt-1">
                      1 Point
                    </div>

                  </div>

                </div>

                <div className="grid gap-3 text-sm">

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">01</span>
                    <p className="text-slate-600">
                      Gold medal = <strong className="text-slate-800">5 points</strong>
                    </p>
                  </div>

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">02</span>
                    <p className="text-slate-600">
                      Silver medal = <strong className="text-slate-800">3 points</strong>
                    </p>
                  </div>

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">03</span>
                    <p className="text-slate-600">
                      Bronze medal = <strong className="text-slate-800">1 point</strong>
                    </p>
                  </div>

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">04</span>
                    <p className="text-slate-600">
                      Under-10 age group results receive
                      <strong className="text-slate-800"> 0 championship points</strong>.
                    </p>
                  </div>

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">05</span>
                    <p className="text-slate-600">
                      Only Gold, Silver and Bronze medal
                      results contribute to the club championship total.
                    </p>
                  </div>

                  <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50">
                    <span className="font-black text-cyan-600">06</span>
                    <p className="text-slate-600">
                      Clubs are ranked first by total championship points.
                      If points are equal, the number of Gold medals is used
                      as the first tie-breaker, followed by Silver and then Bronze medals.
                    </p>
                  </div>

                </div>

                <div className="mt-6 pt-5 border-t border-slate-200">

                  <div className="flex items-start gap-3 bg-cyan-50 border border-cyan-100 rounded-2xl p-4">

                    <div className="text-xl">
                      ℹ️
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Under-10 results remain part of the competition results,
                      but they do not contribute to the Club Championship
                      standings.
                    </p>

                  </div>

                </div>

              </div>

            </section>

          </div>
        )}

      </div>
    </div>
  );
}
