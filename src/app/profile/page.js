'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';
import Msg from '@/components/Msg';

const empty = { label: 'Home', house_no: '', line1: '', line2: '', landmark: '', society_id: '', delivery_instructions: '', lat: null, lng: null };

export default function Profile() {
  const { user, ready } = useUser();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function load() {
    const [p, a, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('addresses').select('*').is('deleted_at', null).order('created_at'),
      supabase.from('societies').select('*').eq('is_serviceable', true).order('name')
    ]);
    const e = p.error || a.error || s.error;
    if (e) setMsg(e.message);
    if (!p.data && !p.error) setMsg('Your profile was not created. Ask the admin to run the profile repair (file 009).');
    setProfile(p.data); setAddresses(a.data || []); setSocieties(s.data || []);
    if ((s.data || []).length === 1) setForm(f => ({ ...f, society_id: s.data[0].id }));
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function saveProfile() {
    setMsg('');
    if (!profile.full_name?.trim()) { setMsg('Name is required'); return; }
    if (!/^[6-9]\d{9}$/.test((profile.phone || '').trim())) { setMsg('Enter a valid 10-digit mobile number'); return; }
    const { error } = await supabase.from('profiles')
      .update({ full_name: profile.full_name.trim(), phone: profile.phone.trim() }).eq('id', user.id);
    setMsg(error ? (/unique|duplicate/i.test(error.message) ? 'This mobile number is already used by another account' : error.message) : 'Profile saved');
  }

  function useMyLocation() {
    setMsg('');
    if (!navigator.geolocation) { setMsg('Location is not supported on this device'); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setForm(f => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude })); setMsg('Location captured ✓'); },
      () => setMsg('Could not get location. Please allow location access, or skip this.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function addAddress() {
    setMsg('');
    if (!form.society_id) { setMsg('Please select your area / society'); return; }
    if (!form.house_no.trim() || !form.line1.trim() || !form.line2.trim()) { setMsg('Flat/house no, address line 1 and address line 2 are required'); return; }
    setBusy(true);
    const row = { ...form, society_id: form.society_id, user_id: user.id, is_default: addresses.length === 0 };
    const { error } = await supabase.from('addresses').insert(row);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/')) { window.location.href = next; return; }
    setForm({ ...empty, society_id: societies.length === 1 ? societies[0].id : '' });
    setMsg('Address saved ✓'); load();
  }

  async function makeDefault(id) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    load();
  }
  async function removeAddress(id) {
    await supabase.from('addresses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    load();
  }
  async function logout() { await supabase.auth.signOut(); window.location.href = '/login'; }

  if (!ready) return <p>Loading…</p>;
  if (!profile) return <div><Msg msg={msg} /><p className="text-gray-500">Loading profile…</p></div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">My profile</h1>
      <div className="card p-4 mb-5">
        <label className="label req">Full name</label>
        <input className="input" value={profile.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
        <label className="label">Email</label>
        <input className="input bg-gray-50" value={profile.email || user.email || ''} disabled />
        <label className="label req">Mobile number</label>
        <input className="input" type="tel" inputMode="numeric" maxLength={10} value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
        <button className="btn" onClick={saveProfile}>Save profile</button>
      </div>

      <h2 className="font-bold mb-2">Delivery addresses</h2>
      {addresses.length === 0 && <p className="text-sm text-gray-500 mb-3">No address yet. Add one below to start ordering.</p>}
      {addresses.map(a => (
        <div key={a.id} className="card p-3 mb-2">
          <div className="flex justify-between gap-2">
            <div className="text-sm">
              <b>{a.label || 'Address'}</b>{a.is_default && <span className="ml-2 text-[10px] bg-green-100 text-green-800 rounded-full px-2 py-0.5">Default</span>}
              <div className="text-gray-600">{a.house_no}, {a.line1}{a.line2 ? `, ${a.line2}` : ''}{a.landmark ? ` · ${a.landmark}` : ''}</div>
            </div>
            <div className="text-right text-sm shrink-0">
              {!a.is_default && <button className="block text-brand" onClick={() => makeDefault(a.id)}>Make default</button>}
              <button className="text-red-600" onClick={() => removeAddress(a.id)}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      <div className="card p-4 mt-4">
        <h3 className="font-semibold mb-3">Add new address</h3>
        {societies.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-3 text-sm mb-3">
            We are not delivering in your area yet. Delivery areas are added by the admin.
          </div>
        )}
        <label className="label req">Area / society</label>
        <select className="input" value={form.society_id} onChange={set('society_id')}>
          <option value="">Select your area</option>
          {societies.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? `, ${s.city}` : ''}</option>)}
        </select>

        <div className="flex gap-2 mb-3">
          {['Home', 'Work', 'Other'].map(l => (
            <button key={l} onClick={() => setForm({ ...form, label: l })}
              className={`px-4 py-1.5 rounded-full text-sm border ${form.label === l ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>
          ))}
        </div>

        <label className="label req">Flat / house number</label>
        <input className="input" value={form.house_no} onChange={set('house_no')} />
        <label className="label req">Address line 1</label>
        <input className="input" placeholder="Building / street" value={form.line1} onChange={set('line1')} />
        <label className="label req">Address line 2</label>
        <input className="input" placeholder="Colony / locality" value={form.line2} onChange={set('line2')} />
        <label className="label">Landmark</label>
        <input className="input" value={form.landmark} onChange={set('landmark')} />
        <label className="label">Delivery instructions</label>
        <input className="input" placeholder="e.g. Hang the bag on the gate" value={form.delivery_instructions} onChange={set('delivery_instructions')} />

        <button type="button" className="btn-outline mb-3" onClick={useMyLocation}>
          {form.lat ? '📍 Location captured ✓' : '📍 Use my current location'}
        </button>
        <button className="btn" disabled={busy} onClick={addAddress}>{busy ? 'Saving…' : 'Save address'}</button>
      </div>

      <div className="mt-3"><Msg msg={msg} /></div>
      <button className="w-full mt-6 text-red-600 py-3" onClick={logout}>Logout</button>
    </div>
  );
}
