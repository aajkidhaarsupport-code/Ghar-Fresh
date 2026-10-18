'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const tabs = [
  ['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'],
  ['/admin/customers', 'Customers'], ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/complaints', 'Complaints'], ['/admin/riders', 'Riders'], ['/admin/zones', 'Zones']
];

export default function AdminLayout({ children }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setState(['admin', 'support'].includes(data?.role) ? 'ok' : 'denied');
    })();
  }, []);

  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'denied') return <p className="text-red-600">You do not have access to this area.</p>;
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto mb-4 pb-2">
        {tabs.map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap px-3 py-2 bg-white rounded-lg text-sm text-brand shadow-sm">{label}</a>
        ))}
      </div>
      {children}
    </div>
  );
}
