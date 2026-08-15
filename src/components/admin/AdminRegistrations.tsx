import { useState, useEffect, useMemo } from 'react';
import { Trash2, Loader2, ClipboardList, Search, Plus, X, ChevronDown, ChevronRight, Pencil, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import { useParticipants } from '../../lib/useParticipants';
import { useClubs } from '../../lib/useClubs';
import { ageGroupForParticipant } from '../../lib/constants';
import { calculateAge } from '../../lib/utils';
import type { SettingsMap, Registration, SwimEvent, Participant, Club } from '../../lib/types';

interface Props {
  settings: SettingsMap;
}

interface ParticipantRow {
  participant: Participant;
  registrations: Registration[];
}

export default function AdminRegistrations({ settings }: Props) {
  const { events } = useEvents();
  const { participants } = useParticipants();
  const { clubs } = useClubs();
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ participant_id: '', event_id: '' });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingReg, setEditingReg] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState('');
  const [editError, setEditError] = useState('');

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])), [events]);
  const partMap = useMemo(() => new Map(participants.map((p) => [p.id, p] as [string, Participant])), [participants]);
  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.id, c] as [string, Club])), [clubs]);

  useEffect(() => {
    loadRegs();
  }, []);

  const loadRegs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
    if (!error && data) setRegs(data as Registration[]);
    setLoading(false);
  };

  const maxEventsPerParticipant = parseInt(settings.max_events_per_participant || '3', 10);
  const maxPerClubPerEvent = parseInt(settings.max_participants_per_club_per_event || '2', 10);

  // Group registrations by participant
  const grouped: ParticipantRow[] = useMemo(() => {
    const map = new Map<string, Registration[]>();
    for (const r of regs) {
      const arr = map.get(r.participant_id) || [];
      arr.push(r);
      map.set(r.participant_id, arr);
    }
    const rows: ParticipantRow[] = [];
    for (const [pid, regList] of map) {
      const part = partMap.get(pid);
      if (!part) continue;
      rows.push({ participant: part, registrations: regList });
    }
    rows.sort((a, b) => a.participant.name.localeCompare(b.participant.name));
    return rows;
  }, [regs, partMap]);

  const filtered = useMemo(() => {
    if (!search) return grouped;
    const q = search.toLowerCase();
    return grouped.filter((row) => {
      const club = clubMap.get(row.participant.club_id);
      const evNames = row.registrations.map((r) => eventMap.get(r.event_id)?.event_name || '').join(' ');
      const catNames = row.registrations.map((r) => eventMap.get(r.event_id)?.category || '').join(' ');
      return (
        row.participant.name.toLowerCase().includes(q) ||
        (club?.name || '').toLowerCase().includes(q) ||
        evNames.toLowerCase().includes(q) ||
        catNames.toLowerCase().includes(q)
      );
    });
  }, [grouped, search, clubMap, eventMap]);

  const toggleExpand = (pid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this registration?')) return;
    await supabase.from('registrations').delete().eq('id', id);
    await loadRegs();
  };

  const startEdit = (reg: Registration) => {
    setEditingReg(reg.id);
    setEditEventId(reg.event_id);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingReg(null);
    setEditEventId('');
    setEditError('');
  };

  const saveEdit = async (reg: Registration) => {
    setEditError('');
    if (editEventId === reg.event_id) {
      cancelEdit();
      return;
    }
    const part = partMap.get(reg.participant_id);
    if (!part) return;

    // Check duplicate
    const dup = regs.find((r) => r.participant_id === reg.participant_id && r.event_id === editEventId);
    if (dup) {
      setEditError('Already registered for that event.');
      return;
    }

    // Check per-club per-event limit for the NEW event
    const clubCount = regs.filter(
      (r) => r.event_id === editEventId && r.club_id === part.club_id && r.id !== reg.id
    ).length;
    if (clubCount >= maxPerClubPerEvent) {
      setEditError(`Event already has ${maxPerClubPerEvent} participants from this club.`);
      return;
    }

    const { error: err } = await supabase
      .from('registrations')
      .update({ event_id: editEventId })
      .eq('id', reg.id);
    if (err) {
      setEditError(err.message);
      return;
    }
    await loadRegs();
    cancelEdit();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!addForm.participant_id || !addForm.event_id) {
      setError('Select both participant and event.');
      return;
    }
    const part = partMap.get(addForm.participant_id);
    if (!part) return;

    const partRegCount = regs.filter((r) => r.participant_id === addForm.participant_id).length;
    if (partRegCount >= maxEventsPerParticipant) {
      setError(`Participant already registered for ${partRegCount} events (max ${maxEventsPerParticipant}).`);
      return;
    }

    const dup = regs.find((r) => r.participant_id === addForm.participant_id && r.event_id === addForm.event_id);
    if (dup) {
      setError('Duplicate entry: this participant is already registered for this event.');
      return;
    }

    const clubCount = regs.filter((r) => r.event_id === addForm.event_id && r.club_id === part.club_id).length;
    if (clubCount >= maxPerClubPerEvent) {
      setError(`Event already has ${maxPerClubPerEvent} participants from this club.`);
      return;
    }

    const { error: err } = await supabase.from('registrations').insert({
      participant_id: addForm.participant_id,
      event_id: addForm.event_id,
      club_id: part.club_id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    await loadRegs();
    setShowAdd(false);
    setAddForm({ participant_id: '', event_id: '' });
  };

  // For add form: eligible events based on participant's age group
  const addEligibleEvents = useMemo(() => {
    if (!addForm.participant_id) return [];
    const part = partMap.get(addForm.participant_id);
    if (!part) return [];
    const group = ageGroupForParticipant(part.date_of_birth, part.gender);
    if (!group) return [];
    return events.filter((e) => e.age_group === group.ageGroup && e.gender === part.gender);
  }, [addForm.participant_id, partMap, events]);

  // For edit: eligible events for a participant's age group
  const getEligibleEventsForParticipant = (part: Participant): SwimEvent[] => {
    const group = ageGroupForParticipant(part.date_of_birth, part.gender);
    if (!group) return [];
    return events.filter((e) => e.age_group === group.ageGroup && e.gender === part.gender);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrations</h1>
          <p className="text-slate-500 mt-1">{filtered.length} participants · {regs.length} total registrations</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Registration
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by participant, event, or club..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white" />
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Add Registration</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Participant</label>
                <select value={addForm.participant_id} onChange={(e) => setAddForm({ ...addForm, participant_id: e.target.value, event_id: '' })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
                  <option value="">Select participant</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({clubMap.get(p.club_id)?.name || 'No club'})</option>
                  ))}
                </select>
              </div>
              {addForm.participant_id && (() => {
                const part = partMap.get(addForm.participant_id);
                if (!part) return null;
                const group = ageGroupForParticipant(part.date_of_birth, part.gender);
                const age = calculateAge(part.date_of_birth);
                return (
                  <div className="p-3 bg-cyan-50 rounded-lg text-sm text-cyan-800">
                    Age: {age} years · Category: {group?.label || 'Unknown'}
                  </div>
                );
              })()}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Event</label>
                <select value={addForm.event_id} onChange={(e) => setAddForm({ ...addForm, event_id: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white" disabled={!addForm.participant_id}>
                  <option value="">Select event</option>
                  {addEligibleEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.category} - {ev.event_name}</option>
                  ))}
                </select>
                {addForm.participant_id && addEligibleEvents.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">No events available for this participant's age group.</p>
                )}
              </div>
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors">
                <ClipboardList className="w-5 h-5" /> Add Registration
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-12 text-center text-slate-500">
          No registrations found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const part = row.participant;
            const club = clubMap.get(part.club_id);
            const group = ageGroupForParticipant(part.date_of_birth, part.gender);
            const age = calculateAge(part.date_of_birth);
            const isExpanded = expanded.has(part.id);
            const eligibleEvents = getEligibleEventsForParticipant(part);

            return (
              <div key={part.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Collapsed row: participant name + event chips */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(part.id)}
                >
                  <button className="text-slate-400 hover:text-slate-600 shrink-0">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{part.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">{group?.label || 'Unknown'}</span>
                      <span className="text-xs text-slate-400">{age}y</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">{club?.name || 'No club'}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[45%]">
                    {row.registrations.map((r) => {
                      const ev = eventMap.get(r.event_id);
                      return (
                        <span key={r.id} className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-medium border border-cyan-100">
                          {ev?.event_name || 'Unknown'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded: editable list of registrations */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                    {row.registrations.map((r) => {
                      const ev = eventMap.get(r.event_id);
                      const isEditing = editingReg === r.id;
                      return (
                        <div key={r.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                          {isEditing ? (
                            <>
                              <select
                                value={editEventId}
                                onChange={(e) => setEditEventId(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white text-sm"
                              >
                                {eligibleEvents.map((e) => (
                                  <option key={e.id} value={e.id}>{e.category} - {e.event_name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => saveEdit(r)}
                                className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-sm text-slate-700">{ev?.event_name || 'Unknown'}</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">{ev?.category || '-'}</span>
                              </div>
                              <button
                                onClick={() => startEdit(r)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-colors"
                                title="Change event"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {editingReg && editError && (
                      <p className="text-sm text-red-600 px-3">{editError}</p>
                    )}
                    {row.registrations.length === 0 && (
                      <p className="text-sm text-slate-400 px-3 py-1">No registrations.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
