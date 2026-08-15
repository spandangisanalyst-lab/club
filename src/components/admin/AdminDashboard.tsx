import { useState, useEffect } from 'react';
import { Users, CalendarDays, ClipboardList, Trophy, Waves, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SettingsMap } from '../../lib/types';
import { formatDate } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

export default function AdminDashboard({ settings }: Props) {
  const [stats, setStats] = useState({
    clubs: 0,
    participants: 0,
    events: 0,
    registrations: 0,
    heats: 0,
    results: 0,
  });

  useEffect(() => {
    (async () => {
      const [clubs, participants, events, registrations, heats, results] = await Promise.all([
        supabase.from('clubs').select('id', { count: 'exact', head: true }),
        supabase.from('participants').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('registrations').select('id', { count: 'exact', head: true }),
        supabase.from('heats').select('id', { count: 'exact', head: true }),
        supabase.from('heat_entries').select('id', { count: 'exact', head: true }).not('finish_time_ms', 'is', null),
      ]);
      setStats({
        clubs: clubs.count || 0,
        participants: participants.count || 0,
        events: events.count || 0,
        registrations: registrations.count || 0,
        heats: heats.count || 0,
        results: results.count || 0,
      });
    })();
  }, []);

  const cards = [
    { label: 'Clubs', value: stats.clubs, icon: Waves, color: 'from-blue-500 to-cyan-600' },
    { label: 'Participants', value: stats.participants, icon: Users, color: 'from-cyan-500 to-teal-600' },
    { label: 'Events', value: stats.events, icon: CalendarDays, color: 'from-purple-500 to-pink-600' },
    { label: 'Registrations', value: stats.registrations, icon: ClipboardList, color: 'from-amber-500 to-orange-600' },
    { label: 'Heats Created', value: stats.heats, icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
    { label: 'Results Recorded', value: stats.results, icon: Trophy, color: 'from-rose-500 to-red-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of the {settings.site_title}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Event Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Organizer:</span>
            <span className="ml-2 font-medium text-slate-800">{settings.organizer}</span>
          </div>
          <div>
            <span className="text-slate-500">Event Date:</span>
            <span className="ml-2 font-medium text-slate-800">{formatDate(settings.event_date)}</span>
          </div>
          <div>
            <span className="text-slate-500">Venue:</span>
            <span className="ml-2 font-medium text-slate-800">{settings.venue}</span>
          </div>
          <div>
            <span className="text-slate-500">Registration Deadline:</span>
            <span className="ml-2 font-medium text-slate-800">{formatDate(settings.registration_deadline)}</span>
          </div>
          <div>
            <span className="text-slate-500">Max Events per Participant:</span>
            <span className="ml-2 font-medium text-slate-800">{settings.max_events_per_participant}</span>
          </div>
          <div>
            <span className="text-slate-500">Max per Club per Event:</span>
            <span className="ml-2 font-medium text-slate-800">{settings.max_participants_per_club_per_event}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
