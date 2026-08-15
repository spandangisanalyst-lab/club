import { FileBarChart } from 'lucide-react';
import ParticipantLists from '../../components/ParticipantLists';
import type { SettingsMap } from '../lib/types';

interface Props {
  settings: SettingsMap;
}

export default function AdminReports({ settings }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileBarChart className="w-7 h-7 text-cyan-600" />
          Reports & Lists
        </h1>
        <p className="text-slate-500 mt-1">View and download participant lists by event or by club</p>
      </div>
      <ParticipantLists settings={settings} />
    </div>
  );
}
