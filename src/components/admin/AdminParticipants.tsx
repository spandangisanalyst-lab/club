import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Loader2, Users, Search, CheckCircle2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useParticipants } from '../../lib/useParticipants';
import { useClubs } from '../../lib/useClubs';
import type { SettingsMap, Participant, Club } from '../../lib/types';
import { ageGroupForParticipant } from '../../lib/constants';
import { calculateAge } from '../../lib/utils';

interface Props {
  settings: SettingsMap;
}

export default function AdminParticipants({ settings }: Props) {
  const { participants, loading, reload } = useParticipants();
  const { clubs } = useClubs();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', gender: 'Male' as 'Male' | 'Female', date_of_birth: '', club_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clubMap = new Map(clubs.map((c) => [c.id, c] as [string, Club]));

  const handleEdit = (p: Participant) => {
    setEditing(p);
    setForm({ name: p.name, gender: p.gender, date_of_birth: p.date_of_birth, club_id: p.club_id });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date_of_birth || !form.club_id) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const { error: err } = await supabase.from('participants').update({
          name: form.name.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          club_id: form.club_id,
        }).eq('id', editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('participants').insert({
          name: form.name.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          club_id: form.club_id,
        });
        if (err) throw err;
      }
      await reload();
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', gender: 'Male', date_of_birth: '', club_id: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save participant');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this participant? This will also delete their registrations.')) return;
    await supabase.from('participants').delete().eq('id', id);
    await reload();
  };

  const toggleVerified = async (p: Participant) => {
    await supabase.from('participants').update({ verified: !p.verified }).eq('id', p.id);
    await reload();
  };

  const filtered = participants.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (clubMap.get(p.club_id)?.name || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Participants</h1>
          <p className="text-slate-500 mt-1">{participants.length} registered</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ name: '', gender: 'Male', date_of_birth: '', club_id: '' }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Participant
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or club..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-cyan-500 bg-white" />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">{editing ? 'Edit Participant' : 'Add Participant'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                <div className="flex gap-3">
                  {(['Male', 'Female'] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setForm({ ...form, gender: g })} className={`flex-1 px-4 py-2.5 rounded-lg border-2 font-medium ${form.gender === g ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 text-slate-600'}`}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} max="2026-08-15" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Club</label>
                <select value={form.club_id} onChange={(e) => setForm({ ...form, club_id: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 bg-white">
                  <option value="">Select club</option>
                  {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                {editing ? 'Update' : 'Add'} Participant
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Club</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Gender</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Age</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Doc</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Verified</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const age = calculateAge(p.date_of_birth);
                  const ag = ageGroupForParticipant(p.date_of_birth, p.gender);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">{clubMap.get(p.club_id)?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.gender}</td>
                      <td className="px-4 py-3 text-slate-600">{age}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-xs font-medium">{ag?.label || '-'}</span></td>
                      <td className="px-4 py-3 text-center">
                        {p.document_url ? <a href={p.document_url} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-800"><ExternalLink className="w-4 h-4 mx-auto" /></a> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleVerified(p)} className={`p-1.5 rounded-lg transition-colors ${p.verified ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-slate-300 hover:bg-slate-100'}`}>
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleEdit(p)} className="p-2 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-600"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
