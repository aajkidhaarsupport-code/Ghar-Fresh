'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

export default function Subscriptions() {
  const { user, ready } = useUser();
  const [subs, setSubs] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('subscriptions')
      .select('*, products(name, pack_size, selling_price)')
      .neq('status', 'cancelled').order('created_at', { ascending: false });
    setSubs(data || []);
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function run(fn, args) {
    setMsg('');
    const { error } = await supabase.rpc(fn, args);
    if (error) setMsg(error.message); else load();
  }

  if (!ready) return <p>Loading…</p>;
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">My subscriptions</h1>
      {subs.length === 0 && <p className="text-gray-500">No subscription yet — start your daily milk plan.</p>}
      {subs.map(s => (
        <div key={s.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
          <div className="flex justify-between">
            <div>
              <div className="font-medium">{s.products?.name} · {s.products?.pack_size}</div>
              <div className="text-sm text-gray-500">{s.frequency.replace('_', ' ')} · next: {s.next_delivery_date}</div>
            </div>
            <span className={`text-xs px-2 py-1 h-fit rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{s.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button className="w-9 h-9 border rounded-full" onClick={() => run('update_subscription_qty', { p_id: s.id, p_qty: Math.max(1, s.quantity - 1) })}>−</button>
            <span>{s.quantity}</span>
            <button className="w-9 h-9 border rounded-full" onClick={() => run('update_subscription_qty', { p_id: s.id, p_qty: s.quantity + 1 })}>+</button>
            <div className="flex-1" />
            {s.status === 'active'
              ? <button className="text-sm text-accent" onClick={() => run('set_subscription_status', { p_id: s.id, p_status: 'paused' })}>Pause</button>
              : <button className="text-sm text-brand" onClick={() => run('set_subscription_status', { p_id: s.id, p_status: 'active' })}>Resume</button>}
            <button className="text-sm text-red-600" onClick={() => confirm('Cancel this subscription?') && run('set_subscription_status', { p_id: s.id, p_status: 'cancelled' })}>Cancel</button>
          </div>
        </div>
      ))}
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
    </div>
  );
}
