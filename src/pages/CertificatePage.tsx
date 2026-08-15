import { useState, useEffect, useRef } from 'react';
import { Award, Loader2, Search, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SettingsMap, Participant, Club, SwimEvent, HeatEntry } from '../lib/types';
import { formatTime, downloadDataUrl } from '../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface CertData {
  participant: Participant;
  club: Club | null;
  event: SwimEvent;
  entry: HeatEntry;
}

export default function CertificatePage({ settings }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CertData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSearched(true);

    const q = search.trim().toLowerCase();
    const { data: participants } = await supabase
      .from('participants')
      .select('*')
      .ilike('name', `%${q}%`);

    if (!participants || participants.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const partIds = participants.map((p) => p.id);
    const { data: entries } = await supabase
      .from('heat_entries')
      .select('*')
      .in('participant_id', partIds)
      .not('finish_time_ms', 'is', null)
      .order('overall_rank', { ascending: true });

    if (!entries || entries.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const heatIds = [...new Set(entries.map((e) => e.heat_id))];
    const { data: heats } = await supabase.from('heats').select('*').in('id', heatIds);
    const eventIds = [...new Set((heats || []).map((h) => h.event_id))];
    const { data: events } = await supabase.from('events').select('*').in('id', eventIds);

    const clubIds = [...new Set(participants.map((p) => p.club_id).filter(Boolean))];
    const { data: clubs } = await supabase.from('clubs').select('*').in('id', clubIds);

    const heatMap = new Map((heats || []).map((h) => [h.id, h]));
    const eventMap = new Map((events || []).map((e) => [e.id, e]));
    const clubMap = new Map((clubs || []).map((c) => [c.id, c]));
    const partMap = new Map(participants.map((p) => [p.id, p]));

    const rows: CertData[] = entries
      .map((entry) => {
        const participant = partMap.get(entry.participant_id);
        const heat = heatMap.get(entry.heat_id);
        const event = heat ? eventMap.get(heat.event_id) : undefined;
        if (!participant || !event) return null;
        return {
          entry,
          participant,
          club: participant.club_id ? clubMap.get(participant.club_id) || null : null,
          event,
        };
      })
      .filter((r): r is CertData => r !== null);

    setResults(rows);
    setLoading(false);
  };

  const generateCertificate = (data: CertData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1200;
    const H = 850;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Outer border
    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    // Inner border
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, W - 100, H - 100);

    // Decorative corners
    ctx.fillStyle = '#0e7490';
    [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Certificate of Achievement', W / 2, 130);

    // Organizer
    ctx.fillStyle = '#0e7490';
    ctx.font = '20px Georgia, serif';
    ctx.fillText(settings.organizer || 'Cooch Behar Town Club', W / 2, 170);

    // Subtitle
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(settings.site_title || '43rd Inter Club Swimming Competition', W / 2, 200);

    // Divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 200, 225);
    ctx.lineTo(W / 2 + 200, 225);
    ctx.stroke();

    // "This is to certify that"
    ctx.fillStyle = '#334155';
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('This is to certify that', W / 2, 280);

    // Participant name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText(data.participant.name, W / 2, 340);

    // Club
    ctx.fillStyle = '#64748b';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(`representing ${data.club?.name || 'Independent'}`, W / 2, 380);

    // Achievement
    ctx.fillStyle = '#334155';
    ctx.font = '22px Arial, sans-serif';
    const medalText = data.entry.medal ? `won ${data.entry.medal} in` : 'participated in';
    ctx.fillText(`has ${medalText}`, W / 2, 440);

    // Event name
    ctx.fillStyle = '#0e7490';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText(data.event.event_name, W / 2, 490);

    // Category
    ctx.fillStyle = '#64748b';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(`Category: ${data.event.category}`, W / 2, 525);

    // Time
    if (data.entry.finish_time_ms) {
      ctx.fillStyle = '#334155';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText(`Finishing Time: ${formatTime(data.entry.finish_time_ms)}`, W / 2, 575);
    }

    // Rank
    if (data.entry.overall_rank) {
      ctx.fillStyle = '#334155';
      ctx.font = '20px Arial, sans-serif';
      const rankSuffix = data.entry.overall_rank === 1 ? 'st' : data.entry.overall_rank === 2 ? 'nd' : data.entry.overall_rank === 3 ? 'rd' : 'th';
      ctx.fillText(`Overall Rank: ${data.entry.overall_rank}${rankSuffix}`, W / 2, 610);
    }

    // Divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 200, 660);
    ctx.lineTo(W / 2 + 200, 660);
    ctx.stroke();

    // Date & venue
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(`Held on ${new Date(settings.event_date || '2026-08-15').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 695);
    ctx.fillText(settings.venue || 'Cooch Behar Rajbari Stadium Swimming Pool Complex', W / 2, 720);

    // Signature line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 780);
    ctx.lineTo(350, 780);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - 350, 780);
    ctx.lineTo(W - 150, 780);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('Organizer', 250, 805);
    ctx.fillText('Chief Judge', W - 250, 805);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    downloadDataUrl(dataUrl, `Certificate_${data.participant.name.replace(/\s+/g, '_')}_${data.event.event_name.replace(/\s+/g, '_')}.png`);
  };

  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Award className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Certificate Download</h1>
          <p className="text-slate-400">Search for a participant to download their certificate</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter participant name..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none bg-white"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
          >
            Search
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <Award className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Results Found</h3>
            <p className="text-slate-500">
              No completed events found for this participant. Results may not be published yet.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700">
              Certificates for {results[0].participant.name}
            </h3>
            {results.map((r) => (
              <div
                key={r.entry.id}
                className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-4 border border-slate-200"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  r.entry.medal === 'Gold' ? 'bg-yellow-100' :
                  r.entry.medal === 'Silver' ? 'bg-gray-200' :
                  r.entry.medal === 'Bronze' ? 'bg-orange-100' :
                  'bg-cyan-100'
                }`}>
                  <Award className={`w-6 h-6 ${
                    r.entry.medal === 'Gold' ? 'text-yellow-600' :
                    r.entry.medal === 'Silver' ? 'text-gray-600' :
                    r.entry.medal === 'Bronze' ? 'text-orange-600' :
                    'text-cyan-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{r.event.event_name}</div>
                  <div className="text-sm text-slate-500">
                    {r.event.category} · {r.entry.medal ? `${r.entry.medal} Medal` : `Rank ${r.entry.overall_rank || '-'}`}
                    {r.entry.finish_time_ms && ` · ${formatTime(r.entry.finish_time_ms)}`}
                  </div>
                </div>
                <button
                  onClick={() => generateCertificate(r)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
