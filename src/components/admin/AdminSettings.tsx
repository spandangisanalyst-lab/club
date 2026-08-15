import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle2, Plus, Trash2, X, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClubs } from '../../lib/useClubs';
import type { SettingsMap } from '../../lib/types';
import { EDITABLE_SETTING_KEYS, SETTING_LABELS } from '../../lib/constants';

interface Props {
  settings: SettingsMap;
}

export default function AdminSettings({ settings }: Props) {
  const { clubs, reload: reloadClubs } = useClubs();
  const [form, setForm] = useState<SettingsMap>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newClub, setNewClub] = useState('');
  const [addingClub, setAddingClub] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updates = EDITABLE_SETTING_KEYS.map((key) => ({
        key,
        value: form[key] || '',
        updated_at: new Date().toISOString(),
      }));
      // Upsert each setting
      for (const u of updates) {
        const { data: existing } = await supabase.from('settings').select('key').eq('key', u.key).maybeSingle();
        if (existing) {
          await supabase.from('settings').update({ value: u.value, updated_at: u.updated_at }).eq('key', u.key);
        } else {
          await supabase.from('settings').insert({ key: u.key, value: u.value });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddClub = async () => {
    if (!newClub.trim()) return;
    setAddingClub(true);
    try {
      const { error } = await supabase.from('clubs').insert({ name: newClub.trim(), status: 'approved' });
      if (error) {
        if (error.code === '23505') {
          alert('A club with this name already exists.');
        } else {
          alert(error.message);
        }
      } else {
        setNewClub('');
        await reloadClubs();
      }
    } finally {
      setAddingClub(false);
    }
  };

  const handleDeleteClub = async (id: string, name: string) => {
    if (!confirm(`Delete club "${name}"? This will also delete all its participants and registrations.`)) return;
    await supabase.from('clubs').delete().eq('id', id);
    await reloadClubs();
  };

  const handleRenameClub = async (id: string, name: string) => {
    const newName = prompt('Enter new club name:', name);
    if (newName && newName.trim() && newName.trim() !== name) {
      await supabase.from('clubs').update({ name: newName.trim() }).eq('id', id);
      await reloadClubs();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website Editor</h1>
          <p className="text-slate-500 mt-1">Edit website content — changes update automatically on the live site</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Changes saved successfully. The website has been updated automatically.
        </div>
      )}

      {/* Content settings */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-600" /> Website Content
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EDITABLE_SETTING_KEYS.map((key) => (
            <div key={key} className={key === 'about_text' ? 'sm:col-span-2' : ''}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{SETTING_LABELS[key]}</label>
              {key === 'about_text' ? (
                <textarea
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500 resize-y"
                />
              ) : (
                <input
                  type={key === 'event_date' ? 'date' : key === 'registration_deadline' ? 'datetime-local' : 'text'}
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Club management */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-600" /> Club Management
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newClub}
            onChange={(e) => setNewClub(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddClub()}
            placeholder="Add new club name..."
            className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleAddClub}
            disabled={addingClub || !newClub.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {addingClub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Club
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {clubs.length === 0 ? (
            <div className="py-6 text-center text-slate-400">No clubs added yet.</div>
          ) : (
            clubs.map((club) => (
              <div key={club.id} className="py-3 group">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-sm mr-3">
                    {club.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{club.name}</div>
                    {club.manager_name && (
                      <div className="text-xs text-slate-500">Manager: {club.manager_name}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRenameClub(club.id, club.name)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Rename</button>
                    <button onClick={() => handleDeleteClub(club.id, club.name)} className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {(club.manager_email || club.manager_phone || club.address) && (
                  <div className="flex flex-wrap gap-4 ml-11 mt-1.5 text-xs text-slate-500">
                    {club.manager_email && (
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {club.manager_email}</span>
                    )}
                    {club.manager_phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {club.manager_phone}</span>
                    )}
                    {club.address && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {club.address}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
