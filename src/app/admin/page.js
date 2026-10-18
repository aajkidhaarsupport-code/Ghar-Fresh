'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error }) => { if (error) setErr(error.message); else setS(data); });
  }, []);

  async function generateNow() {
    if (!confirm("Create tomorrow's orders from subscriptions now? This normally runs automatically at 10:15 PM.")) return;
    const { data, error } = await supabase.rpc('admin_generate_orders_now');
    setMsg(error ? error.message : `Date ${data.delivery_date}: ${data.created} created, ${data.on_hold} on hold, ${data.skipped_items} items skipped, ${data.errors} errors`);
  }

  if (err) return <p className="text-red-600">{err}</p>;
  if (!s) return <p>Loading…</p>;
  const total = Number(s.delivered_7d) + Number(s.failed_7d);
  const rate = total ? Math.round((Number(s.delivered_7d) / total) * 100) : 0;
  const cards = [
    ['Active subscriptions', s.active_subscriptions],
    ['Next delivery-day orders', s.next_day_orders],
    ['Delivery success (7 days)', `${rate}%`],
    ['Revenue (7 days)', `₹${s.revenue_7d}`],
    ['Failed deliveries (7 days)', s.failed_7d],
    ['Open complaints', s.open_complaints]
  ];
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([k, v]) => (
          <div key={k} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">{k}</div>
            <div className="text-2xl font-semibold text-brand">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <button className="border border-brand text-brand rounded-lg px-4 py-2 text-sm" onClick={generateNow}>
          Generate next day's orders now
        </button>
        {msg && <p className="text-sm text-brand mt-2">{msg}</p>}
      </div>
    </div>
  );
}
