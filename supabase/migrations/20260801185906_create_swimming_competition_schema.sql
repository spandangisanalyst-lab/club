/*
# 43rd Inter Club Swimming Competition - Full Schema

## Overview
Complete database schema for the 43rd Inter Club Swimming Competition organized by
Cooch Behar Town Club at Cooch Behar Rajbari Stadium Swimming Pool Complex on 15th August 2026.

## New Tables
1. **clubs** - Swimming clubs participating in the competition
2. **participants** - Individual swimmers registered with their details
3. **events** - Swimming events (races) organized by category (Men, Women, U/17, U/14, U/12, U/10)
4. **registrations** - Maps participants to events they're competing in
5. **heats** - Heat groupings for events with more participants than available lanes
6. **heat_entries** - Lane assignments and results for each participant in each heat
7. **race_state** - Live race timing state for real-time sync across devices
8. **settings** - Website content and configuration (editable from admin panel)

## Security
- RLS enabled on ALL tables
- Policies allow anon + authenticated CRUD (no-auth app, admin password is client-side)
- Storage bucket 'documents' created for birth certificate / ID uploads

## Realtime
- race_state, heat_entries, heats, settings, results added to supabase_realtime publication
  for live timer sync across all devices worldwide

## Seed Data
- 30 events across 10 categories (Men, Women, U/17 Boys/Girls, U/14 Boys/Girls, U/12 Boys/Girls, U/10 Boys/Girls)
- Default website settings (title, organizer, venue, dates, etc.)
*/

-- ============ CLUBS ============
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_clubs" ON clubs;
CREATE POLICY "anon_crud_clubs" ON clubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_clubs" ON clubs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_clubs" ON clubs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_clubs" ON clubs FOR DELETE TO anon, authenticated USING (true);

-- ============ PARTICIPANTS ============
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  date_of_birth date NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  document_url text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, date_of_birth, club_id)
);
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_participants_club ON participants(club_id);
CREATE INDEX IF NOT EXISTS idx_participants_dob ON participants(date_of_birth);

DROP POLICY IF EXISTS "anon_crud_participants" ON participants;
CREATE POLICY "anon_crud_participants" ON participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_participants" ON participants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_participants" ON participants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_participants" ON participants FOR DELETE TO anon, authenticated USING (true);

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  event_name text NOT NULL,
  stroke text NOT NULL,
  distance int NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  age_group text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category, event_name)
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_age_group ON events(age_group);

DROP POLICY IF EXISTS "anon_crud_events" ON events;
CREATE POLICY "anon_crud_events" ON events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_events" ON events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_events" ON events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_events" ON events FOR DELETE TO anon, authenticated USING (true);

-- ============ REGISTRATIONS ============
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_id, event_id)
);
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reg_participant ON registrations(participant_id);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_club_event ON registrations(club_id, event_id);

DROP POLICY IF EXISTS "anon_crud_registrations" ON registrations;
CREATE POLICY "anon_crud_registrations" ON registrations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_registrations" ON registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_registrations" ON registrations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_registrations" ON registrations FOR DELETE TO anon, authenticated USING (true);

-- ============ HEATS ============
CREATE TABLE IF NOT EXISTS heats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  heat_number int NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attendance', 'lanes_assigned', 'racing', 'finished')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, heat_number)
);
ALTER TABLE heats ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_heats_event ON heats(event_id);

DROP POLICY IF EXISTS "anon_crud_heats" ON heats;
CREATE POLICY "anon_crud_heats" ON heats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_heats" ON heats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_heats" ON heats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_heats" ON heats FOR DELETE TO anon, authenticated USING (true);

-- ============ HEAT ENTRIES (lane assignments + results) ============
CREATE TABLE IF NOT EXISTS heat_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id uuid NOT NULL REFERENCES heats(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  lane_number int,
  present boolean DEFAULT true,
  finish_time_ms bigint,
  finish_position int,
  overall_rank int,
  medal text CHECK (medal IN ('Gold', 'Silver', 'Bronze')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(heat_id, participant_id)
);
ALTER TABLE heat_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_he_entries_heat ON heat_entries(heat_id);
CREATE INDEX IF NOT EXISTS idx_he_entries_event ON heat_entries(participant_id);
CREATE INDEX IF NOT EXISTS idx_he_entries_rank ON heat_entries(overall_rank);

DROP POLICY IF EXISTS "anon_crud_heat_entries" ON heat_entries;
CREATE POLICY "anon_crud_heat_entries" ON heat_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_heat_entries" ON heat_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_heat_entries" ON heat_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_heat_entries" ON heat_entries FOR DELETE TO anon, authenticated USING (true);

-- ============ RACE STATE (live timing sync) ============
CREATE TABLE IF NOT EXISTS race_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id uuid NOT NULL UNIQUE REFERENCES heats(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'countdown', 'running', 'finished')),
  start_time timestamptz,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE race_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_race_state" ON race_state;
CREATE POLICY "anon_crud_race_state" ON race_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_race_state" ON race_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_race_state" ON race_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_race_state" ON race_state FOR DELETE TO anon, authenticated USING (true);

-- ============ SETTINGS (website content editor) ============
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_settings" ON settings;
CREATE POLICY "anon_crud_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- ============ REALTIME PUBLICATION ============
ALTER PUBLICATION supabase_realtime ADD TABLE race_state;
ALTER PUBLICATION supabase_realtime ADD TABLE heat_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE heats;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;

-- ============ STORAGE BUCKET FOR DOCUMENTS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read documents" ON storage.objects;
CREATE POLICY "Public read documents" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Public upload documents" ON storage.objects;
CREATE POLICY "Public upload documents" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Public update documents" ON storage.objects;
CREATE POLICY "Public update documents" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Public delete documents" ON storage.objects;
CREATE POLICY "Public delete documents" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'documents');

-- ============ SEED: EVENTS ============
INSERT INTO events (category, event_name, stroke, distance, gender, age_group) VALUES
-- Men (Open, Male)
('Men', '100mt Free style', 'Free style', 100, 'Male', 'Open'),
('Men', '50mt Back', 'Back', 50, 'Male', 'Open'),
('Men', '50mt Butter fly', 'Butter fly', 50, 'Male', 'Open'),
('Men', '1000mt Free style', 'Free style', 1000, 'Male', 'Open'),
-- Women (Open, Female)
('Women', '50mt Free style', 'Free style', 50, 'Female', 'Open'),
('Women', '50mt Back strock', 'Back', 50, 'Female', 'Open'),
('Women', '50mt Breast strock', 'Breast strock', 50, 'Female', 'Open'),
-- U/17 Boys
('U/17 Boys', '50mt Back strock', 'Back', 50, 'Male', 'U/17'),
('U/17 Boys', '50mt Butter fly', 'Butter fly', 50, 'Male', 'U/17'),
('U/17 Boys', '100mt Free style', 'Free style', 100, 'Male', 'U/17'),
('U/17 Boys', '1000mt Free style', 'Free style', 1000, 'Male', 'U/17'),
-- U/17 Girls
('U/17 Girls', '50mt Free style', 'Free style', 50, 'Female', 'U/17'),
('U/17 Girls', '50mt Back strock', 'Back', 50, 'Female', 'U/17'),
('U/17 Girls', '50mt Breast strock', 'Breast strock', 50, 'Female', 'U/17'),
-- U/14 Boys
('U/14 Boys', '50mt Free style', 'Free style', 50, 'Male', 'U/14'),
('U/14 Boys', '50mt Back strock', 'Back', 50, 'Male', 'U/14'),
('U/14 Boys', '50mt Breast strock', 'Breast strock', 50, 'Male', 'U/14'),
('U/14 Boys', '1000mt Free style', 'Free style', 1000, 'Male', 'U/14'),
-- U/14 Girls
('U/14 Girls', '50mt Free style', 'Free style', 50, 'Female', 'U/14'),
('U/14 Girls', '50mt Back strock', 'Back', 50, 'Female', 'U/14'),
('U/14 Girls', '50mt Breast strock', 'Breast strock', 50, 'Female', 'U/14'),
-- U/12 Boys
('U/12 Boys', '50mt Free style', 'Free style', 50, 'Male', 'U/12'),
('U/12 Boys', '50mt Back strock', 'Back', 50, 'Male', 'U/12'),
('U/12 Boys', '50mt Breast strock', 'Breast strock', 50, 'Male', 'U/12'),
-- U/12 Girls
('U/12 Girls', '50mt Free style', 'Free style', 50, 'Female', 'U/12'),
('U/12 Girls', '50mt Back strock', 'Back', 50, 'Female', 'U/12'),
('U/12 Girls', '50mt Breast strock', 'Breast strock', 50, 'Female', 'U/12'),
-- U/10 Boys
('U/10 Boys', '50mt Free style', 'Free style', 50, 'Male', 'U/10'),
('U/10 Boys', '50mt Back strock', 'Back', 50, 'Male', 'U/10'),
-- U/10 Girls
('U/10 Girls', '50mt Free style', 'Free style', 50, 'Female', 'U/10'),
('U/10 Girls', '50mt Back strock', 'Back', 50, 'Female', 'U/10')
ON CONFLICT (category, event_name) DO NOTHING;

-- ============ SEED: SETTINGS ============
INSERT INTO settings (key, value) VALUES
('site_title', '43rd Inter Club Swimming Competition'),
('organizer', 'Cooch Behar Town Club'),
('venue', 'Cooch Behar Rajbari Stadium Swimming Pool Complex'),
('event_date', '2026-08-15'),
('registration_deadline', '2026-08-13T23:59'),
('hero_heading', '43rd Inter Club Swimming Competition'),
('hero_subheading', 'Organized by Cooch Behar Town Club at Cooch Behar Rajbari Stadium Swimming Pool Complex'),
('about_title', 'About the Competition'),
('about_text', 'The 43rd Inter Club Swimming Competition brings together swimmers from clubs across the region for a day of thrilling aquatic competition. Organized by Cooch Behar Town Club, this prestigious event celebrates excellence in swimming across multiple age categories. Join us on 15th August 2026 at the Cooch Behar Rajbari Stadium Swimming Pool Complex for a spectacular showcase of talent, speed, and sportsmanship.'),
('footer_text', 'Cooch Behar Town Club. All rights reserved.'),
('lane_count', '6'),
('championship_points', '7,5,4,3,2,1'),
('max_events_per_participant', '3'),
('max_participants_per_club_per_event', '2'),
('contact_email', 'townclub.coochbehar@gmail.com'),
('contact_phone', '+91 00000 00000')
ON CONFLICT (key) DO NOTHING;