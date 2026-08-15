import { useState, useEffect, useMemo } from 'react';
import { Loader2, ClipboardList, Users, Shuffle, CheckCircle2, X, AlertCircle, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent, Heat, HeatEntry, Participant, Club, Registration } from '../../lib/types';
import { cn } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

export default function AdminHeats({ settings }: Props) {
  const { events } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [heats, setHeats] = useState<Heat[]>([]);
  const [entries, setEntries] = useState<HeatEntry[]>([]);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [clubs, setClubs] = useState<Map<string, Club>>(new Map());
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const laneCount = parseInt(settings.lane_count || '6', 10);
  const maxPerClub = parseInt(settings.max_participants_per_club_per_event || '2', 10);

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])), [events]);

  useEffect(() => {
    if (selectedEventId) loadData(selectedEventId);
    else { setHeats([]); setEntries([]); setRegs([]); }
  }, [selectedEventId]);

  const loadData = async (eventId: string) => {
    setLoading(true);
    setMessage('');
    const { data: h } = await supabase.from('heats').select('*').eq('event_id', eventId).order('heat_number', { ascending: true });
    setHeats((h || []) as Heat[]);

    const { data: r } = await supabase.from('registrations').select('*').eq('event_id', eventId);
    setRegs((r || []) as Registration[]);

    if (h && h.length > 0) {
      const { data: e } = await supabase.from('heat_entries').select('*').in('heat_id', h.map((x) => x.id)).order('lane_number', { ascending: true, nullsFirst: false });
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
    } else {
      setEntries([]);
    }
    setLoading(false);
  };

  const createHeats = async () => {
    if (!selectedEventId) return;
    setCreating(true);
    setMessage('');
    try {
      // Delete existing heats for this event
      const existingHeatIds = heats.map((h) => h.id);
      if (existingHeatIds.length > 0) {
        await supabase.from('heat_entries').delete().in('heat_id', existingHeatIds);
        await supabase.from('race_state').delete().in('heat_id', existingHeatIds);
        await supabase.from('heats').delete().in('id', existingHeatIds);
      }

      // Get all registrations for this event
      const regPartIds = regs.map((r) => r.participant_id);
      if (regPartIds.length === 0) {
        setMessage('No registrations for this event. Cannot create heats.');
        setCreating(false);
        return;
      }

      // Get participant details
      const { data: parts } = await supabase.from('participants').select('*').in('id', regPartIds);
      const partList = (parts || []) as Participant[];

      // Sort by club to spread club members across heats
      partList.sort((a, b) => (a.club_id || '').localeCompare(b.club_id || ''));

      const numHeats = Math.ceil(partList.length / laneCount);
      const entriesToInsert: { heat_id: string; participant_id: string; lane_number: number; present: boolean }[] = [];

      for (let i = 0; i < numHeats; i++) {
        const { data: heat } = await supabase.from('heats').insert({
          event_id: selectedEventId,
          heat_number: i + 1,
          status: 'created',
        }).select('id').single();
        if (!heat) continue;

        // Assign participants to this heat (snake distribution for fairness)
        const heatParts = partList.filter((_, idx) => idx % numHeats === i);
        for (let lane = 0; lane < heatParts.length; lane++) {
          entriesToInsert.push({
            heat_id: heat.id,
            participant_id: heatParts[lane].id,
            lane_number: lane + 1,
            present: true,
          });
        }
      }

      if (entriesToInsert.length > 0) {
        await supabase.from('heat_entries').insert(entriesToInsert);
      }

      setMessage(`Created ${numHeats} heat(s) with ${partList.length} participant(s).`);
      await loadData(selectedEventId);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleAttendance = async (entry: HeatEntry) => {
    await supabase.from('heat_entries').update({ present: !entry.present }).eq('id', entry.id);
    await loadData(selectedEventId);
  };

  const assignLanes = async () => {
    if (!selectedEventId) return;
    setMessage('');
    // For each heat, assign lanes only to present participants
    for (const heat of heats) {
      const heatEntries = entries.filter((e) => e.heat_id === heat.id && e.present);
      // Sort by club to spread swimmers from same club
      heatEntries.sort((a, b) => {
        const pa = participants.get(a.participant_id);
        const pb = participants.get(b.participant_id);
        return (pa?.club_id || '').localeCompare(pb?.club_id || '');
      });
      // Assign lanes: center lanes first (standard swimming heat seeding)
      const laneOrder: number[] = [];
      const mid = Math.ceil(laneCount / 2);
      for (let i = 0; i < laneCount; i++) {
        if (i % 2 === 0) laneOrder.push(mid + Math.floor(i / 2));
        else laneOrder.push(mid - Math.floor(i / 2) - 1);
      }
      const validLanes = laneOrder.filter((l) => l >= 1 && l <= laneCount).sort((a, b) => a - b);

      for (let i = 0; i < heatEntries.length; i++) {
        const lane = validLanes[i] || (i + 1);
        await supabase.from('heat_entries').update({ lane_number: lane }).eq('id', heatEntries[i].id);
      }
      // Set absent participants lane to null
      const absent = entries.filter((e) => e.heat_id === heat.id && !e.present);
      for (const a of absent) {
        await supabase.from('heat_entries').update({ lane_number: null }).eq('id', a.id);
      }
      await supabase.from('heats').update({ status: 'lanes_assigned' }).eq('id', heat.id);
    }
    setMessage('Lanes assigned automatically for present participants.');
    await loadData(selectedEventId);
  };

  const deleteHeats = async () => {
    if (!confirm('Delete all heats for this event? This removes lane assignments and timing data.')) return;
    const heatIds = heats.map((h) => h.id);
    if (heatIds.length > 0) {
      await supabase.from('heat_entries').delete().in('heat_id', heatIds);
      await supabase.from('race_state').delete().in('heat_id', heatIds);
      await supabase.from('heats').delete().in('id', heatIds);
    }
    await loadData(selectedEventId);
    setMessage('All heats deleted.');
  };

  const entriesByHeat = useMemo(() => {
    const map: Record<string, HeatEntry[]> = {};
    for (const e of entries) {
      if (!map[e.heat_id]) map[e.heat_id] = [];
      map[e.heat_id].push(e);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.lane_number || 999) - (b.lane_number || 999));
    }
    return map;
  }, [entries]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Heats & Lanes</h1>
        <p className="text-slate-500 mt-1">Create heats, take attendance, and auto-assign lanes</p>
      </div>

      {/* Event selector */}
      <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-200 mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Event</label>
        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
          <option value="">Choose an event...</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.category} - {ev.event_name}</option>)}
        </select>
        {selectedEventId && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={createHeats} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {heats.length > 0 ? 'Recreate Heats' : 'Create Heats'}
            </button>
            {heats.length > 0 && (
              <>
                <button onClick={assignLanes} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                  <Shuffle className="w-4 h-4" /> Auto-Assign Lanes
                </button>
                <button onClick={deleteHeats} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                  <X className="w-4 h-4" /> Delete All
                </button>
              </>
            )}
          </div>
        )}
        {message && (
          <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </div>
        )}
      </div>

      {!selectedEventId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Select an event to manage heats and lanes.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : heats.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-md">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">No heats created yet.</p>
          <p className="text-sm text-slate-400">{regs.length} registration(s) for this event.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {heats.map((heat) => {
            const heatEntries = entriesByHeat[heat.id] || [];
            const presentCount = heatEntries.filter((e) => e.present).length;
            return (
              <div key={heat.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white">Heat {heat.heat_number}</h3>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', heat.status === 'finished' ? 'bg-green-500/20 text-green-300' : heat.status === 'racing' ? 'bg-red-500/20 text-red-300' : 'bg-cyan-500/20 text-cyan-300')}>
                      {heat.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-slate-400 text-sm">{presentCount}/{heatEntries.length} present</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {heatEntries.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-slate-400">No entries</div>
                  ) : (
                    heatEntries.map((entry) => {
                      const part = participants.get(entry.participant_id);
                      const club = part && part.club_id ? clubs.get(part.club_id) : null;
                      return (
                        <div key={entry.id} className="flex items-center px-5 py-3 hover:bg-slate-50">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm mr-4">
                            {entry.lane_number || '-'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{part?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{club?.name || 'No club'}</div>
                          </div>
                          <button
                            onClick={() => toggleAttendance(entry)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                              entry.present
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {entry.present ? 'Present' : 'Absent'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
