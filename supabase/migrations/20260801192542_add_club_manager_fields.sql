/*
# Add club manager contact fields

## Overview
Extends the clubs table to store club manager contact details so that
club managers can self-register their clubs from the public registration page.

## Modified Tables
- `clubs` — added columns:
  - `manager_name` (text) — name of the club manager / representative
  - `manager_email` (text) — contact email
  - `manager_phone` (text) — contact phone number
  - `address` (text) — club address (optional)
  - `status` (text, default 'pending') — 'pending' or 'approved' so admins can verify

## Security
- No RLS changes needed; existing anon+authenticated CRUD policies already cover the new columns.
*/

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS manager_email text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS manager_phone text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved'));