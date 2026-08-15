import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../lib/useEvents';
import type { SettingsMap, SwimEvent } from '../../lib/types';

interface Props {
  settings: SettingsMap;
}

const CATEGORIES = ['Men', 'Women', 'U/17 Boys', 'U/17 Girls', 'U/14 Boys', 'U/14 Girls', 'U/12 Boys', 'U/12 Girls', 'U/10 Boys', 'U/10 Girls'];
const STROKES = ['Free style', 'Back', 'Breast strock', 'Butter fly'];

export default function AdminEvents({ settings }: Props) {
  const { events, loading, reload } = useEvents();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SwimEvent | null>(null);
  const [form, setForm] = useState({
    category: 'Men',
    event_name: '',
    stroke: 'Free style',
    distance: 50,
    gender: 'Male' as 'Male' | 'Female',
    age_group: 'Open',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onCategoryChange = (cat: string) => {
    let gender: 'Male' | 'Female' = 'Male';
    let ageGroup = 'Open';
    if (cat.includes('Women') || cat.includes('Girls')) gender = 'Female';
    if (cat.includes('U/17')) ageGroup = 'U/17';
    else if (cat.includes('U/14')) ageGroup = 'U/14';
    else if (cat.includes('U/12')) ageGroup = 'U/12';
    else if (cat.includes('U/10')) ageGroup = 'U/10';
    setForm({ ...form, category: cat, gender, age_group: ageGroup });
  };

  const handleEdit = (ev: SwimEvent) => {
    setEditing(ev);
    setForm({
      category: ev.category,
      event_name: ev.event_name,
      stroke: ev.stroke,
      distance: ev.distance,
      gender: ev.gender,
      age_group: ev.age_group,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_name.trim()) {
      setError('Event name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const { error: err } = await supabase.from('events').update({
          category: form.category,
          event_name: form.event_name.trim(),
          stroke: form.stroke,
          distance: form.distance,
          gender: form.gender,
          age_group: form.age_group,
        }).eq('id', editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('events').insert({
          category: form.category,
          event_name: form.event_name.trim(),
          stroke: form.stroke,
          distance: Number(form.distance),
          gender: form.gender,
          age_group: form.age_group,
        });
        if (err) throw err;
      }
      await reload();
      setShowForm(false);
      setEditing(null);
      setForm({ category: 'Men', event_name: '', stroke: 'Free style', distance: 50, gender: 'Male', age_group: 'Open' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event? This will also delete related registrations and heats.')) return;
    await supabase.from('events').delete().eq('id', id);
    await reload();
  };

  const grouped = events.reduce<Record<string, SwimEvent[]>>((acc, ev) => {
    if (!acc[ev.category]) acc[ev.category] = [];
    acc[ev.category].push(ev);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
          <p className="text-slate-500 mt-1">Add, edit, or remove swimming events</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ category: 'Men', event_name: '', stroke: 'Free style', distance: 50, gender: 'Male', age_group: 'Open' }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Event
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">{editing ? 'Edit Event' : 'Add Event'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => onCategoryChange(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Event Name</label>
                <input type="text" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500" placeholder="e.g. 50mt Free style" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Stroke</label>
                  <select value={form.stroke} onChange={(e) => setForm({ ...form, stroke: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
                    {STROKES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Distance (m)</label>
                  <input type="number" value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
                {editing ? 'Update Event' : 'Add Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, evs]) => (
            <div key={category} className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
              <div className="bg-slate-800 px-5 py-3">
                <h3 className="font-bold text-white">{category} <span className="text-slate-400 text-sm font-normal">({evs.length})</span></h3>
              </div>
              <div className="divide-y divide-slate-100">
                {evs.map((ev) => (
                  <div key={ev.id} className="flex items-center px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{ev.event_name}</div>
                      <div className="text-xs text-slate-500">{ev.stroke} · {ev.distance}m · {ev.gender}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(ev)} className="p-2 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(ev.id)} className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
