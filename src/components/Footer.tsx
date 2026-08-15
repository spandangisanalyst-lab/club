import { Waves, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import type { Page } from '../App';
import type { SettingsMap } from '../lib/types';
import { formatDate } from '../lib/utils';

interface Props {
  settings: SettingsMap;
  navigate: (p: Page) => void;
}

export default function Footer({ settings, navigate }: Props) {
  return (
    <footer className="bg-slate-900 text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Waves className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-white font-bold">{settings.organizer}</div>
                <div className="text-cyan-400 text-xs">Town Club</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              {settings.footer_text}
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              <button onClick={() => navigate('events')} className="text-left hover:text-cyan-400 transition-colors">Event List</button>
              <button onClick={() => navigate('register')} className="text-left hover:text-cyan-400 transition-colors">Registration</button>
              <button onClick={() => navigate('results')} className="text-left hover:text-cyan-400 transition-colors">Results</button>
              <button onClick={() => navigate('certificate')} className="text-left hover:text-cyan-400 transition-colors">Certificate Download</button>
              <button onClick={() => navigate('championship')} className="text-left hover:text-cyan-400 transition-colors">Club Championship</button>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact & Venue</h4>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <span>{settings.venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{formatDate(settings.event_date)}</span>
              </div>
              {settings.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{settings.contact_email}</span>
                </div>
              )}
              {settings.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{settings.contact_phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs">
          <button
            onClick={() => navigate('admin')}
            className="text-slate-600 hover:text-cyan-500 transition-colors"
          >
            Admin Panel
          </button>
        </div>
      </div>
    </footer>
  );
}
