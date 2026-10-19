'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser, cart } from '@/lib/useUser';

export default function Basket() {
  const { user, ready } = useUser();
  const [items, setItems] = useState({});
  const [products, setProducts] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addr, setAddr] = useState('');
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setItems(cart.get());
    if (!user) return;
    supabase.from('products').select('*').eq('is_active', true).then(({ data }) => setProducts(data || []));
    supabase.from('addresses').select('*').is('deleted_at', null).then(({ data }) => {
      setAddresses(data || []);
      const d = (data || []).find(a => a.is_default) || (data || [])[0];
      if (d) setAddr(d.id);
    });
    supabase.rpc('next_eligible_date').then(({ data }) => setDate(data));
  }, [user]);

  const lines = products.filter(p => items[p.id]).map(p => ({ ...p, qty: items[p.id] }));
  const total = lines.reduce((s, l) => s + l.qty * Number(l.selling_price), 0);

  function change(id, d) {
    const c = { ...items }; c[id] = (c[id] || 0) + d;
    if (c[id] <= 0) delete c[id];
    setItems(c); cart.set(c);
  }

  async function checkout() {
    setMsg('');
    const payload = lines.map(l => ({ product_id: l.id, quantity: l.qty }));
    const { error } = await supabase.rpc('create_basket_order', { p_address: addr, p_items: payload });
    if (error) { setMsg(error.message); return; }
    cart.set({}); window.location.href = '/orders';
  }

  if (!ready) return <p>Loading…</p>;
  return (
    <div>
      <h1 className="text-xl font-semibold">Tomorrow's basket</h1>
      {date && <p className="text-xs text-gray-500 mb-3">Delivery on {date}. Order before 10 PM for tomorrow.</p>}
      {lines.length === 0 && <p className="text-gray-500">Basket is empty. Add items from Home.</p>}
      {lines.map(l => (
        <div key={l.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center gap-3 shadow-sm">
          <div className="flex-1">
            <div className="font-medium">{l.name}</div>
            <div className="text-sm text-gray-500">{l.pack_size} · ₹{l.selling_price}</div>
          </div>
          <button className="w-8 h-8 border rounded-full" onClick={() => change(l.id, -1)}>−</button>
          <span>{l.qty}</span>
          <button className="w-8 h-8 border rounded-full" onClick={() => change(l.id, 1)}>+</button>
        </div>
      ))}
      {lines.length > 0 && (
        <>
          <select className="w-full border rounded-xl px-4 py-3 my-3 bg-white" value={addr} onChange={e => setAddr(e.target.value)}>
            {addresses.map(a => <option key={a.id} value={a.id}>{a.label || a.house_no} – {a.line1}</option>)}
          </select>
          {addresses.length === 0 && <a href="/profile?next=/basket" className="text-brand underline">Add an address first</a>}
          <div className="flex justify-between font-semibold mb-3"><span>Items total</span><span>₹{total}</span></div>
          <button disabled={!addr} onClick={checkout} className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            Pay from wallet
          </button>
          <p className="text-xs text-gray-500 mt-2">Delivery fee (if any) is added at checkout.</p>
        </>
      )}
      {msg && <p className="text-red-600 mt-3 text-sm">{msg}</p>}
    </div>
  );
}
