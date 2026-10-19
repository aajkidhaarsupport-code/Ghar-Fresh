'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Msg from '@/components/Msg';

export default function Riders() {
  const [riders, setRiders] = useState([]);
  const [contact, setContact] = useState('');
  const [role, setRole] = useState('rider');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('profiles').select('*').in('role', ['rider', 'support', 'admin', 'packer']);
    setRiders(data || []);
  }
  useEffect(() => { load(); }, []);

  async function setUserRole(c, r) {
    const { error } = await supabase.rpc('admin_set_role', { p_contact: c, p_role: r });
    setMsg(error ? error.message : 'Role updated'); setContact(''); load();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Riders and staff</h1>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="text-sm text-gray-500 mb-2">The person must sign up in the app first. Then enter their email or phone here.</div>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="Email or phone" value={contact} onChange={e => setContact(e.target.value)} />
          <select className="border rounded-lg px-3 py-2" value={role} onChange={e => setRole(e.target.value)}>
            <option value="rider">Rider</option><option value="support">Support</option>
            <option value="packer">Packer</option><option value="admin">Admin</option><option value="customer">Customer</option>
          </select>
          <button className="bg-brand text-white rounded-lg px-4" disabled={!contact} onClick={() => setUserRole(contact, role)}>Set role</button>
        </div>
      </div>
      <Msg msg={msg} />
      <div className="bg-white rounded-2xl shadow-sm">
        {riders.map(r => (
          <div key={r.id} className="flex justify-between p-3 border-b last:border-0 text-sm">
            <div>{r.full_name || '—'}<div className="text-gray-500">{r.email || r.phone}</div></div>
            <div className="text-right">
              <div className="capitalize">{r.role}</div>
              <button className="text-red-600" onClick={() => confirm('Make this user a customer again?') && setUserRole(r.email || r.phone, 'customer')}>Remove role</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
