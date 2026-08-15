import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { SwimEvent } from './types';

export function useEvents() {
  const [events, setEvents] = useState<SwimEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('category', { ascending: true })
      .order('event_name', { ascending: true });
    if (!error && data) setEvents(data as SwimEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, reload: load };
}
