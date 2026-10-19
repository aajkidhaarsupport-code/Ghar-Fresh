'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cart } from '@/lib/useUser';

const I = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  basket: 'M6 6h15l-2 9H8L6 3H3M9 20a1 1 0 100 .01M18 20a1 1 0 100 .01',
  plans: 'M4 5h16v14H4zM4 9h16M9 3v4M15 3v4',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h12M16 13h3',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0'
};
const items = [
  ['/', 'Home', 'home'], ['/basket', 'Basket', 'basket'], ['/subscriptions', 'Plans', 'plans'],
  ['/wallet', 'Wallet', 'wallet'], ['/profile', 'Profile', 'user']
];

export default function Nav() {
  const path = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(cart.count());
    f();
    window.addEventListener('gf-cart', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('gf-cart', f); window.removeEventListener('storage', f); };
  }, []);
  if (path.startsWith('/admin') || path.startsWith('/rider') || path.startsWith('/setup')) return null;
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5ece6] bg-white/95 shadow-[0_-5px_22px_rgba(20,50,35,.06)] backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-md justify-around px-1 pt-2 pb-1 sm:max-w-lg sm:py-2">
        {items.map(([href, label, icon]) => {
          const on = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <a key={href} href={href} aria-current={on ? 'page' : undefined} className={`relative flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] transition sm:min-w-[64px] sm:text-[11px] ${on ? 'font-bold text-brand' : 'font-medium text-gray-500 hover:text-brand'}`}>
              <span className={`relative flex h-7 w-9 items-center justify-center rounded-xl transition ${on ? 'bg-[#eaf5ed]' : ''}`}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[icon]} /></svg>
                {icon === 'basket' && n > 0 && <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#f5b32f] px-1 text-[9px] font-extrabold text-[#302307]">{n > 99 ? '99+' : n}</span>}
              </span>
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
