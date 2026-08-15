import { useState, useEffect, useRef, useMemo } from 'react';
import { Timer, Play, Square, RotateCcw, Loader2, Radio, Clock, Flag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent, Heat, HeatEntry, Participant, Club, RaceState } from '../../lib/types';
import { formatTime, cn } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

export default function AdminTimer({ settings }: Props) {
  const { events } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [heats, setHeats] = useState<Heat[]>([]);
  const [selectedHeatId, setSelectedHeatId] = useState('');
  const [entries, setEntries] = useState<HeatEntry[]>([]);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [clubs, setClubs] = useState<Map<string, Club>>(new Map());
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])), [events]);
  const selectedEvent = selectedEventId ? eventMap.get(selectedEventId) : null;
  const selectedHeat = heats.find((h) => h.id === selectedHeatId) || null;

  // Realtime subscription for race state
  useEffect(() => {
    if (!selectedHeatId) return;
    const channel = supabase
      .channel(`timer-${selectedHeatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'race_state', filter: `heat_id=eq.${selectedHeatId}` }, (payload) => {
        if (payload.new) setRaceState(payload.new as RaceState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heat_entries', filter: `heat_id=eq.${selectedHeatId}` }, () => {
        loadEntries(selectedHeatId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedHeatId]);

  // Load race state when heat changes
  useEffect(() => {
    if (!selectedHeatId) { setRaceState(null); return; }
    (async () => {
      const { data } = await supabase.from('race_state').select('*').eq('heat_id', selectedHeatId).maybeSingle();
      setRaceState(data as RaceState | null);
      await loadEntries(selectedHeatId);
    })();
  }, [selectedHeatId]);

  // Tick timer locally based on race_state start_time
  useEffect(() => {
    if (!raceState || raceState.status !== 'running' || !raceState.start_time) {
      setElapsed(0);
      return;
    }
    const startTime = new Date(raceState.start_time).getTime();
    const update = () => setElapsed(Date.now() - startTime);
    update();
    const interval = setInterval(update, 10); // 10ms precision
    return () => clearInterval(interval);
  }, [raceState]);

  // Load heats when event changes
  useEffect(() => {
    if (!selectedEventId) { setHeats([]); setSelectedHeatId(''); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('heats').select('*').eq('event_id', selectedEventId).order('heat_number', { ascending: true });
      setHeats((data || []) as Heat[]);
      setSelectedHeatId('');
      setLoading(false);
    })();
  }, [selectedEventId]);

  const loadEntries = async (heatId: string) => {
    const { data: e } = await supabase.from('heat_entries').select('*').eq('heat_id', heatId).eq('present', true).order('lane_number', { ascending: true, nullsFirst: false });
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
  };

  const startRace = async () => {
    if (!selectedHeatId) return;
    setSyncing(true);
    const startTime = new Date().toISOString();
    // Upsert race state
    const { data: existing } = await supabase.from('race_state').select('id').eq('heat_id', selectedHeatId).maybeSingle();
    if (existing) {
      await supabase.from('race_state').update({ status: 'running', start_time: startTime, updated_at: new Date().toISOString() }).eq('heat_id', selectedHeatId);
    } else {
      await supabase.from('race_state').insert({ heat_id: selectedHeatId, status: 'running', start_time: startTime });
    }
    await supabase.from('heats').update({ status: 'racing' }).eq('id', selectedHeatId);
    setSyncing(false);
  };

  const stopRace = async () => {
    if (!selectedHeatId) return;
    setSyncing(true);
    await supabase.from('race_state').update({ status: 'finished', updated_at: new Date().toISOString() }).eq('heat_id', selectedHeatId);
    await supabase.from('heats').update({ status: 'finished' }).eq('id', selectedHeatId);
    setSyncing(false);
  };

  const resetRace = async () => {
    if (!selectedHeatId) return;
    if (!confirm('Reset this race? All timing data for this heat will be cleared.')) return;
    setSyncing(true);
    await supabase.from('race_state').update({ status: 'idle', start_time: null, updated_at: new Date().toISOString() }).eq('heat_id', selectedHeatId);
    await supabase.from('heats').update({ status: 'lanes_assigned' }).eq('id', selectedHeatId);
    // Clear finish times
    await supabase.from('heat_entries').update({ finish_time_ms: null, finish_position: null }).eq('heat_id', selectedHeatId);
    await loadEntries(selectedHeatId);
    setSyncing(false);
  };

  const recordFinish = async (entry: HeatEntry) => {
    if (!raceState || raceState.status !== 'running' || !raceState.start_time) return;
    const startTime = new Date(raceState.start_time).getTime();
    const finishTime = Date.now() - startTime;
    // Count how many already finished to determine position
    const finishedCount = entries.filter((e) => e.finish_time_ms !== null).length;
    await supabase.from('heat_entries').update({
      finish_time_ms: finishTime,
      finish_position: finishedCount + 1,
    }).eq('id', entry.id);
    // The realtime subscription will reload entries
    await loadEntries(selectedHeatId);
  };

  const isRunning = raceState?.status === 'running';
  const isFinished = raceState?.status === 'finished';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Live Timer</h1>
        <p className="text-slate-500 mt-1">Real-time race timing synced across all devices</p>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Radio className={cn('w-4 h-4', isRunning ? 'text-red-500 animate-pulse' : 'text-slate-400')} />
        <span className={isRunning ? 'text-red-600 font-semibold' : 'text-slate-500'}>
          {isRunning ? 'LIVE — Race in progress' : isFinished ? 'Race finished' : 'Idle'}
        </span>
      </div>

      {/* Event & Heat selectors */}
      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Event</label>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
              <option value="">Choose event...</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.category} - {ev.event_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Heat</label>
            <select value={selectedHeatId} onChange={(e) => setSelectedHeatId(e.target.value)} disabled={!selectedEventId || heats.length === 0} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white disabled:bg-slate-100">
              <option value="">Choose heat...</option>
              {heats.map((h) => <option key={h.id} value={h.id}>Heat {h.heat_number} ({h.status})</option>)}
            </select>
          </div>
        </div>
      </div>

      {!selectedHeatId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Timer className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Select an event and heat to start timing.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : (
        <div>
          {/* Timer display */}
          <div className="bg-slate-900 rounded-2xl shadow-xl p-8 mb-6 text-center">
            <div className="text-cyan-400 text-sm font-medium mb-2">
              {selectedEvent?.category} - {selectedEvent?.event_name} · Heat {selectedHeat?.heat_number}
            </div>
            <div className={cn('text-6xl sm:text-7xl font-mono font-bold tabular-nums', isRunning ? 'text-white' : 'text-slate-400')}>
              {formatTime(elapsed)}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              {!isRunning && !isFinished && (
                <button onClick={startRace} disabled={syncing} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                  {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Start Race
                </button>
              )}
              {isRunning && (
                <button onClick={stopRace} disabled={syncing} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold shadow-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                  {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                  Stop Race
                </button>
              )}
              <button onClick={resetRace} disabled={syncing} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50">
                <RotateCcw className="w-5 h-5" /> Reset
              </button>
            </div>
          </div>

          {/* Lane entries */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Lanes — Click "Finish" as each swimmer completes</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400">No present participants in this heat.</div>
              ) : (
                entries.map((entry) => {
                  const part = participants.get(entry.participant_id);
                  const club = part && part.club_id ? clubs.get(part.club_id) : null;
                  const hasFinished = entry.finish_time_ms !== null;
                  return (
                    <div key={entry.id} className={cn('flex items-center px-5 py-4 transition-colors', hasFinished && 'bg-green-50')}>
                      <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-lg mr-4 shrink-0">
                        {entry.lane_number || '-'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{part?.name || 'Unknown'}</div>
                        <div className="text-sm text-slate-500">{club?.name || 'No club'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasFinished ? (
                          <>
                            <div className="text-right">
                              <div className="text-lg font-mono font-bold text-green-700">{formatTime(entry.finish_time_ms)}</div>
                              <div className="text-xs text-slate-500">Position {entry.finish_position}</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Flag className="w-5 h-5 text-green-600" />
                            </div>
                          </>
                        ) : isRunning ? (
                          <button
                            onClick={() => recordFinish(entry)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors animate-pulse"
                          >
                            <Flag className="w-4 h-4" /> Finish
                          </button>
                        ) : (
                          <span className="text-slate-400 text-sm">Waiting...</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3 text-center">
            <Clock className="w-3 h-3 inline mr-1" />
            Timer syncs in real-time across all devices via Supabase Realtime. When you start the race, it starts everywhere simultaneously.
          </p>
        </div>
      )}
    </div>
  );
}
