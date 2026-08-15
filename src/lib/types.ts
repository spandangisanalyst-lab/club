export interface Club {
  id: string;
  name: string;
  manager_name?: string | null;
  manager_email?: string | null;
  manager_phone?: string | null;
  address?: string | null;
  status?: 'pending' | 'approved';
  created_at?: string;
}

export interface Participant {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  date_of_birth: string;
  club_id: string;
  document_url?: string | null;
  verified?: boolean;
  created_at?: string;
}

export interface SwimEvent {
  id: string;
  category: string;
  event_name: string;
  stroke: string;
  distance: number;
  gender: 'Male' | 'Female';
  age_group: string;
  created_at?: string;
}

export interface Registration {
  id: string;
  participant_id: string;
  event_id: string;
  club_id: string;
  created_at?: string;
}

export interface Heat {
  id: string;
  event_id: string;
  heat_number: number;
  status: 'created' | 'attendance' | 'lanes_assigned' | 'racing' | 'finished';
  created_at?: string;
}

export interface HeatEntry {
  id: string;
  heat_id: string;
  participant_id: string;
  lane_number: number | null;
  present: boolean;
  finish_time_ms: number | null;
  finish_position: number | null;
  overall_rank: number | null;
  medal: 'Gold' | 'Silver' | 'Bronze' | null;
  created_at?: string;
}

export interface RaceState {
  id: string;
  heat_id: string;
  status: 'idle' | 'countdown' | 'running' | 'finished';
  start_time: string | null;
  updated_at?: string;
}

export interface Setting {
  key: string;
  value: string | null;
  updated_at?: string;
}

export type SettingsMap = Record<string, string>;

export interface RegistrationWithDetails extends Registration {
  participant?: Participant;
  event?: SwimEvent;
  club?: Club;
}

export interface HeatEntryWithDetails extends HeatEntry {
  participant?: Participant;
  heat?: Heat;
}
