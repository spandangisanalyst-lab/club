import { useState, useEffect } from 'react';
import { Users, Search, Edit2, CheckCircle, XCircle, Trash2, UserPlus, Loader2, FileText, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SettingsMap } from '../../lib/types';

interface Props {
  settings: SettingsMap;
}

export default function AdminParticipantsMerged({ settings }: Props) {
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data states
  const [participants, setParticipants] = useState<any[]>([]);
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 1. Centralized Age Calculation matching the exact database format
  const calculateAgeDetails = (dobString: string, gender: string) => {
    if (!dobString || !gender) return { formattedAge: 'N/A', baseGroup: 'N/A', eventCategory: 'N/A' };
    
    const targetDate = new Date('2026-08-15');
    const dob = new Date(dobString);
    
    let years = targetDate.getFullYear() - dob.getFullYear();
    let months = targetDate.getMonth() - dob.getMonth();
    let days = targetDate.getDate() - dob.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const formattedAge = `${years.toString().padStart(2, '0')}:${months.toString().padStart(2, '0')}:${days.toString().padStart(2, '0')}`;
    
    const isMale = gender.toLowerCase() === 'male';
    const suffix = isMale ? 'Boys' : 'Girls';
    
    // Default for 17 and above is "Open" group, mapping to "Men" or "Women" category
    let baseGroup = 'Open'; 
    let eventCategory = isMale ? 'Men' : 'Women'; 
    
    if (years < 10) {
      baseGroup = 'U/10';
      eventCategory = `U/10 ${suffix}`;
    } else if (years < 12) {
      baseGroup = 'U/12';
      eventCategory = `U/12 ${suffix}`;
    } else if (years < 14) {
      baseGroup = 'U/14';
      eventCategory = `U/14 ${suffix}`;
    } else if (years < 17) {
      baseGroup = 'U/17';
      eventCategory = `U/17 ${suffix}`;
    }

    return { formattedAge, baseGroup, eventCategory };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [participantsRes, clubsRes, registrationsRes, eventsRes] = await Promise.all([
        supabase.from('participants').select('*').order('created_at', { ascending: false }),
        supabase.from('clubs').select('*'),
        supabase.from('registrations').select('*'),
        supabase.from('events').select('*')
      ]);

      if (participantsRes.error) throw participantsRes.error;

      const pData = participantsRes.data || [];
      const cData = clubsRes.data || [];
      const rData = registrationsRes.data || [];
      const eData = eventsRes.data || [];

      setAllClubs(cData);
      setAllEvents(eData);
      setAllRegistrations(rData);

      const mergedData = pData.map(p => {
        let finalClubName = p.club_name || p.club || 'N/A';
        if (p.club_id) {
          const foundClub = cData.find(c => String(c.id) === String(p.club_id));
          if (foundClub) finalClubName = foundClub.name || foundClub.title || finalClubName;
        }

        const { formattedAge, baseGroup, eventCategory } = calculateAgeDetails(p.date_of_birth || p.dob, p.gender);

        let registeredEventsText = 'No events registered';
        const userRegs = rData.filter(r => String(r.participant_id) === String(p.id));
        
        if (userRegs.length > 0) {
          const userEvents = userRegs.map(r => {
            const ev = eData.find(e => String(e.id) === String(r.event_id));
            return ev ? (ev.event_name || ev.title || ev.name || 'Unknown Event') : null;
          }).filter(Boolean);

          if (userEvents.length > 0) registeredEventsText = userEvents.join(', ');
        }

        return {
          ...p,
          display_club: finalClubName,
          display_events: registeredEventsText,
          calculated_age: formattedAge,
          calculated_group: baseGroup,
          calculated_category: eventCategory
        };
      });

      setParticipants(mergedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load participants from database.');
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const pStatus = p.status || 'approved'; 
    const matchesTab = pStatus === activeTab;
    const nameStr = p.name || p.full_name || '';
    const clubStr = p.display_club || '';
    
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          clubStr.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    // Database doesn't have a status column, so we only update the local interface array
    setParticipants(participants.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to completely remove this participant? This action cannot be undone.')) {
      try {
        const { error } = await supabase.from('participants').delete().eq('id', id);
        if (error) throw error;
        setParticipants(participants.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting participant:', error);
        alert('Failed to delete participant.');
      }
    }
  };

  const handleAddClick = () => {
    setIsAddingNew(true);
    setSaveError('');
    setEditingParticipant({
      name: '',
      date_of_birth: '',
      gender: '',
      club_id: '',
      selected_events: [],
      status: 'approved'
    });
  };

  const handleEditClick = (p: any) => {
    setIsAddingNew(false);
    setSaveError('');
    
    const userRegs = allRegistrations.filter(r => String(r.participant_id) === String(p.id));
    const currentEventIds = userRegs.map(r => String(r.event_id));

    setEditingParticipant({
      ...p, 
      name: p.name || p.full_name,
      selected_events: currentEventIds
    });
  };

  const handleEventToggle = (eventId: string) => {
    const isSelected = editingParticipant.selected_events.includes(eventId);
    if (isSelected) {
      setEditingParticipant({
        ...editingParticipant,
        selected_events: editingParticipant.selected_events.filter((id: string) => id !== eventId)
      });
    } else {
      if (editingParticipant.selected_events.length >= 3) return; // Max 3 events rule
      setEditingParticipant({
        ...editingParticipant,
        selected_events: [...editingParticipant.selected_events, eventId]
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;
    setSaveError('');
    setIsSaving(true);
    
    try {
      const { selected_events, club_id } = editingParticipant;
      
      if (!club_id) throw new Error("Please select a club.");

      // Validate Club Limit (Max 2 participants per club per event)
      for (const eventId of selected_events) {
        const existingClubRegs = allRegistrations.filter(r => 
          String(r.event_id) === String(eventId) && 
          String(r.club_id) === String(club_id) && 
          String(r.participant_id) !== String(editingParticipant.id) 
        );
        
        if (existingClubRegs.length >= 2) {
          const eventName = allEvents.find(ev => String(ev.id) === String(eventId))?.event_name || 'Unknown Event';
          throw new Error(`Rule Violation: The selected club already has 2 participants registered for "${eventName}".`);
        }
      }

      // Payload specifically omitting `status` because it's not in the database table schema
      const participantPayload = {
        name: editingParticipant.name,
        gender: editingParticipant.gender,
        date_of_birth: editingParticipant.date_of_birth,
        club_id: club_id
      };

      let participantId = editingParticipant.id;

      if (isAddingNew) {
        const { data, error } = await supabase.from('participants').insert([participantPayload]).select().single();
        if (error) throw error;
        participantId = data.id;
      } else {
        const { error } = await supabase.from('participants').update(participantPayload).eq('id', participantId);
        if (error) throw error;
      }

      // Update Registrations
      await supabase.from('registrations').delete().eq('participant_id', participantId);
      
      if (selected_events.length > 0) {
        const regPayload = selected_events.map((evId: string) => ({
          participant_id: participantId,
          event_id: evId,
          club_id: club_id
        }));
        const { error: regError } = await supabase.from('registrations').insert(regPayload);
        if (regError) throw regError;
      }

      await fetchData(); 
      setEditingParticipant(null);
      setIsAddingNew(false);
    } catch (error: any) {
      console.error('Error saving participant:', error);
      setSaveError(error.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const derivedCategory = calculateAgeDetails(editingParticipant?.date_of_birth, editingParticipant?.gender).eventCategory;
  
  // Filter exact match to the database `category` column, PLUS strictly "Open" 1000m events for their gender
  const availableEvents = allEvents.filter(e => {
    const matchesExactCategory = String(e.category).toLowerCase() === String(derivedCategory).toLowerCase();
    
    const eventName = String(e.event_name || e.title || e.name).toLowerCase();
    const isOpen1000m = eventName.includes('1000') && 
                        String(e.age_group).toLowerCase() === 'open' && 
                        String(e.gender).toLowerCase() === String(editingParticipant?.gender).toLowerCase();

    return matchesExactCategory || isOpen1000m;
  });

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Participants & Registrations</h2>
          <p className="text-slate-500 text-sm mt-1">Manage swimmers, events, documents, and approvals.</p>
        </div>
        <button 
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Participant
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approved' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Approved Participants
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Pending Registrations
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Club</th>
                  <th className="px-6 py-3">Age (YY:MM:DD)</th>
                  <th className="px-6 py-3">Age Group</th>
                  <th className="px-6 py-3">Gender</th>
                  <th className="px-6 py-3">Registered Events</th>
                  <th className="px-6 py-3">Document</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No participants found.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => {
                    const name = p.name || p.full_name || 'N/A';
                    const gender = p.gender || 'N/A';
                    const docUrl = p.document_url || p.id_proof || p.file_url || null;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{name}</td>
                        <td className="px-6 py-4">{p.display_club}</td>
                        <td className="px-6 py-4 font-mono text-slate-600">{p.calculated_age}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded-md text-xs font-bold shadow-sm whitespace-nowrap">
                            {p.calculated_group}
                          </span>
                        </td>
                        <td className="px-6 py-4 capitalize">{gender}</td>
                        <td className="px-6 py-4 max-w-[200px] truncate" title={p.display_events}>
                          {p.display_events}
                        </td>
                        <td className="px-6 py-4">
                          {docUrl ? (
                            <a href={docUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-600 hover:text-cyan-800 font-medium">
                              <FileText className="w-4 h-4" /> View Doc
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No document</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          {activeTab === 'pending' ? (
                            <>
                              <button onClick={() => handleStatusChange(p.id, 'approved')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve">
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject">
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEditClick(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Edit/Add Modal */}
      {editingParticipant && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {isAddingNew ? 'Add New Participant' : 'Edit Participant Details'}
              </h3>
              <button onClick={() => { setEditingParticipant(null); setIsAddingNew(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto">
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{saveError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingParticipant.name || ''}
                    onChange={(e) => setEditingParticipant({...editingParticipant, name: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Club</label>
                  <select
                    required
                    value={editingParticipant.club_id || ''}
                    onChange={(e) => setEditingParticipant({...editingParticipant, club_id: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">-- Select Club --</option>
                    {allClubs.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={editingParticipant.date_of_birth || ''}
                    onChange={(e) => {
                      setEditingParticipant({
                        ...editingParticipant, 
                        date_of_birth: e.target.value,
                        selected_events: [] 
                      })
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    required
                    value={editingParticipant.gender || ''}
                    onChange={(e) => {
                      setEditingParticipant({
                        ...editingParticipant, 
                        gender: e.target.value,
                        selected_events: [] 
                      })
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {/* Event Selection Area */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-900">Select Events</label>
                    <p className="text-xs text-slate-500">
                      Auto-filtered for <span className="font-bold text-cyan-700">{derivedCategory}</span> (and Open 1000m events). Max 3 per person.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">
                    {editingParticipant.selected_events.length} / 3 Selected
                  </span>
                </div>

                {(!editingParticipant.date_of_birth || !editingParticipant.gender) ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm text-slate-500">
                    Please fill out Date of Birth and Gender to see available events.
                  </div>
                ) : availableEvents.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center text-sm text-amber-700">
                    No events found in the database for the category <b>{derivedCategory}</b>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availableEvents.map(ev => {
                      const isSelected = editingParticipant.selected_events.includes(String(ev.id));
                      const isDisabled = !isSelected && editingParticipant.selected_events.length >= 3;
                      
                      return (
                        <label 
                          key={ev.id} 
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-cyan-50 border-cyan-300' : 
                            isDisabled ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 
                            'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-cyan-600"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => handleEventToggle(String(ev.id))}
                          />
                          <span className={`text-sm font-medium flex flex-col ${isSelected ? 'text-cyan-900' : 'text-slate-700'}`}>
                            {ev.event_name || ev.title || ev.name}
                            <span className="text-[10px] text-slate-400 font-normal">{ev.category} {ev.age_group === 'Open' ? '(Open)' : ''}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingParticipant(null); setIsAddingNew(false); }}
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {isAddingNew ? 'Add Participant' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}