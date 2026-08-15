import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Participant } from './types';

export function useParticipants() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) setParticipants(data as Participant[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { participants, loading, reload: load, setParticipants };
}
