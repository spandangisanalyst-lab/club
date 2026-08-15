import { useState, useMemo, useEffect } from 'react';
import {
  UserPlus, CheckCircle2, AlertCircle, Upload, Loader2, Calendar, X,
  Building2, Users, Phone, Mail, MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEvents } from '../lib/useEvents';
import { useClubs } from '../lib/useClubs';
import type { SettingsMap, SwimEvent, Club } from '../lib/types';
import {
  REGISTRATION_DEADLINE,
  getEligibleEvents,
  ageGroupForParticipant,
} from '../lib/constants';
import { formatDate, calculateAge, cn } from '../lib/utils';

interface Props {
  settings: SettingsMap;
}

interface FormData {
  name: string;
  gender: 'Male' | 'Female';
  date_of_birth: string;
  club_id: string;
  document_url: string;
  selectedEvents: string[];
}

interface ClubFormData {
  name: string;
  manager_name: string;
  manager_email: string;
  manager_phone: string;
  address: string;
}

type Tab = 'participant' | 'club';

export default function RegistrationPage({ settings }: Props) {
  const [tab, setTab] = useState<Tab>('participant');
  const { events, loading: eventsLoading } = useEvents();
  const { clubs, loading: clubsLoading, reload: reloadClubs } = useClubs();
  const [form, setForm] = useState<FormData>({
    name: '',
    gender: 'Male',
    date_of_birth: '',
    club_id: '',
    document_url: '',
    selectedEvents: [],
  });
  const [clubForm, setClubForm] = useState<ClubFormData>({
    name: '',
    manager_name: '',
    manager_email: '',
    manager_phone: '',
    address: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clubSubmitting, setClubSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clubError, setClubError] = useState('');
  const [success, setSuccess] = useState(false);
  const [clubSuccess, setClubSuccess] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const [registeredClub, setRegisteredClub] = useState('');

  const maxEvents = parseInt(settings.max_events_per_participant || '3', 10);
  const maxPerClub = parseInt(settings.max_participants_per_club_per_event || '2', 10);
  const registrationClosed = new Date() > REGISTRATION_DEADLINE;

  const ageGroup = useMemo(() => {
    if (!form.date_of_birth) return null;
    return ageGroupForParticipant(form.date_of_birth, form.gender);
  }, [form.date_of_birth, form.gender]);

  const eligibleEvents = useMemo(() => {
    if (!form.date_of_birth || !form.gender) return [];
    return getEligibleEvents(events, form.date_of_birth, form.gender);
  }, [events, form.date_of_birth, form.gender]);

  const age = form.date_of_birth ? calculateAge(form.date_of_birth) : null;

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const fileName = `docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setForm((f) => ({ ...f, document_url: urlData.publicUrl }));
    } catch (err) {
      setError(`Failed to upload document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setForm((f) => {
      const isSelected = f.selectedEvents.includes(eventId);
      if (isSelected) {
        return { ...f, selectedEvents: f.selectedEvents.filter((id) => id !== eventId) };
      }
      if (f.selectedEvents.length >= maxEvents) {
        return f;
      }
      return { ...f, selectedEvents: [...f.selectedEvents, eventId] };
    });
  };

  const handleClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClubError('');

    if (registrationClosed) {
      setClubError('Registration has closed. The deadline was 13th August 2026, 11:59 PM.');
      return;
    }
    if (!clubForm.name.trim()) {
      setClubError('Please enter the club name.');
      return;
    }
    if (!clubForm.manager_name.trim()) {
      setClubError('Please enter the manager name.');
      return;
    }
    if (!clubForm.manager_email.trim() && !clubForm.manager_phone.trim()) {
      setClubError('Please provide at least an email or phone number.');
      return;
    }

    setClubSubmitting(true);
    try {
      const { error: err } = await supabase.from('clubs').insert({
        name: clubForm.name.trim(),
        manager_name: clubForm.manager_name.trim(),
        manager_email: clubForm.manager_email.trim() || null,
        manager_phone: clubForm.manager_phone.trim() || null,
        address: clubForm.address.trim() || null,
        status: 'approved',
      });
      if (err) {
        if (err.code === '23505') {
          setClubError('A club with this name already exists. Please use a different name or contact the organizer.');
        } else {
          throw err;
        }
        setClubSubmitting(false);
        return;
      }
      await reloadClubs();
      setRegisteredClub(clubForm.name.trim());
      setClubSuccess(true);
      setClubForm({ name: '', manager_name: '', manager_email: '', manager_phone: '', address: '' });
    } catch (err) {
      setClubError(`Club registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setClubSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registrationClosed) {
      setError('Registration has closed. The deadline was 13th August 2026, 11:59 PM.');
      return;
    }
    if (!form.name.trim()) {
      setError('Please enter the participant name.');
      return;
    }
    if (!form.date_of_birth) {
      setError('Please enter the date of birth.');
      return;
    }
    if (!form.club_id) {
      setError('Please select a club.');
      return;
    }
    if (!form.document_url) {
      setError('Please upload a birth certificate or ID document.');
      return;
    }
    if (form.selectedEvents.length === 0) {
      setError('Please select at least one event.');
      return;
    }
    if (form.selectedEvents.length > maxEvents) {
      setError(`A participant can enter a maximum of ${maxEvents} events.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('name', form.name.trim())
        .eq('date_of_birth', form.date_of_birth)
        .eq('club_id', form.club_id)
        .maybeSingle();

      if (existing) {
        setError(`A participant with this name, date of birth, and club has already been registered. Duplicate entries are not allowed. Please check your details or contact the organizer.`);
        setSubmitting(false);
        return;
      }

      const { data: newPart, error: partError } = await supabase
        .from('participants')
        .insert({
          name: form.name.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          club_id: form.club_id,
          document_url: form.document_url,
          verified: false,
        })
        .select('id')
        .single();
      if (partError) throw partError;
      const participantId = newPart.id;

      for (const eventId of form.selectedEvents) {
        const { data: dupReg } = await supabase
          .from('registrations')
          .select('id')
          .eq('participant_id', participantId)
          .eq('event_id', eventId)
          .maybeSingle();
        if (dupReg) {
          setError(`Duplicate entry: ${form.name} is already registered for this event.`);
          setSubmitting(false);
          return;
        }

        const { data: clubRegs, error: clubErr } = await supabase
          .from('registrations')
          .select('id, participant_id')
          .eq('event_id', eventId)
          .eq('club_id', form.club_id);
        if (clubErr) throw clubErr;
        if ((clubRegs?.length || 0) >= maxPerClub) {
          const ev = events.find((e) => e.id === eventId);
          setError(`Event "${ev?.event_name}" already has ${maxPerClub} participants from this club. Limit reached.`);
          setSubmitting(false);
          return;
        }
      }

      const regRows = form.selectedEvents.map((eventId) => ({
        participant_id: participantId,
        event_id: eventId,
        club_id: form.club_id,
      }));
      const { error: regError } = await supabase.from('registrations').insert(regRows);
      if (regError) throw regError;

      setRegisteredName(form.name.trim());
      setSuccess(true);
      setForm({
        name: '',
        gender: 'Male',
        date_of_birth: '',
        club_id: '',
        document_url: '',
        selectedEvents: [],
      });
    } catch (err) {
      setError(`Registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Successful!</h2>
          <p className="text-slate-600 mb-6">
            {registeredName} has been registered for the selected events. Please check the Results page after the competition for outcomes.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
          >
            Register Another Participant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <UserPlus className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Registration</h1>
          <p className="text-slate-400">
            Registration closes on {formatDate(settings.registration_deadline)}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {registrationClosed && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div className="text-red-800">
              <strong>Registration Closed.</strong> The deadline was 13th August 2026, 11:59 PM.
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 p-1.5 bg-slate-200/60 rounded-2xl">
          <button
            onClick={() => setTab('participant')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all',
              tab === 'participant'
                ? 'bg-white text-cyan-700 shadow-md'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <UserPlus className="w-5 h-5" />
            Participant Registration
          </button>
          <button
            onClick={() => setTab('club')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all',
              tab === 'club'
                ? 'bg-white text-cyan-700 shadow-md'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Building2 className="w-5 h-5" />
            Club Registration
          </button>
        </div>

        {/* ===== CLUB REGISTRATION TAB ===== */}
        {tab === 'club' && (
          <>
            {clubSuccess ? (
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Club Registered!</h2>
                <p className="text-slate-600 mb-6">
                  <strong>{registeredClub}</strong> has been registered successfully. Participants can now select this club from the dropdown during participant registration.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setClubSuccess(false)}
                    className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors"
                  >
                    Register Another Club
                  </button>
                  <button
                    onClick={() => { setClubSuccess(false); setTab('participant'); }}
                    className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Register a Participant
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Club managers register their club here. Once registered, participants can immediately select the club from the dropdown during participant registration.
                  </p>
                </div>
                <form onSubmit={handleClubSubmit} className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
                  {clubError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                      <div className="text-red-800 text-sm">{clubError}</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Club Name *</label>
                    <input
                      type="text"
                      value={clubForm.name}
                      onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                      disabled={registrationClosed || clubSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                      placeholder="Enter club name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Manager / Representative Name *</label>
                    <input
                      type="text"
                      value={clubForm.manager_name}
                      onChange={(e) => setClubForm({ ...clubForm, manager_name: e.target.value })}
                      disabled={registrationClosed || clubSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                      placeholder="Enter manager full name"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <Mail className="w-4 h-4 inline mr-1" /> Email
                      </label>
                      <input
                        type="email"
                        value={clubForm.manager_email}
                        onChange={(e) => setClubForm({ ...clubForm, manager_email: e.target.value })}
                        disabled={registrationClosed || clubSubmitting}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                        placeholder="manager@club.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-1" /> Phone
                      </label>
                      <input
                        type="tel"
                        value={clubForm.manager_phone}
                        onChange={(e) => setClubForm({ ...clubForm, manager_phone: e.target.value })}
                        disabled={registrationClosed || clubSubmitting}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                        placeholder="+91 00000 00000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <MapPin className="w-4 h-4 inline mr-1" /> Club Address
                    </label>
                    <textarea
                      value={clubForm.address}
                      onChange={(e) => setClubForm({ ...clubForm, address: e.target.value })}
                      disabled={registrationClosed || clubSubmitting}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100 resize-y"
                      placeholder="Enter club address (optional)"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={clubSubmitting || registrationClosed}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {clubSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Building2 className="w-5 h-5" />
                        Register Club
                      </>
                    )}
                  </button>
                </form>

                {/* List of registered clubs */}
                {!clubsLoading && clubs.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Registered Clubs</h3>
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200 divide-y divide-slate-100">
                      {clubs.map((c: Club) => (
                        <div key={c.id} className="flex items-center px-5 py-3">
                          <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-sm mr-3">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{c.name}</div>
                            {c.manager_name && (
                              <div className="text-xs text-slate-500">Manager: {c.manager_name}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ===== PARTICIPANT REGISTRATION TAB ===== */}
        {tab === 'participant' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Participant Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={registrationClosed}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                placeholder="Enter full name"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gender *</label>
              <div className="flex gap-3">
                {(['Male', 'Female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g })}
                    disabled={registrationClosed}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all disabled:cursor-not-allowed ${
                      form.gender === g
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* DOB */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth *</label>
              <div className="relative">
                <Calendar className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => {
                    setForm({ ...form, date_of_birth: e.target.value, selectedEvents: [] });
                  }}
                  disabled={registrationClosed}
                  max="2026-08-15"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100"
                />
              </div>
              {age !== null && ageGroup && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Age on event day: <strong>{age}</strong> years</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium text-xs">
                    Category: {ageGroup.label}
                  </span>
                </div>
              )}
            </div>

            {/* Club */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Club *</label>
              {clubsLoading ? (
                <div className="text-slate-400 text-sm">Loading clubs...</div>
              ) : clubs.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <Users className="w-4 h-4 inline mr-1" />
                  No clubs registered yet. Please ask your club manager to register the club first using the "Club Registration" tab above.
                </div>
              ) : (
                <>
                  <select
                    value={form.club_id}
                    onChange={(e) => setForm({ ...form, club_id: e.target.value })}
                    disabled={registrationClosed}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100 bg-white"
                  >
                    <option value="">Select a club</option>
                    {clubs.map((c: Club) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Don't see your club? Switch to the "Club Registration" tab to register it first.
                  </p>
                </>
              )}
            </div>

            {/* Document upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Birth Certificate / ID Document *
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-cyan-400 transition-colors">
                {form.document_url ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Document uploaded successfully</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, document_url: '' })}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : uploading ? (
                  <div className="flex items-center justify-center gap-2 text-cyan-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <div className="text-sm text-slate-600">Click to upload birth certificate or ID</div>
                    <div className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={registrationClosed || uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file);
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                The uploaded document will be checked against entered details during verification.
              </p>
            </div>

            {/* Event selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Events * ({form.selectedEvents.length}/{maxEvents} selected)
              </label>
              {!form.date_of_birth || !form.gender ? (
                <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500 text-center">
                  Enter date of birth and gender to see eligible events.
                </div>
              ) : eligibleEvents.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  No events available for this age group and gender.
                </div>
              ) : (
                <div className="space-y-2">
                  {eligibleEvents.map((event: SwimEvent) => {
                    const isSelected = form.selectedEvents.includes(event.id);
                    const disabled = !isSelected && form.selectedEvents.length >= maxEvents;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => toggleEvent(event.id)}
                        disabled={registrationClosed || disabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-slate-200 hover:border-cyan-300 bg-white'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{event.event_name}</div>
                          <div className="text-xs text-slate-500">{event.stroke} · {event.distance}m</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || registrationClosed}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Submit Registration
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
