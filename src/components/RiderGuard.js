'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RiderGuard({ children }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setState(data?.role === 'rider' ? 'ok' : 'denied');
    })();
  }, []);

  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'denied') return <p className="text-red-600">This area is for delivery partners only.</p>;
  return children;
}
