import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import EventListPage from './pages/EventListPage';
import RegistrationPage from './pages/RegistrationPage';
import ParticipantsPage from './pages/ParticipantsPage';
import ResultsPage from './pages/ResultsPage';
import CertificatePage from './pages/CertificatePage';
import ChampionshipPage from './pages/ChampionshipPage';
import AdminPage from './pages/AdminPage';
import { useSettings } from './lib/useSettings';

export type Page = 'home' | 'events' | 'register' | 'participants' | 'results' | 'certificate' | 'championship' | 'admin';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.slice(1) as Page;
    return (['home', 'events', 'register', 'participants', 'results', 'certificate', 'championship', 'admin'].includes(hash)
      ? hash
      : 'home') as Page;
  });
  const { settings, loading } = useSettings();

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1) as Page;
      if (['home', 'events', 'register', 'participants', 'results', 'certificate', 'championship', 'admin'].includes(hash)) {
        setPage(hash);
      } else {
        setPage('home');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-cyan-400 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  const isAdmin = page === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {!isAdmin && <Navbar page={page} navigate={navigate} settings={settings} />}
      <main className="flex-1">
        {page === 'home' && <HomePage settings={settings} navigate={navigate} />}
        {page === 'events' && <EventListPage settings={settings} />}
        {page === 'register' && <RegistrationPage settings={settings} />}
        {page === 'participants' && <ParticipantsPage settings={settings} />}
        {page === 'results' && <ResultsPage settings={settings} />}
        {page === 'certificate' && <CertificatePage settings={settings} />}
        {page === 'championship' && <ChampionshipPage settings={settings} />}
        {page === 'admin' && <AdminPage settings={settings} />}
      </main>
      {!isAdmin && <Footer settings={settings} navigate={navigate} />}
    </div>
  );
}
