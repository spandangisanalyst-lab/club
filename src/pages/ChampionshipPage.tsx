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
    <div>

      {/* ======================================================
          HEADER
      ======================================================= */}
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">

          <Medal className="w-12 h-12 text-cyan-400 mx-auto mb-4" />

          <h1 className="text-4xl font-bold text-white mb-2">
            Club Championship
          </h1>

          <p className="text-slate-400">
            Overall club standings based on championship points
          </p>

        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">

        {loading ? (

          /* ==================================================
             LOADING
          =================================================== */
          <div className="flex items-center justify-center py-20">

            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />

          </div>

        ) : standings.length === 0 ? (

          /* ==================================================
             NO STANDINGS
          =================================================== */
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">

            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />

            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Standings Yet
            </h3>

            <p className="text-slate-500">
              Championship standings will appear here once
              results are recorded.
            </p>

          </div>

        ) : (

          <div className="space-y-6">

            {/* =================================================
                PODIUM
            ================================================== */}
            {standings.length >= 1 && (

              <div className="grid grid-cols-3 gap-4 mb-8">

                {[1, 0, 2].map((idx) => {

                  const s = standings[idx];

                  if (!s) {
                    return (
                      <div key={idx} />
                    );
                  }

                  const position = idx + 1;

                  const heights = [
                    'h-32',
                    'h-40',
                    'h-28',
                  ];

                  const colors = [
                    'from-gray-300 to-gray-400',
                    'from-yellow-300 to-yellow-500',
                    'from-orange-300 to-orange-500',
                  ];

                  const textColors = [
                    'text-gray-700',
                    'text-yellow-700',
                    'text-orange-700',
                  ];

                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center"
                    >

                      <div className="text-center mb-3">

                        <div
                          className={`
                            w-16 h-16
                            rounded-full
                            bg-gradient-to-br
                            ${colors[position - 1]}
                            flex items-center
                            justify-center
                            mb-2
                            shadow-lg
                          `}
                        >
                          <span
                            className={`
                              text-2xl
                              font-bold
                              ${textColors[position - 1]}
                            `}
                          >
                            {position}
                          </span>
                        </div>

                        <div className="font-bold text-slate-800 text-sm truncate max-w-[120px]">
                          {s.club.name}
                        </div>

                        <div className="text-2xl font-bold text-cyan-600">
                          {s.points}
                        </div>

                        <div className="text-xs text-slate-500">
                          points
                        </div>

                      </div>

                      <div
                        className={`
                          w-full
                          ${heights[position - 1]}
                          bg-gradient-to-t
                          ${colors[position - 1]}
                          rounded-t-xl
                          flex items-end
                          justify-center
                          pb-2
                        `}
                      >
                        <span className="text-white font-bold text-lg">
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
            )}

            {/* =================================================
                FULL STANDINGS
            ================================================== */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">

              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">

                <h2 className="text-lg font-bold text-white">
                  Full Standings
                </h2>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>

                    <tr className="bg-slate-50 border-b border-slate-200">

                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Rank
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Club
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        Gold
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        Silver
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        Bronze
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        Points
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {standings.map((s, idx) => (

                      <tr
                        key={s.club.id}
                        className="hover:bg-slate-50 transition-colors"
                      >

                        <td className="px-4 py-3">

                          <div
                            className={`
                              w-8 h-8
                              rounded-full
                              flex items-center
                              justify-center
                              font-bold
                              text-sm
                              ${
                                idx === 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : idx === 1
                                  ? 'bg-gray-200 text-gray-700'
                                  : idx === 2
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            `}
                          >
                            {idx + 1}
                          </div>

                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {s.club.name}
                        </td>

                        <td className="px-4 py-3 text-center">

                          <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">

                            <Medal className="w-4 h-4" />

                            {s.gold}

                          </span>

                        </td>

                        <td className="px-4 py-3 text-center">

                          <span className="inline-flex items-center gap-1 text-gray-500 font-semibold">

                            <Medal className="w-4 h-4" />

                            {s.silver}

                          </span>

                        </td>

                        <td className="px-4 py-3 text-center">

                          <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">

                            <Medal className="w-4 h-4" />

                            {s.bronze}

                          </span>

                        </td>

                        <td className="px-4 py-3 text-right font-bold text-cyan-600 text-lg">
                          {s.points}
                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

            {/* =================================================
                POINT SYSTEM RULES
            ================================================== */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">

              <h3 className="text-lg font-bold text-slate-800 mb-4">
                🏆 Championship Point System
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">

                {/* Gold */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">

                  <div className="text-3xl mb-1">
                    🥇
                  </div>

                  <div className="font-bold text-yellow-700">
                    Gold
                  </div>

                  <div className="text-2xl font-bold text-yellow-700">
                    5 Points
                  </div>

                </div>

                {/* Silver */}
                <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-center">

                  <div className="text-3xl mb-1">
                    🥈
                  </div>

                  <div className="font-bold text-gray-700">
                    Silver
                  </div>

                  <div className="text-2xl font-bold text-gray-700">
                    3 Points
                  </div>

                </div>

                {/* Bronze */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">

                  <div className="text-3xl mb-1">
                    🥉
                  </div>

                  <div className="font-bold text-orange-700">
                    Bronze
                  </div>

                  <div className="text-2xl font-bold text-orange-700">
                    1 Point
                  </div>

                </div>

              </div>

              <div className="space-y-2 text-sm text-slate-600">

                <p>
                  <strong>1.</strong> Gold medal = <strong>5 points</strong>
                </p>

                <p>
                  <strong>2.</strong> Silver medal = <strong>3 points</strong>
                </p>

                <p>
                  <strong>3.</strong> Bronze medal = <strong>1 point</strong>
                </p>

                <p>
                  <strong>4.</strong> Under-10 age group results receive
                  <strong> 0 championship points</strong>.
                </p>

                <p>
                  <strong>5.</strong> Only Gold, Silver and Bronze medal
                  results contribute to the club championship total.
                </p>

                <p>
                  <strong>6.</strong> Clubs are ranked first by total
                  championship points. If points are equal, the number of
                  Gold medals is used as the first tie-breaker, followed by
                  Silver and then Bronze medals.
                </p>

              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-500 text-center">
                Under-10 results remain part of the competition results,
                but they do not contribute to the Club Championship
                standings.
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
