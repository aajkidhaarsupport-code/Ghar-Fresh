'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Setup() {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    (async () => {
      const out = [];
      const add = (name, ok, detail, fix) => out.push({ name, ok, detail, fix });

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      add('Website knows the Supabase address', !!url, url ? new URL(url).host : 'missing',
        'Render → Environment: set NEXT_PUBLIC_SUPABASE_URL, then redeploy.');
      add('Website has the Supabase public key', !!key, key ? `${key.length} characters` : 'missing',
        'Render → Environment: set NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.');

      for (const [table, label, fix] of [
        ['categories', 'Categories', 'Run 007_seed_catalog.sql (and 008 if it says permission denied).'],
        ['products', 'Products', 'Run 008_access_and_photos.sql, then 007_seed_catalog.sql.'],
        ['societies', 'Delivery areas', 'Run 007_seed_catalog.sql, or add an area in Admin → Zones.']
      ]) {
        const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
        if (error) add(label, false, error.message, 'Run 008_access_and_photos.sql in the Supabase SQL Editor.');
        else add(label, count > 0, `${count} found`, fix);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        add('Logged in', false, 'You are not logged in', 'Login first (tap Login), then open /setup again to check your role.');
      } else {
        add('Logged in', true, user.email, '');
        const { data: prof, error } = await supabase.from('profiles').select('role, phone, full_name').eq('id', user.id).maybeSingle();
        if (error) add('Your profile', false, error.message, 'Run 008_access_and_photos.sql.');
        else if (!prof) add('Your profile', false, 'No profile row for this login', 'Run 009_profile_fix.sql (it repairs this).');
        else {
          add('Your profile', true, `role: ${prof.role}`, '');
          add('You are admin', prof.role === 'admin', prof.role,
            `Run in SQL Editor: update public.profiles set role = 'admin' where lower(email) = lower('${user.email}');`);
        }
        const { data: w, error: we } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
        add('Your wallet', !!w, we ? we.message : w ? `₹${w.balance}` : 'missing', 'Run 009_profile_fix.sql.');
      }

      const st = await supabase.storage.from('product-images').list('', { limit: 1 });
      add('Photo storage', !st.error, st.error ? st.error.message : 'ready', 'Run 008_access_and_photos.sql.');

      setRows(out); setRunning(false);
    })();
  }, []);

  const bad = rows.filter(r => !r.ok).length;
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-1">System check</h1>
      <p className="text-sm text-gray-500 mb-4">Shows exactly what is working and what to fix. Send me a screenshot of this page if something is red.</p>
      {running && <p>Checking…</p>}
      {!running && <div className={`rounded-xl p-3 mb-4 text-sm font-medium ${bad ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'}`}>
        {bad ? `${bad} thing(s) need fixing` : 'Everything looks good ✓'}
      </div>}
      {rows.map(r => (
        <div key={r.name} className="card p-3 mb-2">
          <div className="flex justify-between gap-2">
            <b className="text-sm">{r.name}</b>
            <span className={r.ok ? 'text-green-700' : 'text-red-600'}>{r.ok ? '✓' : '✗'}</span>
          </div>
          <div className="text-xs text-gray-600 break-words">{r.detail}</div>
          {!r.ok && r.fix && <div className="text-xs text-red-700 mt-1 break-words">Fix: {r.fix}</div>}
        </div>
      ))}
      <a href="/" className="block text-center text-brand underline mt-4 text-sm">Back to shop</a>
    </div>
  );
}
