'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

const STEPS = ['pending', 'packed', 'out_for_delivery', 'delivered'];
const ISSUES = [['not_received', 'Did not receive'], ['wrong_item', 'Wrong item'], ['quality', 'Quality issue'], ['billing', 'Billing issue']];

export default function Orders() {
  const { user, ready } = useUser();
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');
  const [issueFor, setIssueFor] = useState(null);

  async function load() {
    const { data } = await supabase.from('orders')
      .select('*, order_items(quantity, products(name, pack_size))')
      .order('delivery_date', { ascending: false }).limit(50);
    setOrders(data || []);
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function cancel(id) {
    setMsg('');
    const { error } = await supabase.rpc('cancel_order', { p_order: id });
    if (error) setMsg(error.message); else load();
  }

  async function report(order, type) {
    const { error } = await supabase.from('complaints').insert({ user_id: user.id, order_id: order.id, type });
    setIssueFor(null);
    setMsg(error ? error.message : 'Issue reported. Our team will contact you.');
  }

  async function claimRefund(id) {
    setMsg('');
    const { data, error } = await supabase.rpc('customer_claim_refund', { p_order: id });
    setMsg(error ? error.message : `₹${data} refunded to your wallet`); load();
  }

  async function viewProof(id) {
    const { data: proof } = await supabase.from('delivery_proofs').select('photo_url, delivered_at')
      .eq('order_id', id).eq('status', 'delivered').limit(1).single();
    if (!proof?.photo_url) { setMsg('No delivery photo found'); return; }
    const { data } = await supabase.storage.from('delivery-proofs').createSignedUrl(proof.photo_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank'); else setMsg('Could not open photo');
  }

  if (!ready) return <p>Loading…</p>;
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">My orders</h1>
      {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}
      {orders.map(o => (
        <div key={o.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
          <div className="flex justify-between">
            <div className="font-medium">{o.delivery_date}</div>
            <span className="text-xs bg-cream px-2 py-1 rounded-full">{o.status.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {o.order_items?.map((i, k) => <div key={k}>{i.quantity} × {i.products?.name} {i.products?.pack_size}</div>)}
          </div>
          <div className="text-sm font-semibold mt-1">₹{o.total}</div>
          {STEPS.includes(o.status) && (
            <div className="flex gap-1 mt-2">
              {STEPS.map((s, k) => <div key={s} className={`h-1 flex-1 rounded ${k <= STEPS.indexOf(o.status) ? 'bg-brand' : 'bg-gray-200'}`} />)}
            </div>
          )}
          {o.status === 'failed' && <div className="text-sm text-red-600 mt-2">We could not deliver this order.</div>}
          {o.status === 'on_hold' && <div className="text-sm text-orange-700 mt-2">On hold: your wallet balance was too low. You have not been charged. Add money to your wallet and contact support to release it.</div>}
          <div className="flex gap-4 mt-3 text-sm">
            {o.status === 'failed' && o.payment_status === 'paid' && <button className="text-brand font-medium" onClick={() => claimRefund(o.id)}>Refund to wallet</button>}
            {o.status === 'delivered' && <button className="text-brand" onClick={() => viewProof(o.id)}>View delivery photo</button>}
            {o.status === 'pending' && <button className="text-red-600" onClick={() => cancel(o.id)}>Cancel</button>}
            {['delivered', 'failed'].includes(o.status) && <button className="text-brand" onClick={() => setIssueFor(o.id)}>Report issue</button>}
          </div>
          {issueFor === o.id && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {ISSUES.map(([k, l]) => <button key={k} className="border rounded-lg py-2 text-sm" onClick={() => report(o, k)}>{l}</button>)}
            </div>
          )}
        </div>
      ))}
      {msg && <p className="text-sm mt-2 text-brand">{msg}</p>}
    </div>
  );
}
