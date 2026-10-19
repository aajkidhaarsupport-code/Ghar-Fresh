'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';
import Msg from '@/components/Msg';

const empty = { label: '', house_no: '', line1: '', line2: '', landmark: '', society_id: '', delivery_instructions: '' };

export default function Profile() {
  const { user, ready } = useUser();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');

  async function load() {
    const [p, a, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('addresses').select('*').is('deleted_at', null),
      supabase.from('societies').select('*').eq('is_serviceable', true)
    ]);
    setProfile(p.data); setAddresses(a.data || []); setSocieties(s.data || []);
    const e = p.error || a.error || s.error;
    if (e) setMsg(e.message);
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function saveProfile() {
    const { error } = await supabase.from('profiles')
      .update({ full_name: profile.full_name, phone: profile.phone || null }).eq('id', user.id);
    setMsg(error ? error.message : 'Saved');
  }

  async function addAddress() {
    setMsg('');
    if (!form.house_no || !form.line1 || !form.society_id) { setMsg('House no, address line 1 and area are required.'); return; }
    const { error } = await supabase.from('addresses')
      .insert({ ...form, user_id: user.id, is_default: addresses.length === 0 });
    if (error) setMsg(error.message); else { setForm(empty); load(); }
  }

  async function removeAddress(id) {
    await supabase.from('addresses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function logout() { await supabase.auth.signOut(); window.location.href = '/login'; }

  if (!ready || !profile) return <p>Loading…</p>;
  const inp = 'w-full border rounded-xl px-4 py-3 mb-2 bg-white';
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Profile</h1>
      <input className={inp} placeholder="Full name *" value={profile.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
      <input className={inp} placeholder="Mobile number" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
      <button className="w-full bg-brand text-white rounded-xl py-3 mb-6" onClick={saveProfile}>Save profile</button>

      <h2 className="font-semibold mb-2">Addresses</h2>
      {addresses.map(a => (
        <div key={a.id} className="bg-white rounded-xl p-3 mb-2 flex justify-between shadow-sm">
          <div className="text-sm">{a.label && <b>{a.label} · </b>}{a.house_no}, {a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
          <button className="text-red-600 text-sm" onClick={() => removeAddress(a.id)}>Remove</button>
        </div>
      ))}

      <h3 className="font-medium mt-4 mb-2">Add address</h3>
      {societies.length === 0 && <p className="text-sm text-gray-500 mb-2">We are not delivering in your area yet. Join the waitlist.</p>}
      <select className={inp} value={form.society_id} onChange={e => setForm({ ...form, society_id: e.target.value })}>
        <option value="">Select area / society *</option>
        {societies.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? `, ${s.city}` : ''}</option>)}
      </select>
      <input className={inp} placeholder="Label (Home / Office)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
      <input className={inp} placeholder="Flat / house number *" value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} />
      <input className={inp} placeholder="Address line 1 *" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} />
      <input className={inp} placeholder="Address line 2" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} />
      <input className={inp} placeholder="Landmark" value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} />
      <input className={inp} placeholder="Delivery instructions" value={form.delivery_instructions} onChange={e => setForm({ ...form, delivery_instructions: e.target.value })} />
      <button className="w-full border border-brand text-brand rounded-xl py-3" onClick={addAddress}>Save address</button>

      <div className="mt-3"><Msg msg={msg} /></div>
      <button className="w-full mt-8 text-red-600 py-3" onClick={logout}>Logout</button>
    </div>
  );
}
