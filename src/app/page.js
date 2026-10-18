'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cart } from '@/lib/useUser';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [added, setAdded] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    supabase.from('products').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Fresh at your door, every morning.</h1>
      <p className="text-xs text-gray-500 mb-4">Delivered before 7 AM · Instant refund on missed delivery</p>
      {!user && (
        <a href="/login" className="block bg-accent text-white rounded-xl py-3 text-center font-semibold mb-4">
          Login to subscribe
        </a>
      )}
      <div className="grid grid-cols-2 gap-3">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="h-24 bg-cream rounded-xl mb-2 overflow-hidden">
              {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
            </div>
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500">{p.pack_size}</div>
            <div className="font-semibold mt-1">₹{p.selling_price}</div>
            {p.is_subscription_allowed && (
              <a href={`/subscribe?product=${p.id}`} className="mt-2 block text-center bg-brand text-white rounded-lg py-2 text-sm">Subscribe</a>
            )}
            <button
              className="mt-2 w-full border border-brand text-brand rounded-lg py-2 text-sm"
              onClick={() => { cart.add(p.id); setAdded(p.id); setTimeout(() => setAdded(''), 1000); }}>
              {added === p.id ? 'Added ✓' : 'Add once'}
            </button>
          </div>
        ))}
      </div>
      {products.length === 0 && <p className="text-gray-500">No products yet.</p>}
    </div>
  );
}
