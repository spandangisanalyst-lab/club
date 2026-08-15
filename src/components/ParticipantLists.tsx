import { useState, useEffect, useMemo } from 'react';
import { Download, Users, Waves, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEvents } from '../lib/useEvents';
import { useParticipants } from '../lib/useParticipants';
import { useClubs } from '../lib/useClubs';
import { ageGroupForParticipant } from '../lib/constants';
import { calculateAge, downloadFile } from '../lib/utils';
import type { SettingsMap, Registration, SwimEvent, Participant, Club } from '../lib/types';

interface Props {
  settings: SettingsMap;
}

const CATEGORY_ORDER = [
  'Men', 'Women',
  'U/17 Boys', 'U/17 Girls',
  'U/14 Boys', 'U/14 Girls',
  'U/12 Boys', 'U/12 Girls',
  'U/10 Boys', 'U/10 Girls',
];

type ViewMode = 'event' | 'club';

export default function ParticipantLists({ settings }: Props) {
  const { events } = useEvents();
  const { participants } = useParticipants();
  const { clubs } = useClubs();
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('event');
  const [search, setSearch] = useState('');

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e] as [string, SwimEvent])), [events]);
  const partMap = useMemo(() => new Map(participants.map((p) => [p.id, p] as [string, Participant])), [participants]);
  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.id, c] as [string, Club])), [clubs]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('registrations').select('*');
      setRegs((data as Registration[]) || []);
      setLoading(false);
    })();
  }, []);

  // Event-wise grouping
  const eventGroups = useMemo(() => {
    const map = new Map<string, { event: SwimEvent; participants: { part: Participant; club: Club | undefined }[] }>();
    for (const ev of events) {
      map.set(ev.id, { event: ev, participants: [] });
    }
    for (const r of regs) {
      const ev = eventMap.get(r.event_id);
      const part = partMap.get(r.participant_id);
      if (!ev || !part) continue;
      const club = clubMap.get(part.club_id);
      const group = map.get(ev.id);
      if (group) group.participants.push({ part, club });
    }
    // Sort participants within each event by name
    for (const g of map.values()) {
      g.participants.sort((a, b) => a.part.name.localeCompare(b.part.name));
    }
    return Array.from(map.values()).sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.event.category);
      const cb = CATEGORY_ORDER.indexOf(b.event.category);
      if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
      return a.event.event_name.localeCompare(b.event.event_name);
    });
  }, [events, regs, eventMap, partMap, clubMap]);

  // Club-wise grouping
  const clubGroups = useMemo(() => {
    const map = new Map<string, { club: Club; participants: { part: Participant; events: SwimEvent[] }[] }>();
    for (const c of clubs) {
      map.set(c.id, { club: c, participants: [] });
    }
    // Group registrations by participant within each club
    const partEventMap = new Map<string, SwimEvent[]>();
    for (const r of regs) {
      const part = partMap.get(r.participant_id);
      const ev = eventMap.get(r.event_id);
      if (!part || !ev) continue;
      const arr = partEventMap.get(part.id) || [];
      arr.push(ev);
      partEventMap.set(part.id, arr);
    }
    for (const p of participants) {
      const club = clubMap.get(p.club_id);
      if (!club) continue;
      const group = map.get(club.id);
      if (!group) continue;
      const evs = partEventMap.get(p.id) || [];
      group.participants.push({ part: p, events: evs });
    }
    for (const g of map.values()) {
      g.participants.sort((a, b) => a.part.name.localeCompare(b.part.name));
    }
    return Array.from(map.values())
      .filter((g) => g.participants.length > 0)
      .sort((a, b) => a.club.name.localeCompare(b.club.name));
  }, [clubs, participants, regs, partMap, eventMap, clubMap]);

  const filteredEventGroups = useMemo(() => {
    if (!search) return eventGroups;
    const q = search.toLowerCase();
    return eventGroups
      .map((g) => ({
        ...g,
        participants: g.participants.filter(
          (p) => p.part.name.toLowerCase().includes(q) || (p.club?.name || '').toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.participants.length > 0);
  }, [eventGroups, search]);

  const filteredClubGroups = useMemo(() => {
    if (!search) return clubGroups;
    const q = search.toLowerCase();
    return clubGroups
      .map((g) => ({
        ...g,
        participants: g.participants.filter(
          (p) =>
            p.part.name.toLowerCase().includes(q) ||
            g.club.name.toLowerCase().includes(q) ||
            p.events.some((e) => e.event_name.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.participants.length > 0);
  }, [clubGroups, search]);

  const downloadEventCSV = () => {
    const rows = ['Event,Category,Participant Name,Club,Age,Gender'];
    for (const g of eventGroups) {
      for (const p of g.participants) {
        const age = calculateAge(p.part.date_of_birth);
        rows.push(
          `"${g.event.event_name}","${g.event.category}","${p.part.name}","${p.club?.name || ''}",${age},${p.part.gender}`
        );
      }
    }
    downloadFile(rows.join('\n'), 'event-wise-participants.csv', 'text/csv');
  };

  const downloadClubCSV = () => {
    const rows = ['Club,Participant Name,Age,Gender,Events'];
    for (const g of clubGroups) {
      for (const p of g.participants) {
        const age = calculateAge(p.part.date_of_birth);
        const evNames = p.events.map((e) => e.event_name).join('; ');
        rows.push(`"${g.club.name}","${p.part.name}",${age},${p.part.gender},"${evNames}"`);
      }
    }
    downloadFile(rows.join('\n'), 'club-wise-participants.csv', 'text/csv');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div>
      {/* View toggle + search + download */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 p-1.5 bg-slate-200/60 rounded-2xl">
          <button
            onClick={() => setView('event')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              view === 'event' ? 'bg-white text-cyan-700 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Waves className="w-4 h-4" /> Event-wise
          </button>
          <button
            onClick={() => setView('club')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              view === 'club' ? 'bg-white text-cyan-700 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" /> Club-wise
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants, clubs, events..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white"
          />
        </div>

        <button
          onClick={view === 'event' ? downloadEventCSV : downloadClubCSV}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      {view === 'event' ? (
        <div className="space-y-4">
          {filteredEventGroups.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-12 text-center text-slate-500">
              No participants found.
            </div>
          ) : (
            filteredEventGroups.map((g) => (
              <div key={g.event.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-3 flex items-center gap-3">
                  <Waves className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-white font-bold">{g.event.event_name}</h3>
                    <p className="text-cyan-100 text-xs">{g.event.category} · {g.event.stroke} · {g.event.distance}m</p>
                  </div>
                  <span className="ml-auto text-cyan-100 text-sm bg-white/15 px-2.5 py-1 rounded-lg">
                    {g.participants.length} swimmer{g.participants.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.participants.map(({ part, club }, idx) => {
                    const group = ageGroupForParticipant(part.date_of_birth, part.gender);
                    const age = calculateAge(part.date_of_birth);
                    return (
                      <div key={part.id} className="flex items-center px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-xs mr-3">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800">{part.name}</div>
                          <div className="text-xs text-slate-500">
                            {club?.name || 'No club'} · {age}y · {group?.label || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClubGroups.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-12 text-center text-slate-500">
              No participants found.
            </div>
          ) : (
            filteredClubGroups.map((g) => (
              <div key={g.club.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-700 px-5 py-3 flex items-center gap-3">
                  <Users className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-white font-bold">{g.club.name}</h3>
                    {g.club.manager_name && (
                      <p className="text-cyan-100 text-xs">Manager: {g.club.manager_name}</p>
                    )}
                  </div>
                  <span className="ml-auto text-cyan-100 text-sm bg-white/15 px-2.5 py-1 rounded-lg">
                    {g.participants.length} swimmer{g.participants.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.participants.map(({ part, events }, idx) => {
                    const group = ageGroupForParticipant(part.date_of_birth, part.gender);
                    const age = calculateAge(part.date_of_birth);
                    return (
                      <div key={part.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center">
                          <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-xs mr-3">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{part.name}</div>
                            <div className="text-xs text-slate-500">
                              {age}y · {part.gender} · {group?.label || 'Unknown'}
                            </div>
                          </div>
                        </div>
                        {events.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                            {events.map((ev) => (
                              <span
                                key={ev.id}
                                className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-xs font-medium border border-cyan-100"
                              >
                                {ev.event_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
