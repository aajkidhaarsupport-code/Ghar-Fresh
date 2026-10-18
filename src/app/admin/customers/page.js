'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    let query = supabase.from('profiles').select('*, wallets(balance)').eq('role', 'customer')
      .order('created_at', { ascending: false }).limit(50);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data } = await query;
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function toggleBlock(p) {
    const { error } = await supabase.from('profiles').update({ is_blocked: !p.is_blocked }).eq('id', p.id);
    setMsg(error ? error.message : p.is_blocked ? 'Unblocked' : 'Blocked'); load();
  }

  async function credit(p) {
    const amt = Number(prompt('Amount to add to wallet (₹)'));
    if (!amt || amt <= 0) return;
    const desc = prompt('Note (e.g. UPI payment received)') || 'Admin credit';
    const { error } = await supabase.rpc('admin_wallet_adjust', { p_user: p.id, p_type: 'credit', p_amount: amt, p_desc: desc });
    setMsg(error ? error.message : `₹${amt} added`); load();
  }

  const bal = p => (Array.isArray(p.wallets) ? p.wallets[0]?.balance : p.wallets?.balance) ?? 0;
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Customers</h1>
      <div className="flex gap-2 mb-3">
        <input className="border rounded-lg px-3 py-2 flex-1 bg-white" placeholder="Search name, email or phone" value={q} onChange={e => setQ(e.target.value)} />
        <button className="bg-brand text-white rounded-lg px-4" onClick={load}>Search</button>
      </div>
      {msg && <p className="text-sm text-brand mb-2">{msg}</p>}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-3">Customer</th><th>Contact</th><th>Wallet</th><th></th></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.full_name || '—'} {p.is_blocked && <span className="text-xs text-red-600">(blocked)</span>}</td>
                <td>{p.email}<br />{p.phone}</td>
                <td>₹{bal(p)}</td>
                <td className="space-x-3">
                  <button className="text-brand" onClick={() => credit(p)}>Add money</button>
                  <button className="text-red-600" onClick={() => toggleBlock(p)}>{p.is_blocked ? 'Unblock' : 'Block'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
