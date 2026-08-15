import { Waves, Home, ListChecks, UserPlus, Users, Trophy, Award, Medal, Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../App';
import type { SettingsMap } from '../lib/types';
import { cn } from '../lib/utils';

interface Props {
  page: Page;
  navigate: (p: Page) => void;
  settings: SettingsMap;
}

export default function Navbar({ page, navigate, settings }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links: { key: Page; label: string; icon: typeof Home }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'events', label: 'Event List', icon: ListChecks },
    { key: 'register', label: 'Register', icon: UserPlus },
    { key: 'participants', label: 'Participants', icon: Users },
    { key: 'results', label: 'Results', icon: Trophy },
    { key: 'certificate', label: 'Certificate', icon: Award },
    { key: 'championship', label: 'Championship', icon: Medal },
  ];

  const go = (p: Page) => {
    navigate(p);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-cyan-500/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => go('home')} className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform">
              <Waves className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-sm sm:text-base leading-tight">
                {settings.site_title?.replace('43rd ', '') || 'Inter Club Swimming'}
              </div>
              <div className="text-cyan-400 text-[10px] sm:text-xs leading-tight">
                {settings.organizer || 'Town Club'}
              </div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => go(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  page === key
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-inner'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-white p-2"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="lg:hidden pb-4 flex flex-col gap-1">
            {links.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => go(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                  page === key
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
