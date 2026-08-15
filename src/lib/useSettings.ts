import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { SettingsMap } from './types';
import { DEFAULT_SETTINGS } from './constants';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (!error && data) {
      const map: SettingsMap = { ...DEFAULT_SETTINGS };
      for (const row of data) {
        map[row.key] = row.value ?? (DEFAULT_SETTINGS as Record<string, string>)[row.key] ?? '';
      }
      setSettings(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { settings, loading, reload: load };
}
