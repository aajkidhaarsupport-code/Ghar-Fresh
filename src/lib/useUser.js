'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useUser(required = true) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
      if (!data.user && required) window.location.href = '/login';
    });
  }, [required]);
  return { user, ready };
}

export const cart = {
  get() { try { return JSON.parse(localStorage.getItem('gf_cart') || '{}'); } catch { return {}; } },
  set(c) { localStorage.setItem('gf_cart', JSON.stringify(c)); },
  add(id) { const c = this.get(); c[id] = (c[id] || 0) + 1; this.set(c); },
};
