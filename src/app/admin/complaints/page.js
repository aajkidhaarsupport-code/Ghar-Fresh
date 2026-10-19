'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Msg from '@/components/Msg';

export default function Complaints() {
  const [rows, setRows] = useState([]);
  const [refund, setRefund] = useState({});
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('complaints')
      .select('*, profiles(full_name), orders(total, delivery_date)')
      .order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function act(id, status) {
    const { error } = await supabase.rpc('admin_resolve_complaint', {
      p_id: id, p_status: status, p_refund: Number(refund[id] || 0)
    });
    setMsg(error ? error.message : 'Done'); load();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Complaints</h1>
      <Msg msg={msg} />
      {rows.length === 0 && <p className="text-gray-500">No complaints.</p>}
      {rows.map(c => {
        const open = ['open', 'in_progress'].includes(c.status);
        return (
          <div key={c.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="flex justify-between">
              <div className="font-medium">{c.profiles?.full_name} · {c.type.replace('_', ' ')}</div>
              <span className="text-xs bg-cream px-2 py-1 rounded-full">{c.status.replace('_', ' ')}</span>
            </div>
            <div className="text-sm text-gray-500">Order {c.orders?.delivery_date} · ₹{c.orders?.total} · {new Date(c.created_at).toLocaleString()}</div>
            {c.description && <p className="text-sm mt-1">{c.description}</p>}
            {c.refund_amount && <p className="text-sm text-green-700 mt-1">Refunded ₹{c.refund_amount}</p>}
            {open && (
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <input className="border rounded-lg px-3 py-2 w-28" type="number" placeholder="Refund ₹" value={refund[c.id] || ''}
                  onChange={e => setRefund({ ...refund, [c.id]: e.target.value })} />
                <button className="bg-brand text-white rounded-lg px-3 py-2 text-sm" onClick={() => act(c.id, 'resolved')}>Resolve</button>
                <button className="border rounded-lg px-3 py-2 text-sm" onClick={() => act(c.id, 'in_progress')}>In progress</button>
                <button className="text-red-600 text-sm" onClick={() => act(c.id, 'rejected')}>Reject</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
