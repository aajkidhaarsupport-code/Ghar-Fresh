'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrders() {
  const [date, setDate] = useState('');
  const [orders, setOrders] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [riders, setRiders] = useState([]);
  const [soc, setSoc] = useState('');
  const [rider, setRider] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.rpc('next_eligible_date').then(({ data }) => setDate(data));
    supabase.from('societies').select('id, name').then(({ data }) => setSocieties(data || []));
    supabase.from('profiles').select('id, full_name, email').eq('role', 'rider').then(({ data }) => setRiders(data || []));
  }, []);

  async function load() {
    if (!date) return;
    const { data } = await supabase.from('orders')
      .select('*, profiles!orders_user_id_fkey(full_name), addresses(house_no, line1, societies(name)), order_items(quantity, products(name, pack_size))')
      .eq('delivery_date', date).order('created_at');
    setOrders(data || []);
  }
  useEffect(() => { load(); }, [date]);

  async function setStatus(id, status) {
    const { error } = await supabase.rpc('admin_set_order_status', { p_order: id, p_status: status });
    setMsg(error ? error.message : 'Updated'); load();
  }

  async function assign() {
    const { error } = await supabase.rpc('admin_assign_route', { p_date: date, p_society: soc, p_rider: rider });
    setMsg(error ? error.message : 'Route created'); load();
  }

  const live = orders.filter(o => o.status !== 'cancelled');
  const pack = {};
  live.forEach(o => o.order_items?.forEach(i => {
    const k = `${i.products?.name} ${i.products?.pack_size || ''}`;
    pack[k] = (pack[k] || 0) + i.quantity;
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Orders</h1>
      <input type="date" className="border rounded-lg px-3 py-2 bg-white mb-3" value={date} onChange={e => setDate(e.target.value)} />
      {msg && <p className="text-sm text-brand mb-2">{msg}</p>}

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="font-medium mb-2">Packing list ({live.length} orders)</div>
        {Object.keys(pack).length === 0 && <p className="text-sm text-gray-500">Nothing to pack.</p>}
        {Object.entries(pack).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{v}</b></div>)}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="font-medium mb-2">Create route</div>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg px-3 py-2" value={soc} onChange={e => setSoc(e.target.value)}>
            <option value="">Area</option>{societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2" value={rider} onChange={e => setRider(e.target.value)}>
            <option value="">Rider</option>{riders.map(r => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}
          </select>
          <button disabled={!soc || !rider} className="bg-brand text-white rounded-lg px-4 disabled:opacity-50" onClick={assign}>Assign unassigned orders</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-3">Customer</th><th>Address</th><th>Items</th><th>₹</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-t align-top">
                <td className="p-3">{o.profiles?.full_name}</td>
                <td>{o.addresses?.house_no}, {o.addresses?.line1}<br /><span className="text-gray-500">{o.addresses?.societies?.name}</span></td>
                <td>{o.order_items?.map((i, k) => <div key={k}>{i.quantity} × {i.products?.name}</div>)}</td>
                <td>{o.total}</td>
                <td>{o.status.replace(/_/g, ' ')}</td>
                <td className="space-x-2">
                  {o.status === 'pending' && <button className="text-brand" onClick={() => setStatus(o.id, 'packed')}>Packed</button>}
                  {['pending', 'packed'].includes(o.status) && <button className="text-brand" onClick={() => setStatus(o.id, 'out_for_delivery')}>Out</button>}
                  {!['delivered', 'cancelled', 'failed'].includes(o.status) && <button className="text-red-600" onClick={() => confirm('Cancel and refund?') && setStatus(o.id, 'cancelled')}>Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
