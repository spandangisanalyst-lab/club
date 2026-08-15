import { useMemo } from 'react';
import { Waves, Users } from 'lucide-react';
import { useEvents } from '../lib/useEvents';
import { useSettings } from '../lib/useSettings';
import type { SettingsMap } from '../lib/types';
import type { SwimEvent } from '../lib/types';

interface Props {
  settings: SettingsMap;
}

const CATEGORY_ORDER = [
  'Men',
  'Women',
  'U/17 Boys',
  'U/17 Girls',
  'U/14 Boys',
  'U/14 Girls',
  'U/12 Boys',
  'U/12 Girls',
  'U/10 Boys',
  'U/10 Girls',
];

export default function EventListPage({ settings }: Props) {
  const { events, loading } = useEvents();

  const grouped = useMemo(() => {
    const map: Record<string, SwimEvent[]> = {};
    for (const e of events) {
      if (!map[e.category]) map[e.category] = [];
      map[e.category].push(e);
    }
    return map;
  }, [events]);

  const sortedCategories = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [grouped]);

  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Waves className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Event List 2026</h1>
          <p className="text-slate-400">
            {settings.organizer} · {settings.venue}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center text-slate-500 py-20">Loading events...</div>
        ) : (
          <div className="space-y-8">
            {sortedCategories.map((category) => (
              <div
                key={category}
                className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200"
              >
                <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-white" />
                    <h2 className="text-xl font-bold text-white">{category}</h2>
                    <span className="ml-auto text-cyan-100 text-sm">
                      {grouped[category].length} event{grouped[category].length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {grouped[category].map((event, idx) => (
                    <div
                      key={event.id}
                      className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-sm mr-4">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{event.event_name}</div>
                        <div className="text-sm text-slate-500">
                          {event.stroke} · {event.distance}m
                        </div>
                      </div>
                      <div className="text-sm text-slate-400">
                        Max {settings.max_participants_per_club_per_event || '2'} per club
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
          <h3 className="font-semibold text-amber-900 mb-2">Registration Rules</h3>
          <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
            <li>Each participant can enter a maximum of {settings.max_events_per_participant || '3'} events.</li>
            <li>Maximum {settings.max_participants_per_club_per_event || '2'} participants per club per event.</li>
            <li>No duplicate entries — the system prevents them automatically.</li>
            <li>Age is calculated as of 15th August 2026. Registration closes 13th August 11:59 PM.</li>
            <li>Events are auto-selected based on the participant's age group and gender.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
