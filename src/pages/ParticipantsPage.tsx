import { Waves } from 'lucide-react';
import ParticipantLists from '../components/ParticipantLists';
import type { SettingsMap } from '../lib/types';

interface Props {
  settings: SettingsMap;
}

export default function ParticipantsPage({ settings }: Props) {
  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Waves className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Participants</h1>
          <p className="text-slate-400">
            {settings.organizer} · {settings.venue}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <ParticipantLists settings={settings} />
      </div>
    </div>
  );
}
