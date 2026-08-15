import { Waves, Trophy, MapPin, Calendar, UserPlus, ListChecks, Medal, Clock, Users, Award } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Page } from '../App';
import type { SettingsMap } from '../lib/types';
import { HERO_IMAGES, GALLERY_IMAGES } from '../lib/constants';
import { formatDate } from '../lib/utils';
import EventList from '../components/EventList';
interface Props {
  settings: SettingsMap;
  navigate: (p: Page) => void;
}

export default function HomePage({ settings, navigate }: Props) {
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[90vh] min-h-[600px] overflow-hidden">
        {HERO_IMAGES.map((img, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === heroIndex ? 1 : 0 }}
          >
            <img src={img} alt="Swimming competition" className="w-full h-full object-cover" />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/90" />

        <div className="relative h-full flex items-center justify-center px-4">
          <div className="text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 backdrop-blur-sm mb-6 animate-fade-in">
              <Waves className="w-4 h-4 text-cyan-300" />
              <span className="text-cyan-200 text-sm font-medium">43rd Edition</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
              {settings.hero_heading}
            </h1>
            <p className="text-lg sm:text-xl text-slate-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              {settings.hero_subheading}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
              <div className="flex items-center gap-2 text-cyan-300">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">{formatDate(settings.event_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-300">
                <MapPin className="w-5 h-5" />
                <span className="font-medium">{settings.venue}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate('register')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Register Now
              </button>
              <button
                onClick={() => navigate('events')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
              >
                <ListChecks className="w-5 h-5" />
                View Events
              </button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-1.5">
            <div className="w-1 h-2 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Trophy, label: 'Events', value: '30+' },
            { icon: Users, label: 'Categories', value: '10' },
            { icon: Medal, label: 'Age Groups', value: '6' },
            { icon: Clock, label: 'Live Timing', value: 'Real-time' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <Icon className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-sm text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </section>
        {/* Order of Events */}
      <EventList />

      {/* About */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            {settings.about_title}
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            {settings.about_text}
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Glimpses of the Pool</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {GALLERY_IMAGES.map((img, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl group aspect-[4/3]"
              >
                <img
                  src={img}
                  alt="Swimming"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Award className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Make Waves?
          </h2>
          <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
            Registration closes on {formatDate(settings.registration_deadline)}. Don't miss your chance to compete!
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('register')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:scale-105 transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Register Now
            </button>
            <button
              onClick={() => navigate('results')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
            >
              <Trophy className="w-5 h-5" />
              View Results
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
