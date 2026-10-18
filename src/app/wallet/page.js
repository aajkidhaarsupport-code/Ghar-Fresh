'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/useUser';

export default function Wallet() {
  const { user, ready } = useUser();
  const [wallet, setWallet] = useState(null);
  const [tx, setTx] = useState([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).single().then(({ data }) => setWallet(data));
    supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setTx(data || []));
  }, [user]);

  if (!ready) return <p>Loading…</p>;
  return (
    <div>
      <div className="bg-brand text-white rounded-2xl p-5 mb-4">
        <div className="text-sm opacity-80">Wallet balance</div>
        <div className="text-3xl font-semibold">₹{wallet?.balance ?? 0}</div>
        <div className="text-xs opacity-80 mt-2">Online recharge arrives with the payment gateway step.</div>
      </div>
      <h2 className="font-semibold mb-2">Transactions</h2>
      {tx.length === 0 && <p className="text-gray-500">No transactions yet.</p>}
      {tx.map(t => {
        const minus = t.type === 'debit';
        return (
          <div key={t.id} className="bg-white rounded-xl p-3 mb-2 flex justify-between shadow-sm">
            <div>
              <div className="text-sm font-medium capitalize">{t.type}{t.description ? ` · ${t.description}` : ''}</div>
              <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}{t.order_id ? ` · #${t.order_id.slice(0, 8)}` : ''}</div>
            </div>
            <div className="text-right">
              <div className={minus ? 'text-red-600' : 'text-green-700'}>{minus ? '−' : '+'}₹{t.amount}</div>
              <div className="text-xs text-gray-500">Bal ₹{t.balance_after}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
