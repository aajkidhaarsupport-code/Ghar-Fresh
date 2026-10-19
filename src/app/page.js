'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cart } from '@/lib/useUser';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [user, setUser] = useState(null);
  const [added, setAdded] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCats(data || []));
    supabase.from('products').select('*').eq('is_active', true).order('name')
      .then(({ data, error }) => { if (error) setErr(error.message); setProducts(data || []); setLoaded(true); });
  }, []);

  const shown = cat === 'all' ? products : products.filter(p => p.category_id === cat);
  const chip = on => `whitespace-nowrap px-4 py-2 rounded-full text-sm border ${on ? 'bg-brand text-white border-brand' : 'bg-white text-brand border-brand/30'}`;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Fresh at your door, every morning.</h1>
      <p className="text-xs text-gray-500 mb-4">Delivered before 7:30 AM · Instant refund on missed delivery</p>
      {!user && (
        <a href="/login" className="block bg-accent text-white rounded-xl py-3 text-center font-semibold mb-4">
          Login to subscribe
        </a>
      )}

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
        <button className={chip(cat === 'all')} onClick={() => setCat('all')}>All</button>
        {cats.map(c => <button key={c.id} className={chip(cat === c.id)} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>

      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        {shown.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-3 shadow-sm flex flex-col">
            <div className="h-28 bg-cream rounded-xl mb-2 overflow-hidden">
              {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
            </div>
            <div className="font-medium leading-tight">{p.name}</div>
            <div className="text-sm text-gray-500">{p.pack_size}</div>
            {p.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</div>}
            <div className="mt-1">
              <span className="font-semibold">₹{p.selling_price}</span>
              {Number(p.mrp) > Number(p.selling_price) && <span className="text-xs text-gray-400 line-through ml-2">₹{p.mrp}</span>}
            </div>
            <div className="mt-auto pt-2">
              {p.is_subscription_allowed && (
                <a href={`/subscribe?product=${p.id}`} className="block text-center bg-brand text-white rounded-lg py-2 text-sm">Subscribe</a>
              )}
              <button
                className="mt-2 w-full border border-brand text-brand rounded-lg py-2 text-sm"
                onClick={() => { cart.add(p.id); setAdded(p.id); setTimeout(() => setAdded(''), 1000); }}>
                {added === p.id ? 'Added ✓' : 'Add once'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {loaded && shown.length === 0 && !err && <p className="text-gray-500">No products here yet.</p>}
    </div>
  );
}
