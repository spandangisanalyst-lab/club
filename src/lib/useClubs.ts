import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Club } from './types';

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) setClubs(data as Club[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { clubs, loading, reload: load, setClubs };
}
