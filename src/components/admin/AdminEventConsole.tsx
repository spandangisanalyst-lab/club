import { useState, useEffect } from 'react';
import {
  Timer,
  Users,
  Flag,
  Play,
  Square,
  Award,
  Loader2,
  ArrowLeft,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SettingsMap } from '../../lib/types';

interface Props {
  settings: SettingsMap;
}

type Stage = 'setup' | 'attendance' | 'racing' | 'finished';

export default function AdminEventConsole({ settings }: Props) {
  const [stage, setStage] = useState<Stage>('setup');
  const [loading, setLoading] = useState(true);

  // DATABASE DATA
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [completedEvents, setCompletedEvents] = useState<any[]>([]);

  // EVENT SELECTION
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');

  // ATTENDANCE
  const [registeredSwimmers, setRegisteredSwimmers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  // RACING
  const [activeHeat, setActiveHeat] = useState(1);
  const [totalHeats, setTotalHeats] = useState(1);
  const [raceStatus, setRaceStatus] = useState<
    'idle' | 'running' | 'stopped'
  >('idle');
  const [activeLanes, setActiveLanes] = useState<any[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [laneResults, setLaneResults] = useState<Record<string, number>>({});
  const [isSavingHeat, setIsSavingHeat] = useState(false);

  // RESULTS
  const [finalResults, setFinalResults] = useState<any[]>([]);
  const [editResultModal, setEditResultModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editableResults, setEditableResults] = useState<any[]>([]);
  const [savingResults, setSavingResults] = useState(false);

  // LIVE TIMER
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (raceStatus === 'running' && startTime !== null) {
      interval = setInterval(() => {
        setCurrentTime(Date.now() - startTime);
      }, 10);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [raceStatus, startTime]);

  // FORMAT TIME
  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return '00:00.00';

    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor(ms / 60000);

    return `${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  // CONVERT TIME STRING TO MILLISECONDS
  const parseTimeToMs = (time: string): number => {
    if (!time) return Infinity;

    const value = String(time).trim();

    const match = value.match(/^(\d+):(\d{2})\.(\d{2})$/);

    if (!match) return Infinity;

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const centiseconds = Number(match[3]);

    return minutes * 60000 + seconds * 1000 + centiseconds * 10;
  };

  // LOAD DATA
  useEffect(() => {
    fetchData();
    fetchCompletedEvents();

    const channel = supabase
      .channel('live-race-console')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        () => {
          fetchData();
          fetchCompletedEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
// RACE TIMING IS LOCAL/MANUAL ONLY
  // FETCH MAIN DATA
  const fetchData = async () => {
    setLoading(true);

    try {
      const [
        eventsRes,
        participantsRes,
        clubsRes,
        registrationsRes,
      ] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('participants').select('*'),
        supabase.from('clubs').select('*'),
        supabase.from('registrations').select('*'),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (participantsRes.error) throw participantsRes.error;
      if (clubsRes.error) throw clubsRes.error;
      if (registrationsRes.error) throw registrationsRes.error;

      setAllEvents(eventsRes.data || []);
      setAllParticipants(participantsRes.data || []);
      setAllClubs(clubsRes.data || []);
      setAllRegistrations(registrationsRes.data || []);
    } catch (error) {
      console.error('Error fetching event data:', error);
    } finally {
      setLoading(false);
    }
  };

  // FETCH ONLY COMPLETED EVENTS
  const fetchCompletedEvents = async () => {
    try {
      const { data: heatsData, error } = await supabase
        .from('heats')
        .select('event_id, status, events(*)')
        .eq('status', 'finished');

      if (error) throw error;

      const uniqueEventsMap = new Map();

      (heatsData || []).forEach((h: any) => {
        if (h.events && !uniqueEventsMap.has(String(h.event_id))) {
          uniqueEventsMap.set(String(h.event_id), h.events);
        }
      });

      setCompletedEvents(Array.from(uniqueEventsMap.values()));
    } catch (error) {
      console.error('Error fetching completed events:', error);
    }
  };

  // SETUP EVENT
  const handleSetupComplete = () => {
    if (!selectedCategory || !selectedEventId) {
      alert('Please select both Category and Event');
      return;
    }

    setLoading(true);

    try {
      const selectedEvent = allEvents.find(
        (e) => String(e.id) === String(selectedEventId)
      );

      const eventName = String(
        selectedEvent?.event_name ||
          selectedEvent?.title ||
          selectedEvent?.name ||
          ''
      );

      const is1000m = eventName.includes('1000');

      const isMaleCategory =
        selectedCategory.toLowerCase().includes('boys') ||
        selectedCategory.toLowerCase().includes('men');

      let eventRegs: any[] = [];

      if (is1000m) {
        const genderStr = isMaleCategory ? 'Male' : 'Female';

        const matching1000mEvents = allEvents.filter(
          (e) =>
            String(
              e.event_name || e.title || e.name || ''
            ).includes('1000') &&
            String(e.gender || '').toLowerCase() ===
              genderStr.toLowerCase()
        );

        const matchingIds = matching1000mEvents.map((e) => String(e.id));

        eventRegs = allRegistrations.filter((r) =>
          matchingIds.includes(String(r.event_id))
        );
      } else {
        eventRegs = allRegistrations.filter(
          (r) => String(r.event_id) === String(selectedEventId)
        );
      }

      const swimmers = eventRegs
        .map((reg) => {
          const participant = allParticipants.find(
            (p) => String(p.id) === String(reg.participant_id)
          );

          if (!participant) return null;

          const pStatus = participant.status || 'approved';

          if (pStatus === 'pending') return null;

          const club = allClubs.find(
            (c) =>
              String(c.id) === String(reg.club_id) ||
              String(c.id) === String(participant.club_id)
          );

          return {
            id: participant.id,
            name:
              participant.name ||
              participant.full_name ||
              'Unknown Swimmer',
            club_id: club?.id || participant.club_id || null,
            club_name: club
              ? club.name || club.title
              : 'Unknown Club',
          };
        })
        .filter(Boolean);

      setRegisteredSwimmers(swimmers);

      const initialAttendance: Record<string, boolean> = {};

      swimmers.forEach((s: any) => {
        if (s) initialAttendance[s.id] = false;
      });

      setAttendance(initialAttendance);
      setStage('attendance');
    } catch (error) {
      console.error('Error processing registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // GENERATE HEATS
  const handleGenerateHeats = () => {
    const presentSwimmers = registeredSwimmers.filter(
      (p) => attendance[p.id]
    );

    if (presentSwimmers.length === 0) {
      alert('No swimmers marked as present!');
      return;
    }

    const calculatedHeats = Math.ceil(presentSwimmers.length / 8);

    setTotalHeats(calculatedHeats);
    setActiveHeat(1);
    setActiveLanes(presentSwimmers.slice(0, 8));

    setCurrentTime(0);
    setLaneResults({});
    setRaceStatus('idle');
    setStartTime(null);

    setStage('racing');
  };

// SIMPLE LOCAL TIMING
  const handleStartRace = () => {
    setStartTime(Date.now());
    setCurrentTime(0);
    setLaneResults({});
    setRaceStatus('running');
  };

  const handleStopRace = () => {
    if (startTime !== null) {
      setCurrentTime(Date.now() - startTime);
    }
    setRaceStatus('stopped');
  };

  const handleManualTimeChange = (
    participantId: string,
    value: string
  ) => {
    const ms = parseTimeToMs(value);

    if (Number.isFinite(ms)) {
      setLaneResults((prev) => ({
        ...prev,
        [participantId]: ms,
      }));
    } else if (value.trim() === '') {
      setLaneResults((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
    }
  };

  // FINISH LANE
  const handleFinishLane = (participantId: string) => {
    if (raceStatus !== 'running') return;

    const finishTime = currentTime;

    setLaneResults((prev) => {
      const updated = {
        ...prev,
        [participantId]: finishTime,
      };

      if (Object.keys(updated).length === activeLanes.length) {
        setRaceStatus('stopped');
      }

      return updated;
    });
  };

  // SAVE CURRENT HEAT
  const saveCurrentHeatToDB = async () => {
    try {
      const { data: existingHeat, error: existingHeatError } =
        await supabase
          .from('heats')
          .select('id')
          .eq('event_id', selectedEventId)
          .eq('heat_number', activeHeat)
          .maybeSingle();

      if (existingHeatError) {
        throw existingHeatError;
      }

      let heatId: string;

      if (existingHeat) {
        heatId = existingHeat.id;

        const { error: updateHeatError } = await supabase
          .from('heats')
          .update({
            status: 'finished',
          })
          .eq('id', heatId);

        if (updateHeatError) {
          throw updateHeatError;
        }
      } else {
        const { data: newHeat, error: heatError } =
          await supabase
            .from('heats')
            .insert([
              {
                event_id: selectedEventId,
                heat_number: activeHeat,
                status: 'finished',
              },
            ])
            .select('id')
            .single();

        if (heatError) {
          throw heatError;
        }

        heatId = newHeat.id;
      }

      const entriesPayload = activeLanes.map((p, index) => {
        const rawTime = laneResults[p.id] || 0;

        return {
          heat_id: heatId,
          participant_id: p.id,
          lane: index + 1,
          time: formatTime(rawTime),
        };
      });

      const {
        data: existingEntries,
        error: entriesCheckError,
      } = await supabase
        .from('heat_entries')
        .select('id, participant_id')
        .eq('heat_id', heatId);

      if (entriesCheckError) {
        throw entriesCheckError;
      }

      for (const entry of entriesPayload) {
        const existingEntry = existingEntries?.find(
          (item) =>
            String(item.participant_id) ===
            String(entry.participant_id)
        );

        if (existingEntry) {
          const { error: updateError } = await supabase
            .from('heat_entries')
            .update({
              lane: entry.lane,
              time: entry.time,
            })
            .eq('id', existingEntry.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase
            .from('heat_entries')
            .insert([entry]);

          if (insertError) {
            throw insertError;
          }
        }
      }

      console.log(
        `Heat ${activeHeat} saved successfully.`
      );
    } catch (error: any) {
      console.error('Error saving heat to DB:', error);

      alert(
        `Failed to save heat data: ${
          error?.message || 'Unknown error'
        }`
      );

      throw error;
    }
  };

  // NEXT HEAT
  const handleNextHeat = async () => {
    if (isSavingHeat) return;

    try {
      setIsSavingHeat(true);

      if (raceStatus !== 'stopped') {
        alert('Please stop/finish the current heat first.');
        return;
      }

      await saveCurrentHeatToDB();

      const presentSwimmers = registeredSwimmers.filter(
        (p) => attendance[p.id]
      );

      const nextHeat = activeHeat + 1;
      const startIndex = (nextHeat - 1) * 8;
      const nextLanes = presentSwimmers.slice(
        startIndex,
        startIndex + 8
      );

      if (nextLanes.length === 0) {
        alert('No swimmers available for the next heat.');
        return;
      }

      setActiveHeat(nextHeat);
      setActiveLanes(nextLanes);

      setCurrentTime(0);
      setLaneResults({});
      setRaceStatus('idle');
      setStartTime(null);
    } catch (error) {
      console.error('Error moving to next heat:', error);
    } finally {
      setIsSavingHeat(false);
    }
  };

  // CALCULATE FINAL RESULTS
  const calculateFinalResults = async (eventId: string) => {
    try {
      const { data: heatsData, error: heatsError } =
        await supabase
          .from('heats')
          .select('id, heat_number, status')
          .eq('event_id', eventId)
          .eq('status', 'finished');

      if (heatsError) {
        throw heatsError;
      }

      if (!heatsData || heatsData.length === 0) {
        return [];
      }

      const heatIds = heatsData.map((h) => h.id);

      const { data: entriesData, error: entriesError } =
        await supabase
          .from('heat_entries')
          .select('*')
          .in('heat_id', heatIds);

      if (entriesError) {
        throw entriesError;
      }

      const resultsMap = new Map<string, any>();

      (entriesData || []).forEach((entry: any) => {
        const participant = allParticipants.find(
          (p) =>
            String(p.id) ===
            String(entry.participant_id)
        );

        if (!participant) return;

        const timeMs = parseTimeToMs(entry.time);

        if (!Number.isFinite(timeMs) || timeMs <= 0) {
          return;
        }

        const club = allClubs.find(
          (c) =>
            String(c.id) ===
              String(participant.club_id) ||
            String(c.id) === String(entry.club_id)
        );

        const result = {
          participant_id: participant.id,
          participant_name:
            participant.name ||
            participant.full_name ||
            'Unknown Swimmer',
          club_id:
            club?.id ||
            participant.club_id ||
            null,
          club_name: club
            ? club.name || club.title
            : 'Unknown Club',
          time: entry.time,
          time_ms: timeMs,
          heat_id: entry.heat_id,
          lane: entry.lane,
        };

        const existing = resultsMap.get(
          String(participant.id)
        );

        // Keep the swimmer's fastest time across ALL heats
        if (!existing || timeMs < existing.time_ms) {
          resultsMap.set(
            String(participant.id),
            result
          );
        }
      });

      const sortedResults = Array.from(
        resultsMap.values()
      ).sort((a, b) => a.time_ms - b.time_ms);

      // Assign actual positions
      const positionedResults = sortedResults.map(
        (result, index) => ({
          ...result,
          position: index + 1,
        })
      );

      return positionedResults;
    } catch (error) {
      console.error(
        'Error calculating final results:',
        error
      );

      throw error;
    }
  };

  // FINISH EVENT
  const handleFinishEvent = async () => {
    if (isSavingHeat) return;

    try {
      setIsSavingHeat(true);

      if (raceStatus !== 'stopped') {
        alert(
          'Please stop/finish the current heat before completing the event.'
        );
        return;
      }

      // Save final heat
      await saveCurrentHeatToDB();

      // Calculate standings
      const finalStandings =
        await calculateFinalResults(
          selectedEventId
        );

      setFinalResults(finalStandings);

      // Refresh completed events
      await fetchCompletedEvents();

      setStage('finished');
    } catch (err: any) {
      console.error(
        'Error finishing event:',
        err
      );

      alert(
        `Failed to complete event: ${
          err?.message || 'Unknown error'
        }`
      );
    } finally {
      setIsSavingHeat(false);
    }
  };

  // DOWNLOAD WINNING CSV
  const downloadWinningCSV = () => {
    if (!finalResults || finalResults.length === 0) {
      alert('No winning results available.');
      return;
    }

    const selectedEvent = allEvents.find(
      (e) =>
        String(e.id) ===
        String(selectedEventId)
    );

    const eventName =
      selectedEvent?.event_name ||
      selectedEvent?.title ||
      selectedEvent?.name ||
      'Event';

    const winners = finalResults.slice(0, 3);

    const pointsForPosition = (position: number) => {
      if (
        selectedCategory
          .toLowerCase()
          .includes('10')
      ) {
        return 0;
      }

      if (position === 1) return 5;
      if (position === 2) return 3;
      return 1;
    };

    const headers = [
      'Position',
      'Participant',
      'Club',
      'Time',
      'Points',
      'Event',
      'Category',
    ];

    const rows = winners.map((result: any) => [
      result.position,
      result.participant_name,
      result.club_name,
      result.time,
      pointsForPosition(result.position),
      eventName,
      selectedCategory,
    ]);

    const csvEscape = (value: any) => {
      const text = String(value ?? '');

      if (
        text.includes(',') ||
        text.includes('"') ||
        text.includes('\n')
      ) {
        return `"${text.replace(/"/g, '""')}"`;
      }

      return text;
    };

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row.map(csvEscape).join(',')
      )
      .join('\n');

    const blob = new Blob(
      [csvContent],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `${eventName.replace(
        /[^a-z0-9]/gi,
        '_'
      )}_Winners.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // EDIT RESULTS
  const handleOpenEditModal = async (
    eventObj: any
  ) => {
    setEditingEvent(eventObj);
    setEditableResults([]);
    setEditResultModal(true);

    try {
      const { data: heatsData } =
        await supabase
          .from('heats')
          .select(
            'id, heat_number'
          )
          .eq(
            'event_id',
            eventObj.id
          );

      if (
        !heatsData ||
        heatsData.length === 0
      ) {
        return;
      }

      const heatIds =
        heatsData.map(
          (h) => h.id
        );

      const {
        data: entriesData,
      } = await supabase
        .from('heat_entries')
        .select('*')
        .in(
          'heat_id',
          heatIds
        );

      const mappedEntries =
        (entriesData || []).map(
          (entry) => {
            const p =
              allParticipants.find(
                (p) =>
                  String(p.id) ===
                  String(
                    entry.participant_id
                  )
              );

            return {
              ...entry,
              participant_name: p
                ? p.name ||
                  p.full_name
                : 'Unknown',
            };
          }
        );

      mappedEntries.sort(
        (a, b) => {
          if (
            a.heat_id !==
            b.heat_id
          ) {
            return a.heat_id >
              b.heat_id
              ? 1
              : -1;
          }

          return (
            (a.lane || 0) -
            (b.lane || 0)
          );
        }
      );

      setEditableResults(
        mappedEntries
      );
    } catch (error) {
      console.error(
        'Error fetching results for edit:',
        error
      );
    }
  };

  // SAVE EDITED RESULTS
  const handleSaveEditedResults =
    async () => {
      setSavingResults(true);

      try {
        for (const result of editableResults) {
          const { error } =
            await supabase
              .from('heat_entries')
              .update({
                time: result.time,
              })
              .eq(
                'id',
                result.id
              );

          if (error) {
            throw error;
          }
        }

        setEditResultModal(false);

        alert(
          'Results successfully updated and synchronized globally.'
        );

        await fetchCompletedEvents();
      } catch (error) {
        console.error(
          'Error saving results:',
          error
        );

        alert(
          'Failed to save results.'
        );
      } finally {
        setSavingResults(false);
      }
    };

  // DELETE EVENT RESULTS
  const handleDeleteEventResults =
    async (
      eventId: string
    ) => {
      if (
        !window.confirm(
          'WARNING: This will permanently delete ALL heats and times for this event. Are you sure?'
        )
      ) {
        return;
      }

      try {
        const {
          data: heatsData,
        } = await supabase
          .from('heats')
          .select('id')
          .eq(
            'event_id',
            eventId
          );

        const heatIds =
          (heatsData || []).map(
            (h) => h.id
          );

        if (heatIds.length > 0) {
          const {
            error:
              entriesDeleteError,
          } = await supabase
            .from('heat_entries')
            .delete()
            .in(
              'heat_id',
              heatIds
            );

          if (
            entriesDeleteError
          ) {
            throw entriesDeleteError;
          }

          const {
            error:
              heatsDeleteError,
          } = await supabase
            .from('heats')
            .delete()
            .eq(
              'event_id',
              eventId
            );

          if (
            heatsDeleteError
          ) {
            throw heatsDeleteError;
          }
        }

        await fetchCompletedEvents();
      } catch (error) {
        console.error(
          'Error deleting results:',
          error
        );

        alert(
          'Failed to delete results.'
        );
      }
    };

  // EVENT FILTERS
  const uniqueCategories =
    Array.from(
      new Set(
        allEvents
          .map(
            (e) =>
              e.category
          )
          .filter(Boolean)
      )
    );

  const isMale =
    selectedCategory
      .toLowerCase()
      .includes('boys') ||
    selectedCategory
      .toLowerCase()
      .includes('men');

  const filteredEvents =
    allEvents.filter((e) => {
      const is1000m =
        String(
          e.event_name ||
            e.title ||
            e.name ||
            ''
        ).includes('1000');

      if (is1000m) {
        return (
          selectedCategory ===
          (isMale
            ? 'Men'
            : 'Women')
        );
      }

      return (
        e.category ===
        selectedCategory
      );
    });

  if (
    loading &&
    stage === 'setup'
  ) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <Timer className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Live Race Console
          </h2>

          <p className="text-slate-500 text-sm">
            Olympic standard event management and live timing.
          </p>
        </div>
      </div>

      {/* PROGRESS */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />

        {[
          'setup',
          'attendance',
          'racing',
          'finished',
        ].map((s, i) => (
          <div
            key={s}
            className={`flex flex-col items-center gap-2 bg-slate-100 px-4 ${
              stage === s
                ? 'text-cyan-600'
                : 'text-slate-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                stage === s
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-200'
              }`}
            >
              {i + 1}
            </div>

            <span className="text-xs font-semibold uppercase tracking-wider">
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* SETUP */}
      {stage === 'setup' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Flag className="w-5 h-5 text-cyan-600" />
              Select Event
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category (Age & Gender)
                </label>

                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(
                      e.target.value
                    );
                    setSelectedEventId('');
                  }}
                  className="w-full p-3 border border-slate-300 rounded-lg"
                >
                  <option value="">
                    -- Select Category --
                  </option>

                  {uniqueCategories.map(
                    (cat) => (
                      <option
                        key={
                          cat as string
                        }
                        value={
                          cat as string
                        }
                      >
                        {cat as string}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Event Type
                </label>

                <select
                  value={selectedEventId}
                  onChange={(e) =>
                    setSelectedEventId(
                      e.target.value
                    )
                  }
                  disabled={
                    !selectedCategory
                  }
                  className="w-full p-3 border border-slate-300 rounded-lg disabled:bg-slate-100"
                >
                  <option value="">
                    -- Select Event --
                  </option>

                  {filteredEvents.map(
                    (e) => {
                      const is1000 =
                        String(
                          e.event_name ||
                            e.title ||
                            e.name ||
                            ''
                        ).includes(
                          '1000'
                        );

                      return (
                        <option
                          key={e.id}
                          value={e.id}
                        >
                          {e.event_name ||
                            e.title ||
                            e.name}{' '}
                          {is1000
                            ? '(Open)'
                            : ''}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>
            </div>

            <button
              onClick={
                handleSetupComplete
              }
              className="w-full py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700"
            >
              Proceed to Attendance
            </button>
          </div>

          {/* COMPLETED EVENTS */}
          <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-600" />
              Manage Completed Results
            </h3>

            <p className="text-sm text-slate-500 mb-6">
              View, edit, or delete the final results for races that have already been processed.
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      Event Details
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {completedEvents.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No completed events found in the database.
                      </td>
                    </tr>
                  ) : (
                    completedEvents.map(
                      (ev: any) => (
                        <tr
                          key={ev.id}
                          className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900">
                              {ev.event_name ||
                                ev.title ||
                                ev.name}
                            </div>

                            <div className="text-xs text-slate-500">
                              {ev.category}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold shadow-sm">
                              Completed
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() =>
                                handleOpenEditModal(
                                  ev
                                )
                              }
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Edit Results"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() =>
                                handleDeleteEventResults(
                                  ev.id
                                )
                              }
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete Results"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* EDIT MODAL */}
      {editResultModal &&
        editingEvent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Edit Real-time Results
                  </h3>

                  <p className="text-xs text-slate-500">
                    {editingEvent.event_name ||
                      editingEvent.title ||
                      editingEvent.name}{' '}
                    (
                    {
                      editingEvent.category
                    }
                    )
                  </p>
                </div>

                <button
                  onClick={() =>
                    setEditResultModal(
                      false
                    )
                  }
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-3">
                {editableResults.length ===
                0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-600 mb-2" />
                    Loading swimmers...
                  </div>
                ) : (
                  editableResults.map(
                    (
                      entry,
                      index
                    ) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 p-3 border border-slate-200 bg-slate-50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center shrink-0 text-sm">
                          L
                          {entry.lane ||
                            index + 1}
                        </div>

                        <div className="flex-1">
                          <div className="font-bold text-slate-900">
                            {
                              entry.participant_name
                            }
                          </div>
                        </div>

                        <input
                          type="text"
                          value={
                            entry.time ||
                            ''
                          }
                          onChange={(
                            e
                          ) => {
                            const newResults =
                              [
                                ...editableResults,
                              ];

                            newResults[
                              index
                            ].time =
                              e.target.value;

                            setEditableResults(
                              newResults
                            );
                          }}
                          placeholder="00:00.00"
                          className="w-28 p-2 border border-slate-300 rounded text-center font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    )
                  )
                )}
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-slate-200 shrink-0">
                <button
                  onClick={() =>
                    setEditResultModal(
                      false
                    )
                  }
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleSaveEditedResults
                  }
                  disabled={
                    savingResults ||
                    editableResults.length ===
                      0
                  }
                  className="px-5 py-2.5 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {savingResults ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}

                  Save &
                  Synchronize
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ATTENDANCE */}
      {stage === 'attendance' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setStage('setup')
                }
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title="Back to Setup"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600" />
                Mark Attendance
              </h3>
            </div>

            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
              {selectedCategory}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
            </div>
          ) : registeredSwimmers.length ===
            0 ? (
            <div className="text-center py-8 text-slate-500">
              No approved participants are registered for this event.
            </div>
          ) : (
            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto pr-2">
              {registeredSwimmers.map(
                (s) => (
                  <label
                    key={s.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {s.name}
                      </div>

                      <div className="text-xs text-slate-500">
                        {s.club_name}
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-cyan-600 rounded border-slate-300"
                      checked={
                        attendance[
                          s.id
                        ] || false
                      }
                      onChange={(e) =>
                        setAttendance({
                          ...attendance,
                          [s.id]:
                            e.target
                              .checked,
                        })
                      }
                    />
                  </label>
                )
              )}
            </div>
          )}

          <button
            onClick={
              handleGenerateHeats
            }
            disabled={
              loading ||
              registeredSwimmers.length ===
                0
            }
            className="w-full py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 disabled:opacity-50"
          >
            Generate Heats & Lanes
          </button>
        </div>
      )}

      {/* RACING */}
      {stage === 'racing' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setStage(
                    'attendance'
                  )
                }
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title="Back to Attendance"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Timer className="w-6 h-6 text-red-500" />

                  {raceStatus ===
                    'running' ||
                  raceStatus ===
                    'stopped'
                    ? formatTime(
                        currentTime
                      )
                    : '00:00.00'}
                </h3>

                <p className="text-slate-500 text-sm mt-1">
                  {selectedCategory}{' '}
                  (Heat{' '}
                  {activeHeat} of{' '}
                  {totalHeats})
                </p>
              </div>
            </div>

            <div className="space-x-2">
              {raceStatus ===
                'idle' && (
                <button
                  onClick={
                    handleStartRace
                  }
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Race
                </button>
              )}

              {raceStatus ===
                'running' && (
                <button
                  onClick={
                    handleStopRace
                  }
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop Heat
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {activeLanes.map(
              (p, index) => {
                const isFinished =
                  laneResults[
                    p.id
                  ] !==
                  undefined;

                const displayTime =
                  isFinished
                    ? formatTime(
                        laneResults[
                          p.id
                        ]
                      )
                    : '';

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center shrink-0">
                      L{index + 1}
                    </div>

                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        {p.name}
                      </div>

                      <div className="text-xs text-slate-500">
                        {p.club_name}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={displayTime}
                      onChange={(e) =>
                        handleManualTimeChange(
                          p.id,
                          e.target.value
                        )
                      }
                      placeholder="00:00.00"
                      className="w-28 p-2 border border-slate-300 rounded text-center font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                );
              }
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            {activeHeat <
            totalHeats ? (
              <button
                onClick={
                  handleNextHeat
                }
                disabled={
                  isSavingHeat
                }
                className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingHeat && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Next Heat →
              </button>
            ) : (
              <button
                onClick={
                  handleFinishEvent
                }
                disabled={
                  isSavingHeat
                }
                className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingHeat && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Complete Event &
                Calculate Points
              </button>
            )}
          </div>
        </div>
      )}

      {/* FINISHED */}
      {stage === 'finished' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-bold mb-2">
              Event Completed
            </h3>

            <p className="text-slate-500">
              Final results calculated across all heats.
            </p>
          </div>

          {/* SUMMARY */}
          <div className="max-w-3xl mx-auto space-y-3 mb-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h4 className="font-bold text-slate-900">
                Summary — Winning Positions
              </h4>

              <button
                onClick={
                  downloadWinningCSV
                }
                disabled={
                  finalResults.length ===
                  0
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Winning CSV
              </button>
            </div>

            {finalResults.length ===
            0 ? (
              <div className="p-4 bg-slate-50 text-center text-slate-500 rounded-lg">
                No valid times recorded for this event.
              </div>
            ) : (
              [0, 1, 2].map(
                (index) => {
                  const res =
                    finalResults[
                      index
                    ];

                  const position =
                    index + 1;

                  const rankLabels =
                    [
                      '1st Place',
                      '2nd Place',
                      '3rd Place',
                    ];

                  const rankColors =
                    [
                      'text-yellow-600',
                      'text-slate-500',
                      'text-orange-700',
                    ];

                  const points =
                    selectedCategory
                      .includes('10')
                      ? 0
                      : position ===
                        1
                      ? 5
                      : position ===
                        2
                      ? 3
                      : 1;

                  return (
                    <div
                      key={
                        position
                      }
                      className={`flex justify-between items-center p-4 bg-white border-2 rounded-xl shadow-sm ${
                        position ===
                        1
                          ? 'border-yellow-300'
                          : position ===
                            2
                          ? 'border-slate-300'
                          : 'border-orange-300'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* POSITION */}
                        <div className="w-32 shrink-0">
                          <div
                            className={`${rankColors[index]} font-bold text-lg`}
                          >
                            Position{' '}
                            {position}
                          </div>

                          <div className="text-xs text-slate-400 font-semibold uppercase">
                            {
                              rankLabels[
                                index
                              ]
                            }
                          </div>
                        </div>

                        {res ? (
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-lg truncate">
                              {
                                res.participant_name
                              }
                            </div>

                            <div className="text-sm text-slate-500 truncate">
                              {
                                res.club_name
                              }
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">
                            No result
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0 ml-4">
                        {res ? (
                          <>
                            <div className="font-mono font-bold text-slate-900 text-xl">
                              {
                                res.time
                              }
                            </div>

                            <div className="text-sm font-bold text-cyan-600">
                              {points}{' '}
                              pts
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-400">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )
            )}

            {selectedCategory.includes(
              '10'
            ) && (
              <div className="mt-4 text-center text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg">
                * Under-10 group yields 0 points for club standings.
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                setStage('setup');
                setSelectedCategory('');
                setSelectedEventId('');
                setAttendance({});
                setRegisteredSwimmers([]);
                setFinalResults([]);
                setActiveHeat(1);
                setTotalHeats(1);
                setActiveLanes([]);
                setLaneResults({});
                setCurrentTime(0);
                setRaceStatus('idle');
                setStartTime(null);
              }}
              className="px-8 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700"
            >
              Start Next Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
