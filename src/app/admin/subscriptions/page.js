'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminSubs() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('subscriptions')
      .select('*, products(name, pack_size), profiles(full_name)')
      .order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function patch(id, p) {
    const { error } = await supabase.from('subscriptions').update(p).eq('id', id);
    setMsg(error ? error.message : 'Updated'); load();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Subscriptions</h1>
      {msg && <p className="text-sm text-brand mb-2">{msg}</p>}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-3">Customer</th><th>Product</th><th>Qty</th><th>Plan</th><th>Next</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.profiles?.full_name}</td>
                <td>{s.products?.name} {s.products?.pack_size}</td>
                <td>{s.quantity}</td>
                <td>{s.frequency.replace('_', ' ')}</td>
                <td><input type="date" className="border rounded px-2 py-1" defaultValue={s.next_delivery_date || ''}
                  onBlur={e => e.target.value && e.target.value !== s.next_delivery_date && patch(s.id, { next_delivery_date: e.target.value })} /></td>
                <td>{s.status}</td>
                <td className="space-x-2">
                  {s.status === 'active' && <button className="text-accent" onClick={() => patch(s.id, { status: 'paused' })}>Pause</button>}
                  {s.status === 'paused' && <button className="text-brand" onClick={() => patch(s.id, { status: 'active' })}>Resume</button>}
                  {s.status !== 'cancelled' && <button className="text-red-600" onClick={() => confirm('Cancel?') && patch(s.id, { status: 'cancelled' })}>Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
