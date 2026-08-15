import { useState, useEffect } from 'react';
import {
  Lock,
  LayoutDashboard,
  CalendarDays,
  Users,
  Timer,
  Trophy,
  Award,
  Settings,
  LogOut,
  Waves,
  Menu,
  X,
  FileBarChart,
} from 'lucide-react';
import { ADMIN_PASSWORD } from '../lib/constants';
import { cn } from '../lib/utils';
import type { SettingsMap } from '../lib/types';

// Updated imports for the new merged architecture
import AdminDashboard from '../components/admin/AdminDashboard';
import AdminEvents from '../components/admin/AdminEvents';
import AdminParticipantsMerged from '../components/admin/AdminParticipantsMerged';
import AdminEventConsole from '../components/admin/AdminEventConsole';
import AdminReports from '../components/admin/AdminReports';
import AdminResults from '../components/admin/AdminResults';
import AdminSettings from '../components/admin/AdminSettings';
import AdminCertificates from '../components/admin/AdminCertificates';

interface Props {
  settings: SettingsMap;
}

// Updated tabs removing 'registrations' and 'heats', adding 'eventConsole'
type AdminTab =
  | 'dashboard'
  | 'events'
  | 'participants'
  | 'eventConsole'
  | 'reports'
  | 'results'
  | 'certificates'
  | 'settings';

const SESSION_KEY = 'ctc_admin_auth';

export default function AdminPage({ settings }: Props) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
      setError('');
      setPassword('');
    } else {
      setError('Incorrect password. Access denied.');
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.hash = 'home';
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-cyan-500/30 overflow-hidden p-2">
              {/* Club Logo Integration */}
              <img 
                src="/club-logo.jpg" 
                alt="Club Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to Waves icon if logo path is broken
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-cyan-400', 'to-blue-600');
                }}
              />
              <Waves className="w-12 h-12 text-white hidden fallback-icon" />
            </div>
            <h1 className="text-2xl font-bold text-white">Race Admin Console</h1>
            <p className="text-slate-400 text-sm mt-1">{settings.organizer || 'Cooch Behar Town Club'}</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                placeholder="Enter admin password"
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] transition-all"
            >
              Login
            </button>
          </form>
          <div className="text-center mt-4">
            <button
              onClick={() => (window.location.hash = 'home')}
              className="text-slate-500 hover:text-cyan-400 text-sm transition-colors"
            >
              Back to website
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Updated tabs array mapping to the merged components
  const tabs: { key: AdminTab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'events', label: 'Manage Events', icon: CalendarDays },
    { key: 'participants', label: 'Participants & Reg', icon: Users },
    { key: 'eventConsole', label: 'Live Race Console', icon: Timer },
    { key: 'reports', label: 'Reports & Lists', icon: FileBarChart },
    { key: 'results', label: 'Results & Standings', icon: Trophy },
    { key: 'certificates', label: 'Certificates', icon: Award },
    { key: 'settings', label: 'Website & Certs', icon: Settings },
  ];
  
     return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 z-50 transition-transform lg:translate-x-0',
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
            <img
              src="/club-logo.png"
              alt="Club Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">
              Admin Panel
            </div>

            <div className="text-cyan-400 text-xs truncate">
              Cooch Behar Town Club
            </div>
          </div>

          <button
            onClick={() =>
              setSidebarOpen(false)
            }
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav
          className="p-3 flex flex-col gap-1 overflow-y-auto"
          style={{
            maxHeight:
              'calc(100vh - 4rem - 60px)',
          }}
        >
          {tabs.map(
            ({
              key,
              label,
              icon: Icon,
            }) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                  tab === key
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-inner'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            )
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">

        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 bg-slate-900 z-30 flex items-center justify-between px-4 h-16 border-b border-slate-800">
          <button
            onClick={() =>
              setSidebarOpen(true)
            }
            className="text-white p-2 -ml-2"
          >
            <Menu className="w-6 h-6" />
          </button>

          <span className="text-white font-semibold">
            {
              tabs.find(
                (t) => t.key === tab
              )?.label
            }
          </span>

          <div className="w-10" />
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">

          {tab === 'dashboard' && (
            <AdminDashboard
              settings={settings}
            />
          )}

          {tab === 'events' && (
            <AdminEvents
              settings={settings}
            />
          )}

          {tab === 'participants' && (
            <AdminParticipantsMerged
              settings={settings}
            />
          )}

          {tab === 'eventConsole' && (
            <AdminEventConsole
              settings={settings}
            />
          )}

          {tab === 'reports' && (
            <AdminReports
              settings={settings}
            />
          )}

          {tab === 'results' && (
            <AdminResults
              settings={settings}
            />
          )}

          {tab === 'certificates' && (
            <AdminCertificates />
          )}

          {tab === 'settings' && (
            <AdminSettings
              settings={settings}
            />
          )}

        </div>
        {/* End page content */}

      </div>
      {/* End main content */}

    </div>
  );
}
