'use client';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function Form() {
  const { user, ready } = useUser();
  const [product, setProduct] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addr, setAddr] = useState('');
  const [qty, setQty] = useState(1);
  const [freq, setFreq] = useState('daily');
  const [days, setDays] = useState([]);
  const [start, setStart] = useState('');
  const [minDate, setMinDate] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const id = new URLSearchParams(window.location.search).get('product');
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => setProduct(data));
    supabase.from('addresses').select('*').is('deleted_at', null).then(({ data }) => {
      setAddresses(data || []);
      const d = (data || []).find(a => a.is_default) || (data || [])[0];
      if (d) setAddr(d.id);
    });
    supabase.rpc('next_eligible_date').then(({ data }) => { setMinDate(data); setStart(data); });
  }, [user]);

  async function submit() {
    setMsg('');
    const { error } = await supabase.rpc('create_subscription', {
      p_address: addr, p_product: product.id, p_qty: qty, p_freq: freq,
      p_custom_days: freq === 'custom' ? days : null, p_start: start
    });
    if (error) setMsg(error.message); else window.location.href = '/subscriptions';
  }

  if (!ready || !product) return <p>Loading…</p>;
  const field = 'w-full border rounded-xl px-4 py-3 mb-3 bg-white';
  return (
    <div>
      <h1 className="text-xl font-semibold">{product.name}</h1>
      <p className="text-gray-500 mb-4">{product.pack_size} · ₹{product.selling_price}</p>

      <label className="text-sm">Frequency</label>
      <select className={field} value={freq} onChange={e => setFreq(e.target.value)}>
        <option value="daily">Daily</option>
        <option value="alternate_days">Alternate days</option>
        <option value="weekdays">Weekdays</option>
        <option value="custom">Custom days</option>
        <option value="one_time">One time</option>
      </select>

      {freq === 'custom' && (
        <div className="flex flex-wrap gap-2 mb-3">
          {DAYS.map(d => (
            <button key={d} onClick={() => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d])}
              className={`px-3 py-2 rounded-lg border ${days.includes(d) ? 'bg-brand text-white' : 'bg-white'}`}>{d}</button>
          ))}
        </div>
      )}

      <label className="text-sm">Quantity</label>
      <div className="flex items-center gap-4 mb-3">
        <button className="w-10 h-10 border rounded-full" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
        <span className="font-semibold">{qty}</span>
        <button className="w-10 h-10 border rounded-full" onClick={() => setQty(qty + 1)}>+</button>
      </div>

      <label className="text-sm">Start date</label>
      <input type="date" className={field} min={minDate} value={start} onChange={e => setStart(e.target.value)} />
      <p className="text-xs text-gray-500 -mt-2 mb-3">Orders placed after the 10 PM cut-off start from the day after tomorrow.</p>

      <label className="text-sm">Delivery address</label>
      {addresses.length === 0 ? (
        <a href={`/profile?next=${encodeURIComponent('/subscribe?product=' + product.id)}`} className="block text-brand underline mb-3">Add an address first</a>
      ) : (
        <select className={field} value={addr} onChange={e => setAddr(e.target.value)}>
          {addresses.map(a => <option key={a.id} value={a.id}>{a.label || a.house_no} – {a.line1}</option>)}
        </select>
      )}

      <button className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        disabled={!addr} onClick={submit}>Start subscription</button>
      {msg && <p className="text-red-600 mt-3 text-sm">{msg}</p>}
    </div>
  );
}

export default function Page() { return <Suspense><Form /></Suspense>; }
