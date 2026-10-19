'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cart } from '@/lib/useUser';

const EMOJI = { milk: '🥛', 'curd-drinks': '🥣', paneer: '🧀', 'ghee-butter': '🧈', eggs: '🥚', bread: '🍞', pantry: '🍯' };
const trust = [
  { icon: '☀️', title: 'Fresh every morning', sub: 'Planned for your routine' },
  { icon: '🛵', title: 'Before 7:30 AM', sub: 'Early doorstep delivery' },
  { icon: '↩', title: 'Wallet refunds', sub: 'For eligible failed orders' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [user, setUser] = useState(null);
  const [added, setAdded] = useState('');
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setCount(cart.count());
    supabase.auth.getUser().then(({ data }) => { if (alive) setUser(data.user); });
    Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]).then(([cr, pr]) => {
      if (!alive) return;
      if (cr.error) setErr(cr.error.message);
      if (pr.error) setErr(pr.error.message);
      setCats(cr.data || []);
      setProducts(pr.data || []);
      setLoaded(true);
    });
    const onCart = () => setCount(cart.count());
    window.addEventListener('gf-cart', onCart);
    window.addEventListener('storage', onCart);
    return () => { alive = false; window.removeEventListener('gf-cart', onCart); window.removeEventListener('storage', onCart); };
  }, []);

  const shown = useMemo(() => products.filter(p =>
    (cat === 'all' || p.category_id === cat) &&
    (!q || `${p.name || ''} ${p.pack_size || ''} ${p.description || ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [products, cat, q]);
  const chip = on => `shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium border transition ${on ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-gray-600 border-[#e1e9e2] hover:border-brand/40'}`;

  function addOnce(product) {
    cart.add(product.id);
    setCount(cart.count());
    setAdded(product.id);
    window.setTimeout(() => setAdded(current => current === product.id ? '' : current), 1100);
  }

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#08452d] via-brand to-[#16754d] p-5 sm:p-8 text-white shadow-[0_14px_35px_rgba(11,93,59,.18)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full border-[26px] border-white/5 sm:h-64 sm:w-64" />
        <div aria-hidden="true" className="pointer-events-none absolute right-8 top-10 text-6xl opacity-20 sm:right-16 sm:top-12 sm:text-8xl">🥛</div>
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-green-50"><span className="h-1.5 w-1.5 rounded-full bg-[#f8bd45]" /> Your morning, made fresher</span>
          <h1 className="mt-4 max-w-lg text-[29px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl">Good mornings begin with <span className="text-[#ffd27a]">GharFresh.</span></h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-green-50/90 sm:text-base">Milk, dairy and everyday essentials delivered to your doorstep, before the day gets busy.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a href="#shop" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#f7b733] px-5 py-3 text-sm font-bold text-[#332306] shadow-sm transition hover:bg-[#ffca59]">Explore products <span className="ml-2" aria-hidden="true">→</span></a>
            {!user && <a href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15">Login / Sign up</a>}
          </div>
          <p className="mt-4 text-[11px] text-green-50/75">Tomorrow’s basket can be managed before the 10 PM cut-off.</p>
        </div>
      </section>

      <section aria-label="Service highlights" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {trust.map(t => <div key={t.title} className="flex items-center gap-3 rounded-2xl border border-[#e8eee9] bg-white px-4 py-3.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf7f0] text-lg">{t.icon}</span><span className="min-w-0"><span className="block text-sm font-bold text-[#193a29]">{t.title}</span><span className="mt-0.5 block text-xs text-gray-500">{t.sub}</span></span></div>)}
      </section>

      <section id="shop" className="mt-7 scroll-mt-24">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">The daily essentials</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#193a29] sm:text-3xl">Fresh picks for home</h2></div>
          <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-[#e4ebe5] sm:inline-flex">{products.length} products</span>
        </div>

        <label className="relative mt-4 block">
          <span className="sr-only">Search products</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400" aria-hidden="true">⌕</span>
          <input className="!mb-0 w-full rounded-2xl border-[#e2eae3] bg-white py-4 pl-11 pr-4 shadow-[0_2px_10px_rgba(20,50,35,.025)] placeholder:text-gray-400 focus:border-brand" placeholder="Search milk, paneer, eggs…" value={q} onChange={e => setQ(e.target.value)} />
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Product categories">
          <button className={chip(cat === 'all')} onClick={() => setCat('all')}>All products</button>
          {cats.map(c => <button key={c.id} className={chip(cat === c.id)} onClick={() => setCat(c.id)}>{EMOJI[c.slug] || '🛒'} <span className="ml-1">{c.name}</span></button>)}
        </div>

        {err && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load catalog: {err}. <a className="font-semibold underline" href="/setup">Check system setup</a></div>}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map(p => (
            <article key={p.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e5ece6] bg-white p-2.5 shadow-[0_3px_14px_rgba(20,50,35,.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,50,35,.08)] sm:p-3">
              <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-[16px] bg-gradient-to-br from-[#f4f8f3] to-[#eaf3eb] sm:h-40">
                {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]" /> : <span className="text-5xl" aria-hidden="true">{EMOJI[cats.find(c => c.id === p.category_id)?.slug] || '🥛'}</span>}
                {p.is_subscription_allowed && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-brand shadow-sm">Daily plan</span>}
              </div>
              <div className="flex flex-1 flex-col px-0.5 pb-1 pt-3">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-[#20382a] sm:text-[15px]">{p.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{p.pack_size || 'Everyday essential'}</p>
                {p.description && <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-gray-500">{p.description}</p>}
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-lg font-extrabold tracking-tight text-[#173c29]">₹{p.selling_price}</span>{Number(p.mrp) > Number(p.selling_price) && <span className="text-xs text-gray-400 line-through">₹{p.mrp}</span>}</div>
                <div className="mt-auto space-y-2 pt-3">
                  {p.is_subscription_allowed && <a href={`/subscribe?product=${p.id}`} className="flex min-h-10 w-full items-center justify-center rounded-xl bg-brand px-2 py-2 text-center text-xs font-bold text-white transition hover:bg-[#08452d] sm:text-sm">Subscribe daily</a>}
                  <button onClick={() => addOnce(p)} className={`flex min-h-10 w-full items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition sm:text-sm ${added === p.id ? 'border-[#b9ddc5] bg-[#edf8f0] text-brand' : 'border-[#d5e5d9] bg-white text-brand hover:bg-[#f3f8f4]'}`} aria-label={`Add ${p.name} once to basket`}>{added === p.id ? '✓ Added to basket' : '+ Add once'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {loaded && shown.length === 0 && !err && <div className="mt-4 rounded-2xl border border-dashed border-[#cddbd0] bg-white p-8 text-center"><span className="text-3xl" aria-hidden="true">🔎</span><p className="mt-2 font-bold text-gray-700">No products found</p><p className="mt-1 text-sm text-gray-500">Try another search or choose a different category.</p><button onClick={() => { setQ(''); setCat('all'); }} className="mt-4 rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand">Clear filters</button></div>}
        {!loaded && !err && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-64 animate-pulse rounded-[22px] bg-white ring-1 ring-[#e5ece6]"><div className="m-3 h-32 rounded-2xl bg-[#edf3ee]" /><div className="mx-3 mt-4 h-3 rounded bg-[#edf3ee]" /><div className="mx-3 mt-2 h-3 w-1/2 rounded bg-[#edf3ee]" /></div>)}</div>}
      </section>

      {count > 0 && <a href="/basket" className="fixed bottom-[5.5rem] left-1/2 z-20 flex min-h-12 -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-[#f5b32f] px-5 py-3 text-sm font-extrabold text-[#2f2207] shadow-[0_8px_25px_rgba(85,60,0,.22)] transition hover:bg-[#ffca59] sm:bottom-6"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff2d3]">🛒</span>View basket <span className="rounded-full bg-[#2f2207]/10 px-2 py-0.5">{count}</span><span aria-hidden="true">→</span></a>}
    </div>
  );
}
