import { useState, useEffect } from 'react';
import { Medal, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
/* Convert Live Race Console result time to milliseconds */
const parseTimeToMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  const match = text.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = (match[3] || '0').padEnd(3, '0');

  return minutes * 60 * 1000 + seconds * 1000 + Number(fraction);
};

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

    const channel = supabase
      .channel('championship-standings-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'heat_entries',
        },
        () => {
          loadStandings();
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
          loadStandings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStandings = async () => {
    setLoading(true);

    try {
      /*
       * IMPORTANT:
       * This section intentionally follows ResultsPage's data pipeline.
       * Championship points are calculated from the SAME final results
       * that the public Results page displays.
       */

      // 1. Load ALL heat entries — exactly like ResultsPage.
      const { data: entries, error: entriesError } = await supabase
        .from('heat_entries')
        .select('*');

      if (entriesError) throw entriesError;

      if (!entries || entries.length === 0) {
        console.log('Championship: no heat_entries found');
        setStandings([]);
        return;
      }

      // 2. Load all heats used by those entries.
      const heatIds = [
        ...new Set(
          entries
            .map((entry: any) => entry.heat_id)
            .filter(Boolean)
        ),
      ];

      if (heatIds.length === 0) {
        console.log('Championship: no heat IDs found');
        setStandings([]);
        return;
      }

      const { data: heats, error: heatsError } = await supabase
        .from('heats')
        .select('*')
        .in('id', heatIds);

      if (heatsError) throw heatsError;

      if (!heats || heats.length === 0) {
        console.log('Championship: no heats found');
        setStandings([]);
        return;
      }

      // 3. EXACTLY like ResultsPage: only finished heats.
      const finishedHeatIds = new Set(
        heats
          .filter((heat: any) => heat.status === 'finished')
          .map((heat: any) => heat.id)
      );

      const finishedEntries = entries.filter((entry: any) =>
        finishedHeatIds.has(entry.heat_id)
      );

      if (finishedEntries.length === 0) {
        console.log('Championship: no finished entries', {
          totalEntries: entries.length,
          totalHeats: heats.length,
          finishedHeats: finishedHeatIds.size,
        });
        setStandings([]);
        return;
      }

      // 4. Participants — SAME as ResultsPage.
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

      if (participantsError) throw participantsError;

      // 5. Clubs — SAME relationship as ResultsPage:
      // participant.club_id -> clubs.id
      const clubIds = [
        ...new Set(
          (participants || [])
            .map((p: any) => p.club_id)
            .filter(Boolean)
        ),
      ];

      const { data: clubs, error: clubsError } =
        clubIds.length > 0
          ? await supabase
              .from('clubs')
              .select('*')
              .in('id', clubIds)
          : { data: [], error: null };

      if (clubsError) throw clubsError;

      // 6. Events — SAME as ResultsPage.
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

      if (eventsError) throw eventsError;

      const participantMap = new Map(
        (participants || []).map((p: any) => [p.id, p])
      );

      const clubMap = new Map(
        (clubs || []).map((c: any) => [c.id, c])
      );

      const heatMap = new Map(
        heats.map((h: any) => [h.id, h])
      );

      const eventMap = new Map(
        (events || []).map((e: any) => [e.id, e])
      );

      /*
       * 7. Build normalized result rows using EXACTLY the same
       * time fields as ResultsPage.
       */
      const normalizedRows: any[] = [];

      for (const rawEntry of finishedEntries as any[]) {
        const participant = participantMap.get(rawEntry.participant_id);
        const heat = heatMap.get(rawEntry.heat_id);
        const event = heat
          ? eventMap.get(heat.event_id)
          : undefined;

        if (!participant || !event) continue;

        const timeMs = parseTimeToMs(
          rawEntry.time ??
          rawEntry.finish_time ??
          rawEntry.finish_time_ms
        );

        // EXACTLY like ResultsPage: invalid finished time is ignored.
        if (timeMs === null || timeMs <= 0) continue;

        normalizedRows.push({
          rawEntry,
          participant,
          club: participant.club_id
            ? clubMap.get(participant.club_id) || null
            : null,
          event,
          timeMs,
        });
      }

      /*
       * 8. Group by EVENT, exactly like ResultsPage.
       * This prevents a swimmer's result in one event from affecting
       * the ranking of another event.
       */
      const grouped: Record<string, any[]> = {};

      for (const row of normalizedRows) {
        const eventId = String(row.event.id);

        if (!grouped[eventId]) {
          grouped[eventId] = [];
        }

        grouped[eventId].push(row);
      }

      /*
       * 9. Produce the FINAL result rows.
       *
       * Saved overall_rank is preferred.
       * If an event has no saved ranks, rank by finish time.
       *
       * Medal is ALWAYS determined from final rank when medal is absent.
       */
      const finalRows: any[] = [];

      Object.values(grouped).forEach((eventRows) => {
        eventRows.sort((a, b) => {
          const rankA = a.rawEntry.overall_rank;
          const rankB = b.rawEntry.overall_rank;

          if (
            rankA !== null &&
            rankA !== undefined &&
            rankB !== null &&
            rankB !== undefined
          ) {
            return Number(rankA) - Number(rankB);
          }

          return a.timeMs - b.timeMs;
        });

        const hasSavedRanks = eventRows.some(
          (row) =>
            row.rawEntry.overall_rank !== null &&
            row.rawEntry.overall_rank !== undefined
        );

        if (!hasSavedRanks) {
          eventRows.forEach((row, index) => {
            row.finalRank = index + 1;
          });
        } else {
          eventRows.forEach((row, index) => {
            row.finalRank =
              row.rawEntry.overall_rank !== null &&
              row.rawEntry.overall_rank !== undefined
                ? Number(row.rawEntry.overall_rank)
                : index + 1;
          });
        }

        eventRows.forEach((row) => {
          const rank = row.finalRank;

          /*
           * Prefer an explicitly saved medal ONLY when it is one of
           * the valid championship medals. Otherwise derive from rank.
           */
          let medal =
            row.rawEntry.medal === 'Gold' ||
            row.rawEntry.medal === 'Silver' ||
            row.rawEntry.medal === 'Bronze'
              ? row.rawEntry.medal
              : null;

          if (!medal) {
            medal =
              rank === 1
                ? 'Gold'
                : rank === 2
                ? 'Silver'
                : rank === 3
                ? 'Bronze'
                : null;
          }

          finalRows.push({
            ...row,
            medal,
          });
        });
      });

      /*
       * 10. Calculate club championship points from FINAL RESULTS.
       *
       * This is the critical part:
       * every Gold/Silver/Bronze displayed by ResultsPage contributes.
       */
      const clubPointsMap = new Map<string, ClubPoints>();

      for (const row of finalRows) {
        if (!row.participant?.club_id) continue;
        if (!row.club) continue;
        if (!row.medal) continue;

        // Under-10 receives zero championship points.
        if (isUnder10(row.event?.age_group)) continue;

        const clubId = String(row.participant.club_id);
        const club = row.club;

        if (!clubPointsMap.has(clubId)) {
          clubPointsMap.set(clubId, {
            club,
            points: 0,
            gold: 0,
            silver: 0,
            bronze: 0,
          });
        }

        const clubPoints = clubPointsMap.get(clubId)!;

        if (row.medal === 'Gold') {
          clubPoints.points += 5;
          clubPoints.gold += 1;
        } else if (row.medal === 'Silver') {
          clubPoints.points += 3;
          clubPoints.silver += 1;
        } else if (row.medal === 'Bronze') {
          clubPoints.points += 1;
          clubPoints.bronze += 1;
        }
      }

      const sorted = Array.from(clubPointsMap.values()).sort((a, b) => {
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

      console.log('CHAMPIONSHIP CALCULATION', {
        totalEntries: entries.length,
        finishedEntries: finishedEntries.length,
        normalizedResults: normalizedRows.length,
        finalResults: finalRows.length,
        clubs: sorted.length,
        standings: sorted.map((s) => ({
          club: s.club.name,
          points: s.points,
          gold: s.gold,
          silver: s.silver,
          bronze: s.bronze,
        })),
      });

      setStandings(sorted);
    } catch (error) {
      console.error('CHAMPIONSHIP PAGE ERROR:', error);
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
                      'h-48 sm:h-60',
                      'h-40 sm:h-48',
                      'h-32 sm:h-40',
                    ];

                    const colors = [
                      'from-yellow-200 via-yellow-400 to-amber-500',
                      'from-slate-300 via-gray-300 to-slate-400',
                      'from-orange-300 via-orange-400 to-orange-600',
                    ];

                    const textColors = [
                      'text-yellow-900',
                      'text-slate-700',
                      'text-orange-900',
                    ];

                    const podiumBorder = [
                      'border-yellow-300',
                      'border-slate-300',
                      'border-orange-300',
                    ];

                    const medals = ['🥇','🥈', '🥉'];

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
    FULL STANDINGS — SAME STYLE AS RESULTS PAGE
================================================== */}
<section className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">

  {/* Header — same style as Results */}
  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
        <Medal className="w-5 h-5 text-cyan-300" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-white">
          Full Standings
        </h2>

        <p className="text-xs text-slate-400">
          Club championship leaderboard
        </p>
      </div>
    </div>
  </div>

  {/* Club standings */}
  <div className="divide-y divide-slate-100">

    {standings.map((s, idx) => {

      const rank = idx + 1;

      return (
        <div
          key={s.club.id}
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
            {rank <= 3 ? (
              <span className="text-lg">
                {rank === 1
                  ? '🥇'
                  : rank === 2
                  ? '🥈'
                  : '🥉'}
              </span>
            ) : (
              rank
            )}
          </div>

          {/* Club */}
          <div className="flex-1 min-w-0">

            <div className="font-semibold text-slate-800 truncate">
              {s.club.name}
            </div>

            <div className="text-sm text-slate-500">
              Club Championship
            </div>

          </div>

          {/* Medal Summary */}
          <div className="hidden sm:flex items-center gap-4 mr-6">

            {/* Gold */}
            <div className="text-center">
              <div className="text-xs text-yellow-600 font-semibold">
                Gold
              </div>

              <div className="font-bold text-slate-800">
                {s.gold}
              </div>
            </div>

            {/* Silver */}
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">
                Silver
              </div>

              <div className="font-bold text-slate-800">
                {s.silver}
              </div>
            </div>

            {/* Bronze */}
            <div className="text-center">
              <div className="text-xs text-orange-600 font-semibold">
                Bronze
              </div>

              <div className="font-bold text-slate-800">
                {s.bronze}
              </div>
            </div>

          </div>

          {/* Points */}
          <div className="text-right">

            <div className="flex items-center gap-1.5 text-slate-800 font-mono font-semibold">
              <Trophy className="w-4 h-4 text-cyan-500" />

              {s.points}
              <span className="text-xs text-slate-400 font-sans">
                pts
              </span>
            </div>

            {/* Mobile medal summary */}
            <div className="sm:hidden text-xs text-slate-500 mt-1">
              🥇 {s.gold} &nbsp;
              🥈 {s.silver} &nbsp;
              🥉 {s.bronze}
            </div>

          </div>

        </div>
      );
    })}

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
