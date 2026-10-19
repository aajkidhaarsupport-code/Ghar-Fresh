'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Msg from '@/components/Msg';

const blank = { name: '', city: '', pincode: '', delivery_fee: '0' };

export default function Zones() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('societies').select('*').order('name');
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name) { setMsg('Name is required'); return; }
    const { error } = await supabase.from('societies').insert({ ...form, delivery_fee: Number(form.delivery_fee || 0) });
    if (error) setMsg(error.message); else { setForm(blank); setMsg('Area added'); load(); }
  }

  async function patch(id, p) {
    const { error } = await supabase.from('societies').update(p).eq('id', id);
    setMsg(error ? error.message : 'Saved'); load();
  }

  const inp = 'border rounded-lg px-3 py-2 bg-white text-sm';
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Delivery areas</h1>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
        <input className={inp} placeholder="Area / society *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className={inp} placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        <input className={inp} placeholder="Pincode" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} />
        <input className={inp} placeholder="Delivery fee ₹" type="number" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} />
        <button className="bg-brand text-white rounded-lg" onClick={add}>Add area</button>
      </div>
      <Msg msg={msg} />
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-3">Area</th><th>Pincode</th><th>Fee ₹</th><th>Serviceable</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3"><input className="border rounded px-2 py-1 w-56" defaultValue={r.name}
                  onBlur={e => e.target.value && e.target.value !== r.name && patch(r.id, { name: e.target.value })} /></td>
                <td><input className="border rounded px-2 py-1 w-24" defaultValue={r.pincode || ''}
                  onBlur={e => e.target.value !== (r.pincode || '') && patch(r.id, { pincode: e.target.value })} /></td>
                <td><input className="border rounded px-2 py-1 w-20" type="number" defaultValue={r.delivery_fee}
                  onBlur={e => Number(e.target.value) !== Number(r.delivery_fee) && patch(r.id, { delivery_fee: Number(e.target.value) })} /></td>
                <td><input type="checkbox" checked={r.is_serviceable} onChange={e => patch(r.id, { is_serviceable: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
