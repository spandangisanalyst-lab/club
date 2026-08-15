import type { SwimEvent } from './types';

export const ADMIN_PASSWORD = 'CTC@2026';

export const COMPETITION_DATE = new Date('2026-08-15T00:00:00');
export const REGISTRATION_DEADLINE = new Date('2026-08-13T23:59:00');

export const MAX_EVENTS_PER_PARTICIPANT = 3;
export const MAX_PARTICIPANTS_PER_CLUB_PER_EVENT = 2;
export const DEFAULT_LANE_COUNT = 6;

export const AGE_GROUPS = [
  { label: 'Men', ageGroup: 'Open', gender: 'Male' as const, minAge: 17, maxAge: 999 },
  { label: 'Women', ageGroup: 'Open', gender: 'Female' as const, minAge: 17, maxAge: 999 },
  { label: 'U/17 Boys', ageGroup: 'U/17', gender: 'Male' as const, minAge: 14, maxAge: 16 },
  { label: 'U/17 Girls', ageGroup: 'U/17', gender: 'Female' as const, minAge: 14, maxAge: 16 },
  { label: 'U/14 Boys', ageGroup: 'U/14', gender: 'Male' as const, minAge: 12, maxAge: 13 },
  { label: 'U/14 Girls', ageGroup: 'U/14', gender: 'Female' as const, minAge: 12, maxAge: 13 },
  { label: 'U/12 Boys', ageGroup: 'U/12', gender: 'Male' as const, minAge: 10, maxAge: 11 },
  { label: 'U/12 Girls', ageGroup: 'U/12', gender: 'Female' as const, minAge: 10, maxAge: 11 },
  { label: 'U/10 Boys', ageGroup: 'U/10', gender: 'Male' as const, minAge: 0, maxAge: 9 },
  { label: 'U/10 Girls', ageGroup: 'U/10', gender: 'Female' as const, minAge: 0, maxAge: 9 },
];

export const POINTS_EXCLUDED_GROUPS = ['U/10'];

export const MEDAL_COLORS: Record<string, string> = {
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Bronze: '#CD7F32',
};

export const HERO_IMAGES = [
  'https://images.pexels.com/photos/35156552/pexels-photo-35156552.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'https://images.pexels.com/photos/1263349/pexels-photo-1263349.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'https://images.pexels.com/photos/31033388/pexels-photo-31033388.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'https://images.pexels.com/photos/34676983/pexels-photo-34676983.jpeg?auto=compress&cs=tinysrgb&w=1920',
];

export const GALLERY_IMAGES = [
  'https://images.pexels.com/photos/30191398/pexels-photo-30191398.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/8028682/pexels-photo-8028682.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/36018788/pexels-photo-36018788.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/35156554/pexels-photo-35156554.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/18214805/pexels-photo-18214805.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/38642524/pexels-photo-38642524.jpeg?auto=compress&cs=tinysrgb&w=800',
];

export const DEFAULT_SETTINGS = {
  site_title: '43rd Inter Club Swimming Competition',
  organizer: 'Cooch Behar Town Club',
  venue: 'Cooch Behar Rajbari Stadium Swimming Pool Complex',
  event_date: '2026-08-15',
  registration_deadline: '2026-08-13T23:59',
  hero_heading: '43rd Inter Club Swimming Competition',
  hero_subheading:
    'Organized by Cooch Behar Town Club at Cooch Behar Rajbari Stadium Swimming Pool Complex',
  about_title: 'About the Competition',
  about_text:
    'The 43rd Inter Club Swimming Competition brings together swimmers from clubs across the region for a day of thrilling aquatic competition. Organized by Cooch Behar Town Club, this prestigious event celebrates excellence in swimming across multiple age categories. Join us on 15th August 2026 at the Cooch Behar Rajbari Stadium Swimming Pool Complex for a spectacular showcase of talent, speed, and sportsmanship.',
  footer_text: 'Cooch Behar Town Club. All rights reserved.',
  lane_count: '6',
  championship_points: '7,5,4,3,2,1',
  max_events_per_participant: '3',
  max_participants_per_club_per_event: '2',
  contact_email: 'townclub.coochbehar@gmail.com',
  contact_phone: '+91 00000 00000',
};

export const EDITABLE_SETTING_KEYS = [
  'site_title',
  'organizer',
  'venue',
  'event_date',
  'registration_deadline',
  'hero_heading',
  'hero_subheading',
  'about_title',
  'about_text',
  'footer_text',
  'lane_count',
  'championship_points',
  'max_events_per_participant',
  'max_participants_per_club_per_event',
  'contact_email',
  'contact_phone',
] as const;

export const SETTING_LABELS: Record<string, string> = {
  site_title: 'Site Title',
  organizer: 'Organizer',
  venue: 'Venue',
  event_date: 'Event Date',
  registration_deadline: 'Registration Deadline',
  hero_heading: 'Hero Heading',
  hero_subheading: 'Hero Subheading',
  about_title: 'About Section Title',
  about_text: 'About Section Text',
  footer_text: 'Footer Text',
  lane_count: 'Number of Lanes',
  championship_points: 'Championship Points (1st-6th, comma separated)',
  max_events_per_participant: 'Max Events per Participant',
  max_participants_per_club_per_event: 'Max Participants per Club per Event',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
};

export function ageGroupForParticipant(
  dob: string,
  gender: 'Male' | 'Female'
): { label: string; ageGroup: string } | null {
  const birthDate = new Date(dob);
  const cutoff = new Date('2026-08-15T00:00:00');
  let age = cutoff.getFullYear() - birthDate.getFullYear();
  const m = cutoff.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 10) return { label: `U/10 ${gender === 'Male' ? 'Boys' : 'Girls'}`, ageGroup: 'U/10' };
  if (age < 12) return { label: `U/12 ${gender === 'Male' ? 'Boys' : 'Girls'}`, ageGroup: 'U/12' };
  if (age < 14) return { label: `U/14 ${gender === 'Male' ? 'Boys' : 'Girls'}`, ageGroup: 'U/14' };
  if (age < 17) return { label: `U/17 ${gender === 'Male' ? 'Boys' : 'Girls'}`, ageGroup: 'U/17' };
  return { label: gender === 'Male' ? 'Men' : 'Women', ageGroup: 'Open' };
}

export function getEligibleEvents(
  allEvents: SwimEvent[],
  dob: string,
  gender: 'Male' | 'Female'
): SwimEvent[] {
  const group = ageGroupForParticipant(dob, gender);
  if (!group) return [];
  return allEvents.filter(
    (e) => e.age_group === group.ageGroup && e.gender === gender
  );
}
